from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import JSONResponse, StreamingResponse
import logging
import io

from app.models.task import (
    TaskSubmitRequest,
    TaskSubmitResponse,
    TaskStatusResponse,
    TaskDownloadResponse
)
from app.models.common import ErrorResponse, ErrorDetail
from app.services import RSHubService, CreditService
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/submit", response_model=TaskSubmitResponse)
async def submit_task(request: TaskSubmitRequest):
    """
    Submit a computational task to RSHub
    
    - **token**: RSHub authentication token
    - **project_name**: Project name for organization
    - **task_name**: Unique task identifier
    - **task_data**: Task configuration (scenario, algorithm, parameters)
    
    Credit will be deducted upon successful submission
    """
    try:
        # Step 1: Check if user has sufficient credits
        has_enough, check_message, _ = await CreditService.check_credits(
            request.token, 
            settings.TASK_SUBMIT_COST
        )
        
        if not has_enough:
            logger.warning(f"Insufficient credits for task submission: {check_message}")
            return JSONResponse(
                status_code=402,
                content={
                    "success": False,
                    "error": {
                        "code": "INSUFFICIENT_CREDITS",
                        "message": check_message
                    }
                }
            )
        
        # Step 2: Submit task to RSHub
        submit_result = await RSHubService.submit_task(
            token=request.token,
            project_name=request.project_name,
            task_name=request.task_name,
            task_data=request.task_data
        )
        
        if not submit_result.get("success"):
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": {
                        "code": "TASK_SUBMISSION_FAILED",
                        "message": submit_result.get("error", "Task submission failed")
                    }
                }
            )
        
        # Step 3: Deduct credits after successful submission
        deduct_success, deduct_message, remaining = await CreditService.deduct_credits(
            request.token,
            settings.TASK_SUBMIT_COST
        )
        
        if deduct_success:
            logger.info(f"Task submitted and {settings.TASK_SUBMIT_COST} credits deducted. Remaining: {remaining}")
            return TaskSubmitResponse(
                success=True,
                project_name=request.project_name,
                task_name=request.task_name,
                message=f"{submit_result.get('message', 'Task submitted successfully')}. {settings.TASK_SUBMIT_COST} credits deducted. Remaining: {remaining}"
            )
        else:
            logger.error(f"Task submitted but credit deduction failed: {deduct_message}")
            return TaskSubmitResponse(
                success=True,
                project_name=request.project_name,
                task_name=request.task_name,
                message=f"{submit_result.get('message', 'Task submitted successfully')}. Warning: Credit deduction failed - {deduct_message}"
            )
    
    except Exception as e:
        logger.error(f"Error in submit_task: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Failed to submit task"
                }
            }
        )


@router.get("/check", response_model=TaskStatusResponse)
async def check_task_status(
    token: str = Query(..., description="User authentication token"),
    project: str = Query(..., description="Project name"),
    task: str = Query(..., description="Task name")
):
    """
    Check the status of a submitted task
    
    - **token**: RSHub authentication token
    - **project**: Project name
    - **task**: Task name
    """
    try:
        success, status, is_completed = RSHubService.check_task_status(
            token=token,
            project_name=project,
            task_name=task
        )
        
        if success:
            return TaskStatusResponse(
                success=True,
                project_name=project,
                task_name=task,
                status=status,
                completed=is_completed,
                message=f"Task is {status}"
            )
        else:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": {
                        "code": "STATUS_CHECK_FAILED",
                        "message": status
                    }
                }
            )
    
    except Exception as e:
        logger.error(f"Error in check_task_status: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Failed to check task status"
                }
            }
        )


@router.get("/download")
async def download_task_result(
    token: str = Query(..., description="User authentication token"),
    project: str = Query(..., description="Project name"),
    task: str = Query(..., description="Task name"),
    fGHz: float = Query(None, description="Frequency in GHz (auto-retrieved if not specified)"),
    scenario: str = Query(None, description="Scenario flag: soil/snow/veg (auto-retrieved if not specified)"),
    algorithm: str = Query(None, description="Algorithm: qms/bic/fullwave_volume/rt (auto-retrieved if not specified)"),
    output_var: str = Query(None, description="Output variable: bs/tb (auto-retrieved if not specified)"),
    angle: float = Query(None, description="Incident angle (auto-retrieved if not specified)"),
    format: str = Query("csv", description="Output format: csv or txt")
):
    """
    Download completed task results as CSV or TXT file (RSHub SDK v0.3.3+)
    
    - **token**: RSHub authentication token
    - **project**: Project name
    - **task**: Task name
    - **fGHz**: Frequency (optional, auto-retrieved from metadata)
    - **scenario**: Scenario type (optional, auto-retrieved from metadata)
    - **algorithm**: Algorithm name (optional, auto-retrieved from metadata)
    - **output_var**: Output variable (optional, auto-retrieved from metadata)
    - **angle**: Incident angle (optional, auto-retrieved from metadata)
    - **format**: File format (csv or txt)
    
    Parameters are auto-retrieved from saved metadata. Manual specification is for backward compatibility.
    
    Returns a file stream that browsers will automatically download
    """
    try:
        # Try to retrieve parameters from RSHub if not provided
        if fGHz is None or scenario is None or algorithm is None or output_var is None:
            try:
                params = RSHubService.load_task_parameters(token, project, task)
                
                # Extract fGHz
                if fGHz is None:
                    fGHz_raw = params.get('fGHz')
                    fGHz = fGHz_raw[0] if isinstance(fGHz_raw, list) else fGHz_raw
                
                # Extract scenario
                if scenario is None:
                    scenario_raw = params.get('scenario_flag')
                    if isinstance(scenario_raw, int):
                        scenario_map = {1: 'soil', 2: 'snow', 3: 'veg'}
                        scenario = scenario_map.get(scenario_raw, 'soil')
                    else:
                        scenario = scenario_raw
                
                # Extract algorithm
                if algorithm is None:
                    algorithm = params.get('algorithm')
                
                # Extract output_var
                if output_var is None:
                    output_raw = params.get('output_var')
                    if isinstance(output_raw, int):
                        output_map = {1: 'bs', 2: 'tb'}
                        output_var = output_map.get(output_raw, 'bs')
                    else:
                        output_var = output_raw
                
                # Extract angle
                if angle is None:
                    angle_raw = params.get('angle') or params.get('theta_i_deg')
                    if isinstance(angle_raw, list):
                        angle = angle_raw[0] if angle_raw else None
                    else:
                        angle = angle_raw
                
                logger.info(f"Retrieved parameters from RSHub for {project}/{task}: fGHz={fGHz}, scenario={scenario}, algorithm={algorithm}, output_var={output_var}, angle={angle}")
                
            except Exception as e:
                logger.error(f"Failed to retrieve task parameters: {e}")
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "error": {
                            "code": "PARAMETER_RETRIEVAL_FAILED",
                            "message": "Failed to retrieve task parameters from RSHub. Please provide fGHz, scenario, algorithm, and output_var manually."
                        }
                    }
                )
        
        # Validate required parameters
        if fGHz is None or scenario is None or algorithm is None or output_var is None:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": {
                        "code": "MISSING_PARAMETERS",
                        "message": "Missing required parameters: fGHz, scenario, algorithm, and output_var"
                    }
                }
            )
        
        result_dict = RSHubService.load_task_result(
            token=token,
            project_name=project,
            task_name=task,
            fGHz=fGHz,
            scenario_flag=scenario,
            algorithm=algorithm,
            output_var=output_var,
            angle=angle
        )
        
        from app.utils.data_converter import dict_to_csv, dict_to_text
        
        if format == "txt":
            content = dict_to_text(result_dict)
            media_type = "text/plain"
            file_ext = "txt"
        else:
            content = dict_to_csv(result_dict)
            media_type = "text/csv"
            file_ext = "csv"
        
        filename = f"{task}.{file_ext}"
        
        return StreamingResponse(
            io.BytesIO(content.encode('utf-8')),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except Exception as e:
        logger.error(f"Error in download_task_result: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "DOWNLOAD_FAILED",
                    "message": f"Failed to download results: {str(e)}"
                }
            }
        )


@router.get("/list-files")
async def list_task_files(
    project: str = Query(..., description="Project name"),
    task: str = Query(..., description="Task name"),
    scenario: str = Query(None, description="Scenario flag (auto-retrieved if not specified)"),
    algorithm: str = Query(None, description="Algorithm (auto-retrieved if not specified)"),
    output_var: str = Query(None, description="Output variable (auto-retrieved if not specified)"),
    authorization: str = Header(None, alias="Authorization")
):
    """
    List all available output files for a task (RSHub SDK v0.3.5+)
    
    - **project**: Project name
    - **task**: Task name
    - **scenario**: Scenario type (optional, auto-retrieved from metadata)
    - **algorithm**: Algorithm name (optional, auto-retrieved from metadata)
    - **output_var**: Output variable (optional, auto-retrieved from metadata)
    
    Returns a list of available file names
    """
    try:
        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:]
        
        if not token:
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Missing or invalid authorization token"
                    }
                }
            )
        
        if scenario is None or algorithm is None or output_var is None:
            try:
                params = RSHubService.load_task_parameters(token, project, task)
                
                if scenario is None:
                    scenario_raw = params.get('scenario_flag')
                    if isinstance(scenario_raw, int):
                        scenario_map = {1: 'soil', 2: 'snow', 3: 'veg'}
                        scenario = scenario_map.get(scenario_raw, 'soil')
                    else:
                        scenario = scenario_raw
                
                if algorithm is None:
                    algorithm = params.get('algorithm')
                
                if output_var is None:
                    output_raw = params.get('output_var')
                    if isinstance(output_raw, int):
                        output_map = {1: 'bs', 2: 'tb'}
                        output_var = output_map.get(output_raw, 'bs')
                    else:
                        output_var = output_raw
                
            except Exception as e:
                logger.error(f"Failed to retrieve task parameters: {e}")
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "error": {
                            "code": "PARAMETER_RETRIEVAL_FAILED",
                            "message": "Failed to retrieve task parameters"
                        }
                    }
                )
        
        files = RSHubService.list_task_files(
            token=token,
            project_name=project,
            task_name=task,
            scenario_flag=scenario,
            algorithm=algorithm,
            output_var=output_var
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "files": files,
                "count": len(files)
            }
        )
    
    except Exception as e:
        logger.error(f"Error listing task files: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "LIST_FILES_FAILED",
                    "message": f"Failed to list files: {str(e)}"
                }
            }
        )


@router.post("/download-files")
async def download_selected_files(
    project: str = Query(..., description="Project name"),
    task: str = Query(..., description="Task name"),
    filenames: str = Query(..., description="Comma-separated list of file names"),
    scenario: str = Query(None, description="Scenario flag (auto-retrieved if not specified)"),
    algorithm: str = Query(None, description="Algorithm (auto-retrieved if not specified)"),
    output_var: str = Query(None, description="Output variable (auto-retrieved if not specified)"),
    authorization: str = Header(None, alias="Authorization")
):
    """
    Download selected files from a task (RSHub SDK v0.3.5+)
    
    - **project**: Project name
    - **task**: Task name
    - **filenames**: Comma-separated file names (e.g., "file1.csv,file2.mat")
    - **scenario**: Scenario type (optional, auto-retrieved from metadata)
    - **algorithm**: Algorithm name (optional, auto-retrieved from metadata)
    - **output_var**: Output variable (optional, auto-retrieved from metadata)
    
    Returns:
    - Single file: File stream (if only one file selected)
    - Multiple files: ZIP archive containing all selected files
    """
    try:
        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:]
        
        if not token:
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Missing or invalid authorization token"
                    }
                }
            )
        
        if scenario is None or algorithm is None or output_var is None:
            try:
                params = RSHubService.load_task_parameters(token, project, task)
                
                if scenario is None:
                    scenario_raw = params.get('scenario_flag')
                    if isinstance(scenario_raw, int):
                        scenario_map = {1: 'soil', 2: 'snow', 3: 'veg'}
                        scenario = scenario_map.get(scenario_raw, 'soil')
                    else:
                        scenario = scenario_raw
                
                if algorithm is None:
                    algorithm = params.get('algorithm')
                
                if output_var is None:
                    output_raw = params.get('output_var')
                    if isinstance(output_raw, int):
                        output_map = {1: 'bs', 2: 'tb'}
                        output_var = output_map.get(output_raw, 'bs')
                    else:
                        output_var = output_raw
                
            except Exception as e:
                logger.error(f"Failed to retrieve task parameters: {e}")
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "error": {
                            "code": "PARAMETER_RETRIEVAL_FAILED",
                            "message": "Failed to retrieve task parameters"
                        }
                    }
                )
        
        file_list = [f.strip() for f in filenames.split(',') if f.strip()]
        
        if len(file_list) == 0:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": {
                        "code": "NO_FILES_SELECTED",
                        "message": "No files selected for download"
                    }
                }
            )
        
        if len(file_list) == 1:
            file_content = RSHubService.download_single_file(
                token=token,
                project_name=project,
                task_name=task,
                scenario_flag=scenario,
                algorithm=algorithm,
                output_var=output_var,
                filename=file_list[0]
            )
            
            original_filename = file_list[0]
            json_filename = original_filename.rsplit('.', 1)[0] + '.json' if '.' in original_filename else original_filename + '.json'
            
            return StreamingResponse(
                io.BytesIO(file_content.encode('utf-8')),
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{json_filename}"'
                }
            )
        else:
            zip_content = RSHubService.download_multiple_files(
                token=token,
                project_name=project,
                task_name=task,
                scenario_flag=scenario,
                algorithm=algorithm,
                output_var=output_var,
                filenames=file_list
            )
            
            zip_filename = f"{task}_results.zip"
            
            return StreamingResponse(
                io.BytesIO(zip_content),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename={zip_filename}"
                }
            )
    
    except Exception as e:
        logger.error(f"Error downloading files: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "DOWNLOAD_FAILED",
                    "message": f"Failed to download files: {str(e)}"
                }
            }
        )

