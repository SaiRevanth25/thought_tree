from __future__ import annotations

import asyncio
import copy
from datetime import datetime, timezone
from uuid import uuid5

import structlog
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import TypeVar, Callable, Awaitable, Optional, Dict, Mapping, Any
from fastapi import HTTPException

from misc.constants import ASSISTANT_NAMESPACE_UUID
from core.orm import Thread as ThreadORM, _get_session_maker, Run as RunORM
from models.users import User
from misc.active_runs import active_runs
from services.langgraph_service import get_langgraph_service, create_run_config
from services.streaming_service import streaming_service
from services.rag_service import rag_service
from core.general_serializer import general_serializer

T = TypeVar("T")
RUN_STREAM_MODES = ["messages", "values", "custom"]

# Default stream modes for background run execution
DEFAULT_STREAM_MODES = ["values"]

logger = structlog.getLogger(__name__)


async def retry(
    fn: Callable[[], Awaitable[T]],
    max_attempts: int = 3,
    delay_seconds: int = 1,
) -> T:
    """
    Retry an async function with exponential backoff.

    Args:
        fn: The async function to retry
        max_attempts: Maximum number of attempts
        delay_seconds: Delay between attempts in seconds

    Returns:
        The result of the function call

    Raises:
        The last exception if all attempts fail

    Example:
    ```python
    async def fetch_data():
        # Some operation that might fail
        return await api_call()

    try:
        result = await retry(fetch_data, max_attempts=3, delay_seconds=2)
        print(f"Success: {result}")
    except Exception as e:
        print(f"Failed after all retries: {e}")
    ```
    """
    if max_attempts <= 0:
        raise ValueError("max_attempts must be greater than zero")

    last_error: Optional[Exception] = None

    for attempt in range(1, max_attempts + 1):
        try:
            return await fn()
        except Exception as error:
            last_error = error

            if attempt == max_attempts:
                break

            await asyncio.sleep(delay_seconds)

    if last_error:
        raise last_error

    raise RuntimeError("Unexpected: last_error is None")


def get_sse_headers() -> Dict[str, str]:
    """Get standard SSE headers"""
    return {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Last-Event-ID",
    }


async def set_thread_status(session: AsyncSession, thread_id: str, status: str):
    """Update the status column of a thread."""
    await session.execute(
        update(ThreadORM)
        .where(ThreadORM.thread_id == thread_id)
        .values(status=status, updated_at=datetime.now(timezone.utc))
    )
    await session.commit()


async def update_thread_metadata(session: AsyncSession, thread_id: str):
    """Update thread metadata with assistant and graph information (dialect agnostic)."""
    # Read-modify-write to avoid DB-specific JSON concat operators
    thread = await session.scalar(
        select(ThreadORM).where(ThreadORM.thread_id == thread_id)
    )
    if not thread:
        raise HTTPException(404, f"Thread '{thread_id}' not found for metadata update")
    md = dict(getattr(thread, "metadata_json", {}) or {})
    # md.update({
    #     "graph_id": graph_id,
    # })
    await session.execute(
        update(ThreadORM)
        .where(ThreadORM.thread_id == thread_id)
        .values(metadata_json=md, updated_at=datetime.now(timezone.utc))
    )
    await session.commit()

    return md


async def inject_rag_context(
    session: AsyncSession,
    thread_id: str,
    input_data: dict,
) -> dict:
    """
    Inject RAG context from uploaded files into the user's message.
    
    If the thread has uploaded files, searches for relevant chunks 
    and prepends context to the user's message.
    
    Args:
        session: Database session
        thread_id: Thread ID to search files in
        input_data: Original input data with messages
        
    Returns:
        Modified input_data with RAG context injected
    """
    try:
        # Check if thread has files
        has_files = await rag_service.has_files_in_thread(session, thread_id)
        if not has_files:
            return input_data
        
        # Extract user query from messages
        messages = input_data.get("messages", [])
        if not messages:
            return input_data
        
        # Get the last human message
        user_query = None
        for msg in reversed(messages):
            if msg.get("type") == "human":
                content = msg.get("content", "")
                if isinstance(content, str):
                    user_query = content
                elif isinstance(content, list) and len(content) > 0:
                    # Handle content array format
                    first_content = content[0]
                    if isinstance(first_content, dict):
                        user_query = first_content.get("text", "")
                    elif isinstance(first_content, str):
                        user_query = first_content
                break
        
        if not user_query:
            return input_data
        
        # Get relevant context from files
        rag_context = await rag_service.get_context_for_query(
            session, user_query, thread_id
        )
        
        if not rag_context:
            return input_data
        
        # Create a copy of input_data to avoid mutating original
        modified_input = copy.deepcopy(input_data)
        
        # Prepend context to the last human message
        for msg in reversed(modified_input.get("messages", [])):
            if msg.get("type") == "human":
                content = msg.get("content", "")
                
                if isinstance(content, str):
                    msg["content"] = f"{rag_context}\n\nUser Query: {content}"
                elif isinstance(content, list) and len(content) > 0:
                    first_content = content[0]
                    if isinstance(first_content, dict) and "text" in first_content:
                        original_text = first_content.get("text", "")
                        first_content["text"] = f"{rag_context}\n\nUser Query: {original_text}"
                    elif isinstance(first_content, str):
                        content[0] = f"{rag_context}\n\nUser Query: {first_content}"
                break
        
        logger.info(f"Injected RAG context for thread {thread_id}")
        return modified_input
        
    except Exception as e:
        logger.warning(f"Failed to inject RAG context: {e}")
        # Return original input if RAG fails
        return input_data


async def execute_run_async(
    run_id: str,
    thread_id: str,
    graph_id: str,
    input_data: dict,
    user: User,
    config: dict | None = None,
    context: dict | None = None,
    stream_mode: list[str] | None = None,
    session: AsyncSession | None = None,
    checkpoint: dict | None = None,
    command: dict[str, Any] | None = None,
    interrupt_before: str | list[str] | None = None,
    interrupt_after: str | list[str] | None = None,
    _multitask_strategy: str | None = None,
    subgraphs: bool | None = False,
) -> None:
    """Execute run asynchronously in background using streaming to capture all events"""  # Use provided session or get a new one
    if session is None:
        maker = _get_session_maker()
        session = maker()

    # Inject RAG context from uploaded files
    input_data = await inject_rag_context(session, thread_id, input_data)

    # Normalize stream_mode once here for all callers/endpoints.
    # Accept "messages-tuple" as an alias of "messages".
    def _normalize_mode(mode: str | None) -> str | None:
        return (
            "messages" if isinstance(mode, str) and mode == "messages-tuple" else mode
        )

    if isinstance(stream_mode, list):
        stream_mode = [_normalize_mode(m) for m in stream_mode]
    else:
        stream_mode = _normalize_mode(stream_mode)

    try:
        # Update status
        await update_run_status(run_id, "running", session=session)

        # Get graph and execute
        langgraph_service = get_langgraph_service()
        graph = await langgraph_service.get_graph(graph_id)

        run_config = create_run_config(
            run_id, thread_id, user, config or {}, checkpoint
        )

        # Handle human-in-the-loop fields
        if interrupt_before is not None:
            run_config["interrupt_before"] = (
                interrupt_before
                if isinstance(interrupt_before, list)
                else [interrupt_before]
            )
        if interrupt_after is not None:
            run_config["interrupt_after"] = (
                interrupt_after
                if isinstance(interrupt_after, list)
                else [interrupt_after]
            )

        # Execute using streaming to capture events for later replay
        event_counter = 0
        final_output = None
        has_interrupt = False

        # Prepare stream modes for execution
        if stream_mode is None:
            final_stream_modes = DEFAULT_STREAM_MODES.copy()
        elif isinstance(stream_mode, str):
            final_stream_modes = [stream_mode]
        else:
            final_stream_modes = stream_mode.copy()

        # Ensure interrupt events are captured by including updates mode
        # Track whether updates was explicitly requested by user
        user_requested_updates = "updates" in final_stream_modes
        if not user_requested_updates:
            final_stream_modes.append("updates")

        async for raw_event in graph.astream(
            input_data,
            config=run_config,
            context=context,
            subgraphs=subgraphs,
            stream_mode=final_stream_modes,
        ):
            event_counter += 1
            event_id = f"{run_id}_event_{event_counter}"

            # Forward to broker for live consumers
            await streaming_service.put_to_broker(
                run_id,
                event_id,
                raw_event,
            )
            # Store for replay
            await streaming_service.store_event_from_raw(
                run_id,
                event_id,
                raw_event,
            )

            # Check for interrupt in this event
            event_data = None
            if isinstance(raw_event, tuple) and len(raw_event) >= 2:
                event_data = raw_event[1]
            elif not isinstance(raw_event, tuple):
                event_data = raw_event

            if isinstance(event_data, dict) and "__interrupt__" in event_data:
                has_interrupt = True

            # Track final output
            if isinstance(raw_event, tuple):
                if len(raw_event) >= 2 and raw_event[0] == "values":
                    final_output = raw_event[1]
            elif not isinstance(raw_event, tuple):
                # Non-tuple events are values mode
                final_output = raw_event

        if has_interrupt:
            await update_run_status(
                run_id,
                "interrupted",
                output=final_output or {},
                session=session,
            )
            if not session:
                raise RuntimeError(
                    f"No database session available to update thread {thread_id} status"
                )
            await set_thread_status(session, thread_id, "interrupted")

        else:
            # Update with results
            await update_run_status(
                run_id,
                "completed",
                output=final_output or {},
                session=session,
            )
            # Mark thread back to idle
            if not session:
                raise RuntimeError(
                    f"No database session available to update thread {thread_id} status"
                )
            await set_thread_status(session, thread_id, "idle")

    except asyncio.CancelledError:
        # Store empty output to avoid JSON serialization issues
        await update_run_status(run_id, "cancelled", output={}, session=session)
        if not session:
            raise RuntimeError(
                f"No database session available to update thread {thread_id} status"
            ) from None
        await set_thread_status(session, thread_id, "idle")
        # Signal cancellation to broker
        await streaming_service.signal_run_cancelled(run_id)
        raise
    except Exception as e:
        # Store empty output to avoid JSON serialization issues
        await update_run_status(
            run_id, "failed", output={}, error=str(e), session=session
        )
        if not session:
            raise RuntimeError(
                f"No database session available to update thread {thread_id} status"
            ) from None
        await set_thread_status(session, thread_id, "idle")
        # Signal error to broker
        await streaming_service.signal_run_error(run_id, str(e))
        raise
    finally:
        # Clean up broker
        await streaming_service.cleanup_run(run_id)
        active_runs.pop(run_id, None)


async def update_run_status(
    run_id: str,
    status: str,
    output=None,
    error: str = None,
    session: Optional[AsyncSession] = None,
):
    """Update run status in database (persisted). If session not provided, opens a short-lived session."""
    owns_session = False
    if session is None:
        logger.info(f"Session created in update_run_status for run_id={run_id}")
        maker = _get_session_maker()
        session = maker()  # type: ignore[assignment]
        owns_session = True
    try:
        values = {"status": status, "updated_at": datetime.now(timezone.utc)}
        if output is not None:
            # Serialize output to ensure JSON compatibility
            try:
                serialized_output = general_serializer.serialize(output)
                values["output"] = serialized_output
            except Exception as e:
                logger.warning(f"Failed to serialize output for run {run_id}: {e}")
                values["output"] = {
                    "error": "Output serialization failed",
                    "original_type": str(type(output)),
                }
        if error is not None:
            values["error_message"] = error
        logger.info(f"[update_run_status] owns_session={owns_session}")
        logger.info(f"[update_run_status] updating DB run_id={run_id} status={status}")
        await session.execute(
            update(RunORM).where(RunORM.run_id == str(run_id)).values(**values)
        )  # type: ignore[arg-type]
        await session.commit()
        logger.info(f"[update_run_status] commit done run_id={run_id}")
    finally:
        # Close only if we created it here
        if owns_session:
            await session.close()  # type: ignore[func-returns-value]


def resolve_assistant_id(
    requested_id: str, available_graphs: Mapping[str, object]
) -> str:
    """Resolve an assistant identifier.

    If the provided identifier matches a known graph id, derive a
    deterministic assistant UUID using the project namespace. Otherwise,
    return the identifier as-is.

    Args:
        requested_id: The value provided by the client (assistant UUID or graph id).
        available_graphs: Graph registry mapping; only keys are used for membership.

    Returns:
        A string assistant_id suitable for DB lookups and FK references.
    """
    return (
        str(uuid5(ASSISTANT_NAMESPACE_UUID, requested_id))
        if requested_id in available_graphs
        else requested_id
    )


def _merge_jsonb(*objects: dict) -> dict:
    """Mimics PostgreSQL's JSONB merge behavior"""
    result = {}
    for obj in objects:
        if obj is not None:
            result.update(copy.deepcopy(obj))
    return result
