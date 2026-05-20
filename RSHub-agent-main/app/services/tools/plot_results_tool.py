"""
Tool for executing Python code to generate plots
"""

import logging
import asyncio
import uuid
from typing import Any, Dict
from datetime import datetime
from pathlib import Path
from .base import BaseTool
from app.services.result_cache import result_cache

logger = logging.getLogger(__name__)


class PlotResultsTool(BaseTool):
    """Tool to execute Python plotting code and return generated images"""
    
    def __init__(self, plots_dir: str = "app/static/plots"):
        self.plots_dir = Path(plots_dir)
        self.plots_dir.mkdir(parents=True, exist_ok=True)
    
    @property
    def name(self) -> str:
        return "plot_results"
    
    @property
    def description(self) -> str:
        return """Execute Python code to generate plots from RSHub task results using matplotlib.
Use this when user wants to visualize data, create plots, or compare results graphically.

Constraints:
- You MUST use matplotlib.pyplot for all plotting. No other plotting libraries allowed.
- Do NOT call plt.savefig() or plt.show() - the tool handles file saving automatically.
- Maximum execution time is 10 seconds.

Execution environment:
- matplotlib.pyplot is available as plt, numpy as np.
- result_data: a dict loaded from download_task_result cache, containing full numeric arrays keyed by field name.

Common data fields in result_data (varies by scenario and output mode):
- Passive microwave: TBv, TBh (brightness temperature arrays across angles in K), deg0 (sampling angles in degrees), Tb_v0/Tb_h0 (single-angle values).
- Active microwave: vvdb, vhdb, hvdb, hhdb (backscatter coefficients in dB).
- Observation metadata: ob_angle (observation angles), frequency (GHz).
- Multi-time-point datasets may contain observation_data and simulated_data dicts keyed by time strings, each holding Tb_v_obs, Tb_h_obs, Tb_v, Tb_h arrays.

Typical visualization tasks include:
- Angular profiles of brightness temperature or backscatter across observation angles.
- Time series showing temporal evolution of radiometric quantities.
- Observed vs simulated comparisons with statistical annotations (RMSE, bias).
- Derived quantities such as polarization difference (V-H), emissivity, or obs-sim residuals.
- Multi-panel layouts comparing multiple angles, frequencies, or scenarios side by side.

You must write the complete plotting code yourself based on the user request and the data available in result_data. Inspect result_data keys if unsure about field names.
"""
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code using matplotlib.pyplot to create plots. Must import matplotlib.pyplot as plt."
                },
                "data_ref": {
                    "type": "string",
                    "description": "Reference id returned by download_task_result. Used to load cached result data. Either data_ref or data_context must be provided."
                },
                "project_name": {
                    "type": "string",
                    "description": "Project name for refetching data when cache is missing."
                },
                "task_name": {
                    "type": "string",
                    "description": "Task name for refetching data when cache is missing."
                },
                "data_context": {
                    "type": "string",
                    "description": "Optional JSON-encoded data dictionary for plotting when data_ref is not available. Normally you should use data_ref from download_task_result instead."
                }
            },
            "required": ["code"]
        }
    
    async def execute(self, code: str, data_ref: str = None, data_context: Any = None) -> Dict[str, Any]:
        """Execute Python plotting code in a sandboxed environment"""
        try:
            # Validate code contains matplotlib
            if 'matplotlib' not in code and 'plt' not in code:
                return {
                    "success": False,
                    "error": "Code must use matplotlib.pyplot for plotting. Import it as 'import matplotlib.pyplot as plt'"
                }

            # Parse data_context if passed as JSON string
            if isinstance(data_context, str):
                import json
                try:
                    data_context = json.loads(data_context)
                except (json.JSONDecodeError, TypeError):
                    data_context = None

            if data_context is None and data_ref:
                cached = result_cache.get(data_ref)
                if cached:
                    data_context = cached.get("result", {})
            
            if data_context is None:
                return {
                    "success": False,
                    "error": "Missing data_ref or data_context. Call download_task_result to obtain a valid data_ref."
                }
            
            # Prepare execution environment
            exec_globals = {
                'result_data': data_context or {},
                '__builtins__': __builtins__
            }
            
            # Execute with timeout
            plot_result = await asyncio.wait_for(
                self._execute_plotting_code(code, exec_globals),
                timeout=10.0
            )
            
            return plot_result
            
        except asyncio.TimeoutError:
            logger.error("Plot execution timed out")
            return {
                "success": False,
                "error": "Code execution timed out (maximum 10 seconds allowed)"
            }
        except Exception as e:
            logger.error(f"Plot execution failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Execution error: {str(e)}"
            }
    
    async def _execute_plotting_code(self, code: str, exec_globals: Dict) -> Dict[str, Any]:
        """Execute code and capture matplotlib figure"""
        import matplotlib
        matplotlib.use('Agg')  # Non-interactive backend
        import matplotlib.pyplot as plt
        import numpy as np
        
        # Make libraries available
        exec_globals['plt'] = plt
        exec_globals['matplotlib'] = matplotlib
        exec_globals['np'] = np
        
        try:
            # Execute user code
            exec(code, exec_globals)
            
            # Capture all figures
            figures = [plt.figure(n) for n in plt.get_fignums()]
            
            if not figures:
                plt.close('all')
                return {
                    "success": False,
                    "error": "No plots were generated. Make sure to create figures using plt.figure() or plt.plot()"
                }
            
            # Save the first figure
            fig = figures[0]
            
            # Generate unique filename
            plot_id = f"plot_{uuid.uuid4().hex[:12]}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            filename = f"{plot_id}.png"
            filepath = self.plots_dir / filename
            
            # Save figure with high quality
            fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor='white')
            plt.close('all')
            
            logger.info(f"Plot saved: {filename}")
            
            return {
                "success": True,
                "plot_id": plot_id,
                "filename": filename,
                "url": f"/static/plots/{filename}",
                "message": f"Plot generated successfully. Image saved as {filename}",
                "note": "Include this in your response: ![Plot visualization](/static/plots/" + filename + ")"
            }
            
        except Exception as e:
            plt.close('all')
            raise e


