"""Deterministic top-k skill selection (layer-2 load). Embeddings can replace this later."""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Set

from app.models.skill import SkillDefinition
from app.services.skills.hitl_context import is_exact_confirmation

logger = logging.getLogger(__name__)

# Always-on skills for correct tool use and tone (small / essential).
_CORE_ORDER: List[str] = [
    "rshub.core.tool_policy",
    "rshub.domain.platform",
    "rshub.tools.behavior",
    "rshub.core.response_guidelines",
]

_OPTIONAL_LITERATURE = "rshub.literature.papers_index"
_OPTIONAL_MODEL_PARAMS = "rshub.domain.model_parameters"
_HITL_POLICY = "rshub.hitl.policy"
_HITL_CONFIRM = "rshub.hitl.confirm_execute"

_LIT_PAT = re.compile(
    r"\b(paper|papers|fetch|fulltext|equation|methodology|citation|dmrt|nmm3d|vprt|"
    r"论文|文献|引用|全文)\b",
    re.I,
)
_TASK_PAT = re.compile(
    r"\b(submit|task|simulation|soil|snow|vegetation|veg|parameter|parameters|"
    r"tri\b|qms|bic|vie|output_var|ghz|dmrt|nmm3d|vprt|"
    r"提交|任务|模拟|参数|土壤|积雪|植被)\b",
    re.I,
)


def select_skill_ids_for_turn(
    user_message: str,
    *,
    hitl_enabled: bool,
    tiered_skill_load: bool,
    skills: Dict[str, SkillDefinition],
) -> List[str]:
    """
    Return ordered skill ids whose full_doc should be injected (layer 2).

    When tiered_skill_load is False, all registered skills are included (minus duplicates).
    """
    if not tiered_skill_load:
        return sorted(skills.keys())

    selected: List[str] = []
    seen: Set[str] = set()

    def add(sid: str) -> None:
        if sid not in skills:
            logger.warning("Skill id not in registry (skipped): %s", sid)
            return
        if sid in seen:
            return
        seen.add(sid)
        selected.append(sid)

    for sid in _CORE_ORDER:
        add(sid)

    if hitl_enabled:
        add(_HITL_POLICY)

    confirm = is_exact_confirmation(user_message)
    if hitl_enabled and confirm:
        add(_HITL_CONFIRM)
        add(_OPTIONAL_MODEL_PARAMS)

    text = user_message or ""
    if _LIT_PAT.search(text):
        add(_OPTIONAL_LITERATURE)
    if _TASK_PAT.search(text):
        add(_OPTIONAL_MODEL_PARAMS)

    # If nothing matched optional heuristics, still load model params when HITL is on
    # (Plan/Check often needs tables) — keeps HITL quality without huge cost vs full agent.j2.
    if hitl_enabled and not confirm and _OPTIONAL_MODEL_PARAMS not in seen:
        add(_OPTIONAL_MODEL_PARAMS)

    # Papers: optional when HITL planning without literature keywords — skip to save tokens.
    return selected
