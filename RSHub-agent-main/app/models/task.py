from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class TaskSubmitRequest(BaseModel):
    """Request body for task submission"""
    token: str = Field(..., description="User's RSHub authentication token")
    project_name: str = Field(..., description="Project name")
    task_name: str = Field(..., description="Task name")
    task_data: Dict[str, Any] = Field(..., description="Task configuration data")
    
    class Config:
        json_schema_extra = {
            "example": {
                "token": "your_rshub_token",
                "project_name": "soil_modeling_2024",
                "task_name": "aiem_test_01",
                "task_data": {
                    "scenario_flag": 1,
                    "algorithm": "aiem",
                    "theta_i_deg": 40.0,
                    "phi_s_deg": 0.0,
                    "kl": 0.3,
                    "ks": 2.5
                }
            }
        }


class TaskSubmitResponse(BaseModel):
    """Response for task submission"""
    success: bool
    project_name: str
    task_name: str
    message: Optional[str] = None
    task_id: Optional[str] = None


class TaskStatusResponse(BaseModel):
    """Response for task status check"""
    success: bool
    project_name: str
    task_name: str
    status: str
    message: Optional[str] = None
    completed: bool = False


class TaskDownloadResponse(BaseModel):
    """Response for task result download"""
    success: bool
    project_name: str
    task_name: str
    download_url: Optional[str] = None
    message: Optional[str] = None

