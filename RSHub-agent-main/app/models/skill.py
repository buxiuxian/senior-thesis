"""Skill Registry models (direction 3: hierarchical skill loading)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SkillDefinition(BaseModel):
    """One skill entry: catalog row + optional full documentation."""

    id: str = Field(..., description="Stable skill id, e.g. rshub.literature.papers_index")
    short_description: str = Field(..., description="Layer-1 catalog line (very short)")
    tags: List[str] = Field(default_factory=list)
    full_doc: str = Field(default="", description="Layer-2 markdown body")
    bound_tool: Optional[str] = Field(
        default=None,
        description="OpenAI tool name if this skill maps 1:1 to a tool",
    )
    requires_confirmation: bool = Field(
        default=False,
        description="If true, tool execution must follow HITL confirm (e.g. submit)",
    )
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    examples: List[Dict[str, Any]] = Field(default_factory=list)


class SkillCatalogEntry(BaseModel):
    """Minimal row for layer-1 (routing / display only)."""

    id: str
    short_description: str
    tags: List[str] = Field(default_factory=list)
    bound_tool: Optional[str] = None
    requires_confirmation: bool = False
