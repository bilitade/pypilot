"""Agent context configuration."""

from typing import Optional
import os
from pydantic import BaseModel, Field
from . import prompts


class Context(BaseModel):
    system_prompt: str = Field(default=prompts.SYSTEM_PROMPT)
    model: str = Field(default=os.getenv("LLM_MODEL", "openai/gpt-4o-mini"))
    max_search_results: int = Field(default=10)
