"""
This module provides tools for the complete workflow
"""
import jsond
import structlog
from typing import Any, Callable
from langchain_core.messages import SystemMessage, HumanMessage

from agents.agent.prompts import (
    MINDMAP_PROMPT,
    SEQUENCE_PROMPT,
    MODIFICATION_PROMPT,
    MOD_PROMPT_NODE,
    KNOWLEDGE_GRAPH_PROMPT,
    TIMELINE_PROMPT,
)
from agents.agent.utils import load_chat_model
from core.config import settings

logger = structlog.getLogger(__name__)


async def create_mindmap(topic: str) -> Any:
    """Create a mindmap from a topic."""

    mindmap_prompt = MINDMAP_PROMPT.replace("{INSERT_TOPIC_HERE}", topic)
    agent = load_chat_model(settings.GEMINI_MODEL)
    logger.info(f"Creating mindmap for {topic}")
    response = await agent.ainvoke(
        [
            SystemMessage(content="Follow the user message"),
            HumanMessage(content=mindmap_prompt),
        ]
    )
    # Strip markdown code blocks if the model accidentally includes them
    clean_content = response.content.replace("```json", "").replace("```", "").strip()
    return clean_content


async def create_timeline(topic: str) -> Any:
    """Create a timeline for a topic."""

    timeline_prompt = TIMELINE_PROMPT.replace("{INSERT_TOPIC_HERE}", topic)
    agent = load_chat_model(settings.GEMINI_MODEL)
    logger.info(f"Creating timeline for {topic}")
    response = await agent.ainvoke(
        [
            SystemMessage(content="Follow the user message"),
            HumanMessage(content=timeline_prompt),
        ]
    )
    # Strip markdown code blocks if the model accidentally includes them
    clean_content = response.content.replace("```json", "").replace("```", "").strip()
    return clean_content


async def create_sequence_diagram(topic: str) -> Any:
    """
    Generates a technical sequence diagram showing interactions between systems and actors.
    Use this for processes, API flows, login sequences, or transaction logic.
    """

    sequence_prompt = SEQUENCE_PROMPT.replace("{INSERT_TOPIC_HERE}", topic)

    agent = load_chat_model(settings.GEMINI_MODEL)
    logger.info(f"Creating sequence diagram for {topic}")
    response = await agent.ainvoke(
        [
            SystemMessage(content="Follow the user message"),
            HumanMessage(content=sequence_prompt),
        ]
    )
    # Strip markdown code blocks if the model accidentally includes them
    clean_content = response.content.replace("```json", "").replace("```", "").strip()
    return clean_content


async def create_knowledge_graph(topic: str) -> Any:
    """
    Generates a strict 3-level tree structure (Root -> Category -> Item).
    Use this for structured datasets, classification, or organized technical stacks.
    """

    knowledge_graph_prompt = KNOWLEDGE_GRAPH_PROMPT.replace(
        "{INSERT_TOPIC_HERE}", topic
    )
    agent = load_chat_model(settings.GEMINI_MODEL)
    logger.info(f"Creating knowledge graph for {topic}")
    response = await agent.ainvoke(
        [
            SystemMessage(content="Follow the user message"),
            HumanMessage(content=knowledge_graph_prompt),
        ]
    )
    # Strip markdown code blocks if the model accidentally includes them
    clean_content = response.content.replace("```json", "").replace("```", "").strip()
    return clean_content


async def modify_visualization(current_json: str, request: str) -> Any:
    """
    Modifies an existing visualization (Mindmap, Graph, or Sequence).
    Use this when the user says "Add a node", "Delete the history branch", or "Rename X to Y".
    Args:
        current_json: The stringified JSON of the current state.
        request: The user's change request.
    """
    mod_prompt = MODIFICATION_PROMPT.replace(
        "{INSERT_CURRENT_JSON_DATA_HERE}", str(current_json)
    )
    mod_prompt = mod_prompt.replace("{REQUEST}", request)

    agent = load_chat_model(settings.GEMINI_MODEL)
    logger.info(f"Modifying visualization")
    response = await agent.ainvoke(
        [
            SystemMessage(content="Follow the user message"),
            HumanMessage(content=mod_prompt),
        ]
    )
    # Strip markdown code blocks if the model accidentally includes them
    clean_content = response.content.replace("```json", "").replace("```", "").strip()
    return clean_content

async def modify_node(node_content: str, request: str) -> Any:
    """
    Modifies an existing node content (Mindmap, Graph, or Sequence).
    Changes the content present in the selected node as per the users' request.
    Args:
        node_content: The stringified JSON of the current state.
        request: The user's change request.
    """
    mod_prompt = MOD_PROMPT_NODE.replace(
        "{INSERT_CURRENT_JSON_DATA_HERE}", str(node_content)
    )
    mod_prompt_node = mod_prompt.replace("{REQUEST}", request)

    agent = load_chat_model(settings.GEMINI_MODEL)
    logger.info(f"Modifying node content")
    response = await agent.ainvoke(
        [
            SystemMessage(content="Follow the user message"),
            HumanMessage(content=mod_prompt_node),
        ]
    )
    # Strip markdown code blocks if the model accidentally includes them
    clean_content = response.content.replace("```json", "").replace("```", "").strip()
    clean_content = json.loads(clean_content)["content"]
    return clean_content


TOOLS: list[Callable[..., Any]] = [
    create_mindmap,
    modify_node,
    modify_visualization,
    create_sequence_diagram,
    create_knowledge_graph,
    create_timeline,
]
