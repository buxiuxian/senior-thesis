"""HITL: strict exact-match confirmation/rejection + TaskSpec extraction."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

# ──────────────────────────────────────────────────────────────────────────────
# Exact-match keyword sets (case-insensitive via .lower())
# ──────────────────────────────────────────────────────────────────────────────

CONFIRM_KEYWORDS: set[str] = {"confirm", "yes", "提交", "确认"}
REJECT_KEYWORDS: set[str] = {"cancel", "no", "取消", "拒绝"}

# Fixed response when user is in PENDING state but input doesn't match any keyword.
HITL_PENDING_PROMPT = (
    "⚠️ 当前有待确认的任务提交。请输入以下指令之一（必须完全匹配）：\n\n"
    "- **确认执行**：输入 `confirm`、`yes`、`提交` 或 `确认`\n"
    "- **取消执行**：输入 `cancel`、`no`、`取消` 或 `拒绝`\n\n"
    "如需修改参数，请取消当前任务，然后重新描述需求。"
)


def append_hitl_pending_prompt(content: str) -> str:
    """Append the fixed pending prompt once."""
    normalized = (content or "").rstrip()
    if not normalized:
        return HITL_PENDING_PROMPT
    if normalized.endswith(HITL_PENDING_PROMPT):
        return normalized
    return f"{normalized}\n\n{HITL_PENDING_PROMPT}"


def strip_appended_hitl_pending_prompt(content: str) -> str:
    """Remove only the backend-appended pending prompt from LLM history."""
    normalized = (content or "").rstrip()
    if normalized == HITL_PENDING_PROMPT:
        return ""

    suffix = f"\n\n{HITL_PENDING_PROMPT}"
    if normalized.endswith(suffix):
        return normalized[: -len(suffix)].rstrip()

    return normalized


def is_exact_confirmation(text: str) -> bool:
    """Return True only if text is exactly one of the confirm keywords."""
    if not text:
        return False
    return text.strip().lower() in CONFIRM_KEYWORDS


def is_exact_rejection(text: str) -> bool:
    """Return True only if text is exactly one of the reject keywords."""
    if not text:
        return False
    return text.strip().lower() in REJECT_KEYWORDS


# ──────────────────────────────────────────────────────────────────────────────
# TaskSpec extraction (kept for detecting when assistant produces a plan)
# ──────────────────────────────────────────────────────────────────────────────

def _extract_json_blocks(content: str) -> List[str]:
    blocks: List[str] = []
    for m in re.finditer(r"```(?:json)?\s*([\s\S]*?)\s*```", content, re.I):
        blocks.append(m.group(1).strip())
    return blocks


def _is_task_like(obj: Dict[str, Any]) -> bool:
    keys = {k.lower() for k in obj.keys()}
    return bool(
        {"project_name", "task_name"}.issubset(keys)
        or {"task_data", "parameters"}.intersection(keys)
    )


def extract_task_spec_from_text(content: str) -> Optional[Dict[str, Any]]:
    """Best-effort: pull a dict that looks like TaskSpec / submit args from assistant text."""
    if not content:
        return None

    for block in _extract_json_blocks(content):
        try:
            data = json.loads(block)
            if isinstance(data, dict) and _is_task_like(data):
                return data
        except json.JSONDecodeError:
            continue

    # Fallback: first JSON object in text
    start = content.find("{")
    while start >= 0:
        depth = 0
        for i in range(start, len(content)):
            c = content[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    chunk = content[start : i + 1]
                    try:
                        data = json.loads(chunk)
                        if isinstance(data, dict) and _is_task_like(data):
                            return data
                    except json.JSONDecodeError:
                        break
                    break
        start = content.find("{", start + 1)

    return None
