"""
Tool for submitting RSHub computational tasks
"""

import logging
from typing import Dict, Any, Tuple, Optional
from .base import BaseTool

logger = logging.getLogger(__name__)


class SubmitTaskTool(BaseTool):
    """Tool to submit computational tasks to RSHub"""
    
    def __init__(self, rshub_service, credit_service):
        self.rshub_service = rshub_service
        self.credit_service = credit_service
    
    @property
    def name(self) -> str:
        return "submit_rshub_task"
    
    @property
    def description(self) -> str:
        return """Submit a computational task to RSHub for microwave scattering simulation.
Use this when user wants to run a simulation, submit a task, or create a modeling job.
The task will be queued and executed on RSHub servers."""
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "project_name": {
                    "type": "string",
                    "description": "Name of the project (e.g., 'soil_test_20240120')"
                },
                "task_name": {
                    "type": "string",
                    "description": "Unique name for this task (e.g., 'task_1')"
                },
                "task_data": {
                    "type": "object",
                    "description": "Task parameters",
                    "properties": {
                        "scenario_flag": {
                            "type": "string",
                            "enum": ["soil", "snow", "veg"],
                            "description": "Scenario type"
                        },
                        "algorithm": {
                            "type": "string",
                            "description": (
                                "RSHub-valid algorithm string: soil MUST use 'vie' (NMM3D VIE/DDA pathway; "
                                "do NOT send 'fullwave_volume' — API rejects it). Snow: qms | bic | tri. "
                                "Vegetation passive: rt."
                            ),
                        },
                        "output_var": {
                            "type": "string",
                            "description": "Output variable (sigma/bs for active, tb for passive)"
                        },
                        "fGHz": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Frequency in GHz as array (e.g., [10.65] for single or [10.65, 18.7, 36.5] for multiple frequencies)"
                        },
                        "angle": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Incident angle in degrees as array (e.g., [40] for single or [40, 45, 50] for multiple angles)"
                        },
                        "depth": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Layer thickness in cm"
                        },
                        "rho": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Layer density in g/cm³"
                        },
                        "tsnow": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Snow temperature per layer in K (alias: Tsnow)"
                        },
                        "tg": {
                            "type": "number",
                            "description": "Ground temperature in K (alias: Tg)"
                        },
                        "mv": {
                            "type": "number",
                            "description": "Soil moisture volumetric fraction"
                        },
                        "clayfrac": {
                            "type": "number",
                            "description": "Clay fraction of soil"
                        },
                        "kc": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Correlation length parameter per layer"
                        },
                        "zp": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Binder fraction parameter per layer"
                        },
                        "dia": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Grain diameter per layer (DMRT-QMS)"
                        },
                        "tau": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Stickiness parameter per layer (DMRT-QMS)"
                        },
                        "film": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Film thickness per layer (DMRT-TRI)"
                        },
                        "wet": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Wetness fraction per layer (DMRT-TRI)"
                        },
                        "surf_model_setting": {
                            "type": "array",
                            "description": "Surface model settings array: [model_name, param1, param2]. IMPORTANT: First element must be a STRING (model name like 'QH' or 'OH'), followed by NUMERIC parameters (integers or floats). Example for passive mode: ['QH', 1, 10] where 'QH' is the model name (string), 1 is Q parameter (number), and 10 is H parameter (number).",
                            "items": {
                                "oneOf": [
                                    {"type": "string"},
                                    {"type": "number"}
                                ]
                            },
                            "minItems": 3,
                            "maxItems": 3
                        }
                    },
                    "required": ["scenario_flag", "algorithm", "output_var"]
                }
            },
            "required": ["project_name", "task_name", "task_data"]
        }

    def _validate_task_data(self, task_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate task_data parameters to catch common LLM generation errors.

        Returns:
            (is_valid, error_message)
        """
        # Check surf_model_setting format
        if "surf_model_setting" in task_data:
            surf = task_data["surf_model_setting"]
            if not isinstance(surf, list) or len(surf) != 3:
                return False, "surf_model_setting must be a 3-element array"

            if not isinstance(surf[0], str):
                return False, f"surf_model_setting[0] must be string (model name), got {type(surf[0])}"

            if not isinstance(surf[1], (int, float)):
                return False, f"surf_model_setting[1] must be number, got {type(surf[1])} with value {surf[1]}"

            if not isinstance(surf[2], (int, float)):
                return False, f"surf_model_setting[2] must be number, got {type(surf[2])} with value {surf[2]}"

        # Check kc parameter magnitude (if present)
        if "kc" in task_data:
            kc = task_data["kc"]
            if isinstance(kc, list):
                # Check if any value is suspiciously small (< 1000)
                if any(isinstance(v, (int, float)) and v < 1000 for v in kc):
                    return False, f"kc values seem too small (got {kc}). Expected range: 5000-15000 micrometers. Did you forget the magnitude?"

        return True, None

    async def execute(self, project_name: str, task_name: str,
                     task_data: Dict[str, Any], token: str) -> Dict[str, Any]:
        """Submit task via existing submit_task endpoint logic"""
        try:
            # Validate parameters before submission
            is_valid, error_msg = self._validate_task_data(task_data)
            if not is_valid:
                logger.error(f"Parameter validation failed: {error_msg}")
                return {
                    "success": False,
                    "error": f"Invalid task parameters: {error_msg}"
                }

            # Check credits first
            has_credits, message, _ = await self.credit_service.check_credits(token, 1)
            if not has_credits:
                return {
                    "success": False,
                    "error": f"Insufficient credits: {message}"
                }
            
            # Submit task to RSHub
            result = await self.rshub_service.submit_task(
                token=token,
                project_name=project_name,
                task_name=task_name,
                task_data=task_data
            )
            
            if not result.get("success"):
                return {
                    "success": False,
                    "error": result.get("error", "Task submission failed")
                }
            
            logger.info(f"Task submitted successfully: {project_name}/{task_name}")
            return {
                "success": True,
                "message": "Task submitted successfully and is now queued for execution",
                "project": project_name,
                "task": task_name,
                "status": result.get("status", "queued")
            }
        
        except Exception as e:
            logger.error(f"Task submission failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Task submission failed: {str(e)}"
            }

