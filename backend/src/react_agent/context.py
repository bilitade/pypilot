from typing import Optional
from pydantic import BaseModel, Field
from . import prompts


class Context(BaseModel):
    system_prompt: str = Field(default=prompts.SYSTEM_PROMPT)
    model: str = Field(default="openai/gpt-5-mini")
    max_search_results: int = Field(default=10)

   