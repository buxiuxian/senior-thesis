"""
Tool for reading RSHub task submission parameters
"""

import logging
from typing import Dict, Any
from .base import BaseTool

logger = logging.getLogger(__name__)


class ReadParametersTool(BaseTool):
    """Tool to read parameters of submitted RSHub tasks"""
    
    def __init__(self, rshub_service):
        self.rshub_service = rshub_service
    
    @property
    def name(self) -> str:
        return "read_task_parameters"
    
    @property
    def description(self) -> str:
        return """Read the input parameters that were used when submitting a specific RSHub task.
Use this tool when:
- User asks what parameters they used for a task
- You need to verify task configuration before analyzing results
- User wants to compare parameters across different tasks
- You need context about a task's setup for troubleshooting

Returns all submission parameters including:
- scenario_flag (soil/snow/veg)
- algorithm (rt/qms/bic)
- output_var (tb/sigma)
- fGHz (frequency list)
- angle (observation angles)
- scatters (all model-specific parameters like depth, rho, mv, etc.)
- metadata (timestamps, status)"""
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "project_name": {
                    "type": "string",
                    "description": "Name of the project"
                },
                "task_name": {
                    "type": "string",
                    "description": "Name of the task"
                }
            },
            "required": ["project_name", "task_name"]
        }
    
    async def execute(self, project_name: str, task_name: str, 
                     token: str) -> Dict[str, Any]:
        """Read task parameters via RSHub SDK"""
        try:
            params = self.rshub_service.load_task_parameters(
                token=token,
                project_name=project_name,
                task_name=task_name
            )
            
            if not params:
                logger.warning(f"Task parameters not found: {project_name}/{task_name}")
                return {
                    "success": False,
                    "error": "Task parameters not found. The task may not exist or you don't have access."
                }
            
            formatted_params = self._format_parameters(params)
            
            logger.info(f"Successfully read parameters: {project_name}/{task_name}")
            return {
                "success": True,
                "project": project_name,
                "task": task_name,
                "parameters": formatted_params,
                "note": "These are the original parameters used when submitting the task. You can reference these when analyzing results or helping users understand their simulation setup."
            }
        
        except Exception as e:
            logger.error(f"Parameter reading failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Failed to read parameters: {str(e)}"
            }
    
    def _format_parameters(self, params: Dict) -> str:
        """Format parameters for readable display"""
        if not params:
            return "No parameters available"
        
        formatted_lines = []
        
        basic_keys = ['scenario_flag', 'algorithm', 'output_var', 'fGHz', 'angle', 'deg0inc']
        meta_keys = ['project_name', 'task_name', 'token', 'level_required']
        
        formatted_lines.append("=== Basic Configuration ===")
        for key in basic_keys:
            if key in params:
                value = params[key]
                if isinstance(value, list):
                    formatted_lines.append(f"{key}: {value}")
                else:
                    formatted_lines.append(f"{key}: {value}")
        
        if 'scatters' in params and params['scatters']:
            formatted_lines.append("\n=== Model Parameters (scatters) ===")
            scatters = params['scatters']
            if isinstance(scatters, dict):
                for key, value in sorted(scatters.items()):
                    if isinstance(value, (list, tuple)) and len(value) > 5:
                        formatted_lines.append(f"{key}: array with {len(value)} values")
                        formatted_lines.append(f"  Range: [{min(value):.4f} to {max(value):.4f}]")
                    elif isinstance(value, (list, tuple)):
                        formatted_lines.append(f"{key}: {value}")
                    elif isinstance(value, (int, float)):
                        formatted_lines.append(f"{key}: {value}")
                    else:
                        formatted_lines.append(f"{key}: {value}")
        
        formatted_lines.append("\n=== Metadata ===")
        for key in meta_keys:
            if key in params and key != 'token':
                formatted_lines.append(f"{key}: {params[key]}")
        
        other_keys = [k for k in params.keys() 
                     if k not in basic_keys + meta_keys + ['scatters', 'token']]
        if other_keys:
            formatted_lines.append("\n=== Other Parameters ===")
            for key in sorted(other_keys):
                formatted_lines.append(f"{key}: {params[key]}")
        
        return "\n".join(formatted_lines)


