import time
from typing import Any, Dict, Optional, Tuple


class ResultCache:
    def __init__(self):
        self._data: Dict[str, Dict[str, Any]] = {}
        self._latest_by_task: Dict[Tuple[str, str], str] = {}

    def set(self, data_ref: str, result: Dict[str, Any], metadata: Dict[str, Any]) -> None:
        self._data[data_ref] = {
            "result": result,
            "metadata": metadata,
            "timestamp": time.time()
        }
        project = metadata.get("project")
        task = metadata.get("task")
        if project and task:
            self._latest_by_task[(project, task)] = data_ref

    def get(self, data_ref: str) -> Optional[Dict[str, Any]]:
        return self._data.get(data_ref)

    def exists(self, data_ref: str) -> bool:
        return data_ref in self._data

    def get_latest_ref(self, project: str, task: str) -> Optional[str]:
        return self._latest_by_task.get((project, task))


result_cache = ResultCache()
