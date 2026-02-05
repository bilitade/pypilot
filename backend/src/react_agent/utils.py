"""Utility functions for the agent."""

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel


def load_chat_model(fully_specified_name: str) -> BaseChatModel:
    """Load chat model from provider/model string.

    Args:
        fully_specified_name: Provider/model format string

    Returns:
        Configured chat model instance
    """
    provider, model = fully_specified_name.split("/", maxsplit=1)
    return init_chat_model(model, model_provider=provider)
