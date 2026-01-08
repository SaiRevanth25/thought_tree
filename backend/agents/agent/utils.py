"""Utility & helper functions."""

import os
import structlog
from typing import Any


from langchain_openai import ChatOpenAI
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel


from dotenv import load_dotenv

load_dotenv()
logger = structlog.getLogger(__name__)


def openrouter_chat_model(model: str, **kwargs: Any) -> BaseChatModel:
    """
    Initialize a chat model that uses OpenRouter’s API endpoint automatically.

    Args:
        model (str): The model slug from OpenRouter (e.g. "meta-llama/llama-3.1-70b-instruct").
        **kwargs: Additional parameters for the ChatOpenAI model (like temperature, max_tokens, etc.)

    Returns:
        BaseChatModel: A ready-to-use LangChain Chat model.
    """

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise EnvironmentError("Missing OPENROUTER_API_KEY environment variable.")

    # Use OpenRouter's OpenAI-compatible endpoint
    base_url = "https://openrouter.ai/api/v1"

    chat_model = ChatOpenAI(
        model=model, openai_api_key=api_key, openai_api_base=base_url, **kwargs
    )

    return chat_model


def load_chat_model(fully_specified_name: str) -> BaseChatModel:
    """Load a chat model from a fully specified name.

    Args:
        fully_specified_name (str): String in the format 'provider/model'.
    """
    provider, model = fully_specified_name.split("/", maxsplit=1)
    return init_chat_model(model, model_provider=provider)
