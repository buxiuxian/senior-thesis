"""
Tool for downloading RSHub task results
"""

import logging
import uuid
from typing import Dict, Any
import numpy as np
from .base import BaseTool
from app.services.result_cache import result_cache

logger = logging.getLogger(__name__)


class DownloadResultTool(BaseTool):
    """Tool to download results of completed RSHub tasks"""
    
    def __init__(self, rshub_service):
        self.rshub_service = rshub_service
    
    @property
    def name(self) -> str:
        return "download_task_result"
    
    @property
    def description(self) -> str:
        return """Retrieve and analyze computational results from a completed RSHub task.
Use this when user asks about results, wants to see output data, or needs analysis of simulation results.
This tool retrieves task results, caches the full data on the server, and returns a reference plus statistical summaries.
Returns:
1. data_ref: Reference id for cached full data (use this for plotting)
2. Statistics: Key statistics (min, max, mean, std) for quick reference
You should explain the results to users in natural language, and use data_ref for plotting."""
    
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
        """Download result via existing download logic"""
        try:
            # Get task parameters from RSHub
            try:
                params = self.rshub_service.load_task_parameters(token, project_name, task_name)
            except Exception as e:
                logger.error(f"Failed to retrieve task parameters: {e}")
                return {
                    "success": False,
                    "error": "Failed to retrieve task parameters. Please verify the project and task names are correct, or the task may not have been submitted yet."
                }
            
            # Extract metadata from parameters
            fGHz_raw = params.get('fGHz')
            fGHz = fGHz_raw[0] if isinstance(fGHz_raw, list) else fGHz_raw
            
            scenario_raw = params.get('scenario_flag')
            if isinstance(scenario_raw, int):
                scenario_map = {1: 'soil', 2: 'snow', 3: 'veg'}
                scenario = scenario_map.get(scenario_raw, 'soil')
            else:
                scenario = scenario_raw
            
            algorithm = params.get('algorithm')
            
            output_raw = params.get('output_var')
            if isinstance(output_raw, int):
                output_map = {1: 'bs', 2: 'tb'}
                output_var = output_map.get(output_raw, 'bs')
            else:
                output_var = output_raw
            
            angle_raw = params.get('angle') or params.get('theta_i_deg')
            if isinstance(angle_raw, list):
                angle = angle_raw[0] if angle_raw else None
            else:
                angle = angle_raw
            
            # Load results using RSHub SDK (v0.3.3+)
            result_dict = self.rshub_service.load_task_result(
                token=token,
                project_name=project_name,
                task_name=task_name,
                fGHz=fGHz,
                scenario_flag=scenario,
                algorithm=algorithm,
                output_var=output_var,
                angle=angle
            )
            
            if not result_dict:
                return {
                    "success": False,
                    "error": "Task results not available yet. The task may still be running or failed."
                }
            
            # Summarize results for LLM consumption
            summary = self._summarize_results(result_dict)
            
            logger.info(f"Successfully downloaded results: {project_name}/{task_name}")
            data_ref = uuid.uuid4().hex
            cache_metadata = {
                "project": project_name,
                "task": task_name,
                "scenario": scenario,
                "frequency": fGHz,
                "angle": angle
            }
            result_cache.set(data_ref, result_dict, cache_metadata)
            return {
                "success": True,
                "project": project_name,
                "task": task_name,
                "data_ref": data_ref,
                "statistics": summary,
                "metadata": {
                    "scenario": scenario,
                    "frequency": fGHz,
                    "angle": angle
                },
                "columns": list(result_dict.keys()),
                "note": "Use data_ref with plot_results to generate plots. Full data is cached on the server."
            }
        
        except Exception as e:
            logger.error(f"Result download failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Failed to download results: {str(e)}"
            }
    
    def _summarize_results(self, result_dict: Dict) -> str:
        """Summarize result data for LLM consumption with detailed statistics"""
        summary_parts = []
        
        for key, value in result_dict.items():
            if isinstance(value, (list, np.ndarray)):
                if len(value) > 0:
                    value_array = np.array(value).flatten()  # Flatten in case of multi-dimensional
                    
                    # Calculate detailed statistics
                    min_val = value_array.min()
                    max_val = value_array.max()
                    mean_val = value_array.mean()
                    std_val = value_array.std()
                    
                    summary_parts.append(
                        f"{key}: array with {len(value_array)} values "
                        f"(min={min_val:.4f}, max={max_val:.4f}, "
                        f"mean={mean_val:.4f}, std={std_val:.4f})"
                    )
                    
                    # Add sample values if array is small enough
                    if len(value_array) <= 10:
                        values_str = ", ".join([f"{v:.4f}" for v in value_array])
                        summary_parts.append(f"  Values: [{values_str}]")
                else:
                    summary_parts.append(f"{key}: empty array")
            elif isinstance(value, (int, float)):
                summary_parts.append(f"{key}: {value:.4f}")
            else:
                summary_parts.append(f"{key}: {value}")
        
        return "\n".join(summary_parts)
    
    def _convert_to_csv(self, result_dict: Dict) -> str:
        """Convert result dictionary to CSV format string"""
        if not result_dict:
            return ""
        
        # Collect all keys and determine max length
        keys = list(result_dict.keys())
        max_len = 0
        
        # Convert all values to arrays and find max length
        arrays = {}
        for key, value in result_dict.items():
            if isinstance(value, (list, np.ndarray)):
                arr = np.array(value).flatten()
                arrays[key] = arr
                max_len = max(max_len, len(arr))
            elif isinstance(value, (int, float)):
                # Single values become arrays of length 1
                arrays[key] = np.array([value])
                max_len = max(max_len, 1)
            else:
                # Non-numeric values as strings
                arrays[key] = [str(value)]
                max_len = max(max_len, 1)
        
        # Build CSV header
        csv_lines = [",".join(keys)]
        
        # Build CSV rows
        for i in range(max_len):
            row = []
            for key in keys:
                arr = arrays[key]
                if i < len(arr):
                    val = arr[i]
                    if isinstance(val, (int, float, np.number)):
                        row.append(f"{val:.6f}")
                    else:
                        row.append(str(val))
                else:
                    row.append("")  # Empty if array is shorter
            csv_lines.append(",".join(row))
        
        return "\n".join(csv_lines)

