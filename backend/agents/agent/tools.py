"""
This module provides tools for the complete blog generation workflow
"""

from typing import Any, Callable

from langgraph.runtime import get_runtime


import structlog

from agents.agent.context import Context

logger = structlog.getLogger(__name__)

# website_analysis_agent = load_chat_model(settings.GPT_4_MINI_MODEL)
#     website_summary = await website_analysis_agent.ainvoke(
#         [
#             SystemMessage(content=WEBSITE_ANALYSER_PROMPT),
#             HumanMessage(content=str(website_analyses)),
#         ]
#     )


async def search(query: str) -> dict[str, Any] | None:
    """Search for general web results.

    This function performs a search using the Tavily search engine, which is designed
    to provide comprehensive, accurate, and trusted results. It's particularly useful
    for answering questions about current events.
    """
    runtime = get_runtime(Context)
    return {
        "query": query,
        "max_search_results": runtime.context.max_search_results,
        "results": f"Simulated search results for '{query}'",
    }


TOOLS: list[Callable[..., Any]] = []
