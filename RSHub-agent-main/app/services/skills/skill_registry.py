"""Load and validate Skill Registry YAML files."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from app.models.skill import SkillCatalogEntry, SkillDefinition

logger = logging.getLogger(__name__)

_REGISTRY_DIR = Path(__file__).resolve().parent.parent.parent / "skills" / "registry"


class SkillRegistryService:
    """In-memory registry of SkillDefinition loaded from app/skills/registry/*.yaml."""

    def __init__(self, registry_dir: Optional[Path] = None):
        self._dir = registry_dir or _REGISTRY_DIR
        self._skills: Dict[str, SkillDefinition] = {}
        self._load_all()

    def _load_all(self) -> None:
        if not self._dir.is_dir():
            logger.warning("Skill registry directory missing: %s", self._dir)
            return
        for path in sorted(self._dir.glob("*.yaml")) + sorted(self._dir.glob("*.yml")):
            self._load_file(path)
        logger.info("Loaded %d skills from %s", len(self._skills), self._dir)

    def _load_file(self, path: Path) -> None:
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
            if not raw:
                return
            skill = SkillDefinition.model_validate(raw)
            if skill.id in self._skills:
                logger.warning("Duplicate skill id %s in %s — overwriting", skill.id, path)
            self._skills[skill.id] = skill
        except Exception as e:
            logger.error("Failed to load skill file %s: %s", path, e, exc_info=True)

    def get(self, skill_id: str) -> Optional[SkillDefinition]:
        return self._skills.get(skill_id)

    def all_skills(self) -> Dict[str, SkillDefinition]:
        return dict(self._skills)

    def catalog_entries(self) -> List[SkillCatalogEntry]:
        return [
            SkillCatalogEntry(
                id=s.id,
                short_description=s.short_description,
                tags=list(s.tags),
                bound_tool=s.bound_tool,
                requires_confirmation=s.requires_confirmation,
            )
            for s in sorted(self._skills.values(), key=lambda x: x.id)
        ]

    def format_layer1_catalog(self) -> str:
        """Single block: id + short_description + tags (for prompt transparency)."""
        lines = ["## Skill catalog (layer 1 — short descriptions)", ""]
        for e in self.catalog_entries():
            tag_str = ", ".join(e.tags) if e.tags else ""
            lines.append(f"- **{e.id}**: {e.short_description}  _(tags: {tag_str})_")
        return "\n".join(lines)

    def render_layer2_docs(self, skill_ids: List[str]) -> str:
        """Concatenate full_doc for selected skills in stable order."""
        parts: List[str] = []
        for sid in skill_ids:
            s = self._skills.get(sid)
            if not s or not s.full_doc.strip():
                continue
            parts.append(f"<!-- skill:{sid} -->\n{s.full_doc.strip()}\n")
        if not parts:
            return ""
        return "\n---\n\n".join(parts)


_registry_instance: Optional[SkillRegistryService] = None


def get_skill_registry() -> SkillRegistryService:
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = SkillRegistryService()
    return _registry_instance
