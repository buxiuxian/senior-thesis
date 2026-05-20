import logging
import zipfile
import io
import json
import numpy as np
from typing import Dict, Any, Tuple, List
from rshub import submit_jobs, load_file

logger = logging.getLogger(__name__)


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for numpy types"""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, (complex, np.complexfloating)):
            return {"real": obj.real, "imag": obj.imag}
        return super().default(obj)


class RSHubService:
    """Service for interacting with RSHub Python SDK"""
    
    @staticmethod
    async def submit_task(token: str, project_name: str, task_name: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit a computational task to RSHub
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
            task_data: Task configuration data
        
        Returns:
            Dict with success status and message
        """
        try:
            task_data_with_auth = {
                **task_data,
                "token": token,
                "project_name": project_name,
                "task_name": task_name,
                "force_update_flag": 1
            }
            
            result = submit_jobs.run(task_data_with_auth)
            logger.info(f"RSHub submission result: {result}")
            
            if result.get('result') == 'Job submitted!':
                logger.info(f"Task submitted successfully: {project_name}/{task_name}")
                return {
                    "success": True,
                    "message": f"Task {task_name} submitted successfully",
                    "status": "queued"
                }
            else:
                error_msg = result.get('result', 'Unknown error')
                logger.error(f"Task submission failed: {error_msg}")
                return {
                    "success": False,
                    "error": f"RSHub error: {error_msg}"
                }
            
        except Exception as e:
            logger.error(f"Failed to submit task {project_name}/{task_name}: {e}")
            return {
                "success": False,
                "error": f"Failed to submit task: {str(e)}"
            }
    
    @staticmethod
    def check_task_status(token: str, project_name: str, task_name: str) -> Tuple[bool, str, bool]:
        """
        Check the status of a submitted task
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
        
        Returns:
            Tuple of (success, status_message, is_completed)
        """
        try:
            result = submit_jobs.check_completion(token, project_name, task_name)
            logger.info(f"RSHub check_completion result: {result}")
            
            if isinstance(result, str):
                is_completed = "completed" in result.lower()
                status = "completed" if is_completed else "in progress"
            elif isinstance(result, dict):
                # rshub 0.3.3+ returns dict with 'task_status' key
                task_status = result.get('task_status', 'unknown')
                status = task_status
                is_completed = task_status == 'completed'
            else:
                logger.warning(f"Unexpected result type: {type(result)}")
                is_completed = False
                status = "unknown"
            
            logger.info(f"Task status: {project_name}/{task_name} - {status}")
            return True, status, is_completed
            
        except Exception as e:
            logger.error(f"Failed to check task status {project_name}/{task_name}: {e}")
            return False, f"Failed to check status: {str(e)}", False
    
    @staticmethod
    def load_task_result(token: str, project_name: str, task_name: str,
                        fGHz: float, scenario_flag: str, algorithm: str, output_var: str,
                        angle: float = None) -> Dict[str, Any]:
        """
        Load task result data using RSHub Python SDK (v0.3.3+)
        
        Uses filename-based loading to avoid algorithm-specific file naming issues.
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
            fGHz: Frequency in GHz
            scenario_flag: Scenario type ('soil'/'snow'/'veg')
            algorithm: Algorithm name ('qms'/'bic'/'tri' for snow, 'fullwave_volume' for soil, 'rt' for veg)
            output_var: Output type ('sigma'/'bs' for active, 'tb' for passive)
            angle: Incident angle (optional, used for finding matching file if needed)
        
        Returns:
            Dictionary containing result data
        """
        try:
            data_loader = load_file(
                token=token,
                project_name=project_name,
                task_name=task_name,
                scenario_flag=scenario_flag,
                algorithm=algorithm,
                output_var=output_var
            )
            
            files = data_loader.list_files()
            logger.info(f"Available files for {project_name}/{task_name}: {files}")
            
            target_file = None
            for f in files:
                if f'fGHz{fGHz}' in f or f'GHz{fGHz}' in f:
                    if algorithm == 'tri':
                        if 'angle' not in f:
                            target_file = f
                            break
                    else:
                        if angle is not None:
                            if f'angle{angle}' in f or f'angle{int(angle)}' in f:
                                target_file = f
                                break
                        else:
                            if 'angle' not in f:
                                target_file = f
                                break
            
            if target_file:
                logger.info(f"Loading file directly: {target_file}")
                result_dict = data_loader.load_outputs(filename=target_file)
            else:
                logger.warning(f"No matching file found for fGHz={fGHz}, angle={angle}. Trying parameter-based loading...")
                if angle is not None:
                    result_dict = data_loader.load_outputs(fGHz=fGHz, inc_ang=angle)
                else:
                    result_dict = data_loader.load_outputs(fGHz=fGHz)
            
            logger.info(f"Loaded result for {project_name}/{task_name}, keys: {list(result_dict.keys())}")
            
            return result_dict
            
        except Exception as e:
            logger.error(f"Failed to load task result {project_name}/{task_name}: {e}")
            raise
    
    @staticmethod
    def load_task_parameters(token: str, project_name: str, task_name: str) -> Dict[str, Any]:
        """
        Load task submission parameters using RSHub Python SDK (v0.3.4+)
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
        
        Returns:
            Dictionary containing original submission parameters
        """
        try:
            data_loader = load_file(
                token=token,
                project_name=project_name,
                task_name=task_name,
                scenario_flag="snow",
                algorithm="qms",
                output_var="tb"
            )
            
            params = data_loader.load_parameters()
            logger.info(f"Loaded parameters for {project_name}/{task_name}")
            
            return params
            
        except Exception as e:
            logger.error(f"Failed to load task parameters {project_name}/{task_name}: {e}")
            raise
    
    @staticmethod
    def list_task_files(token: str, project_name: str, task_name: str,
                       scenario_flag: str, algorithm: str, output_var: str) -> List[str]:
        """
        List all available output files for a task using RSHub Python SDK (v0.3.5+)
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
            scenario_flag: Scenario type
            algorithm: Algorithm name
            output_var: Output variable type
        
        Returns:
            List of file names
        """
        try:
            data_loader = load_file(
                token=token,
                project_name=project_name,
                task_name=task_name,
                scenario_flag=scenario_flag,
                algorithm=algorithm,
                output_var=output_var
            )
            
            files = data_loader.list_files()
            logger.info(f"Found {len(files)} files for {project_name}/{task_name}")
            
            return files
            
        except Exception as e:
            logger.error(f"Failed to list task files {project_name}/{task_name}: {e}")
            raise
    
    @staticmethod
    def download_multiple_files(token: str, project_name: str, task_name: str,
                                scenario_flag: str, algorithm: str, output_var: str,
                                filenames: List[str]) -> bytes:
        """
        Download multiple files and package them as a zip archive
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
            scenario_flag: Scenario type
            algorithm: Algorithm name
            output_var: Output variable type
            filenames: List of file names to download
        
        Returns:
            Zip file content as bytes
        """
        try:
            data_loader = load_file(
                token=token,
                project_name=project_name,
                task_name=task_name,
                scenario_flag=scenario_flag,
                algorithm=algorithm,
                output_var=output_var
            )
            
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for filename in filenames:
                    try:
                        file_data = data_loader.load_outputs(filename=filename)
                        
                        file_content = ""
                        if isinstance(file_data, dict):
                            file_content = json.dumps(file_data, indent=2, cls=NumpyEncoder)
                        elif isinstance(file_data, str):
                            file_content = file_data
                        else:
                            file_content = str(file_data)
                        
                        json_filename = filename.rsplit('.', 1)[0] + '.json' if '.' in filename else filename + '.json'
                        zip_file.writestr(json_filename, file_content)
                        logger.info(f"Added {json_filename} to zip archive")
                    except Exception as e:
                        logger.error(f"Failed to download {filename}: {e}")
                        zip_file.writestr(f"{filename}.error.txt", f"Failed to download: {str(e)}")
            
            zip_buffer.seek(0)
            return zip_buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Failed to create zip archive for {project_name}/{task_name}: {e}")
            raise
    
    @staticmethod
    def download_single_file(token: str, project_name: str, task_name: str,
                            scenario_flag: str, algorithm: str, output_var: str,
                            filename: str) -> str:
        """
        Download a single file and return its content
        
        Args:
            token: User authentication token
            project_name: Project name
            task_name: Task name
            scenario_flag: Scenario type
            algorithm: Algorithm name
            output_var: Output variable type
            filename: File name to download
        
        Returns:
            File content as string
        """
        try:
            data_loader = load_file(
                token=token,
                project_name=project_name,
                task_name=task_name,
                scenario_flag=scenario_flag,
                algorithm=algorithm,
                output_var=output_var
            )
            
            file_data = data_loader.load_outputs(filename=filename)
            
            if isinstance(file_data, dict):
                return json.dumps(file_data, indent=2, cls=NumpyEncoder)
            elif isinstance(file_data, str):
                return file_data
            else:
                return str(file_data)
            
        except Exception as e:
            logger.error(f"Failed to download {filename} from {project_name}/{task_name}: {e}")
            raise

