from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
import logging

from app.models.credit import CreditResponse
from app.services import CreditService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=CreditResponse)
async def get_credits(authorization: str = Header(..., description="Bearer token")):
    """
    Query user's credit balance
    
    - **authorization**: Bearer token in format "Bearer {token}"
    
    Returns the user's current credit balance
    """
    try:
        # Extract token from "Bearer {token}" format
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": {
                        "code": "INVALID_TOKEN_FORMAT",
                        "message": "Authorization header must be in format 'Bearer {token}'"
                    }
                }
            )
        
        success, credits, message = await CreditService.get_credits(token)
        
        if success:
            return CreditResponse(
                success=True,
                credits=credits,
                message=message
            )
        else:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": {
                        "code": "CREDIT_QUERY_FAILED",
                        "message": message
                    }
                }
            )
    
    except Exception as e:
        logger.error(f"Error in get_credits: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Failed to query credits"
                }
            }
        )

