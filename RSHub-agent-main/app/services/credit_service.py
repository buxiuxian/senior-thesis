import logging
import httpx
from typing import Tuple, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class CreditService:
    """Service for querying and managing user credit balance"""
    
    @staticmethod
    async def check_credits(token: str, required_credits: int) -> Tuple[bool, str, Optional[int]]:
        """
        Check if user has sufficient credits
        
        Args:
            token: User authentication token
            required_credits: Required credit amount
        
        Returns:
            Tuple of (has_enough, message, current_balance)
        """
        try:
            async with httpx.AsyncClient(verify=settings.VERIFY_SSL) as client:
                response = await client.post(
                    f"{settings.RSHUB_BASE_URL}/users/api/Check-credits",
                    json={"token": token, "credits": required_credits},
                    headers={"Content-Type": "application/json"},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    has_enough = data.get("logic", False)
                    message = data.get("message", "")
                    
                    if has_enough:
                        return True, "Sufficient credits", None
                    else:
                        return False, message or "Insufficient credits", None
                else:
                    logger.error(f"Credit check API returned status {response.status_code}")
                    return False, f"Failed to check credits: HTTP {response.status_code}", None
                    
        except httpx.TimeoutException:
            logger.error("Credit check timed out")
            return False, "Request timed out", None
        except Exception as e:
            logger.warning(f"Credit check failed (continuing anyway in dev mode): {e}")
            # 在开发环境中，如果证书验证失败，仍然允许继续使用 Agent
            if not settings.VERIFY_SSL:
                return True, "Credit check skipped due to SSL issue (dev mode)", 999
            return False, f"Error: {str(e)}", None
    
    @staticmethod
    async def deduct_credits(token: str, amount: int) -> Tuple[bool, str, Optional[int]]:
        """
        Deduct credits from user account
        
        Args:
            token: User authentication token
            amount: Credit amount to deduct (positive number)
        
        Returns:
            Tuple of (success, message, remaining_credits)
        """
        try:
            async with httpx.AsyncClient(verify=settings.VERIFY_SSL) as client:
                response = await client.post(
                    f"{settings.RSHUB_BASE_URL}/users/api/Update-credits",
                    json={"token": token, "credits": -amount},
                    headers={"Content-Type": "application/json"},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    success = data.get("result", False)
                    message = data.get("message", "")
                    remaining = data.get("credits")
                    
                    if success:
                        logger.info(f"Credits deducted: {amount}, remaining: {remaining}")
                        return True, "Credits deducted successfully", remaining
                    else:
                        logger.error(f"Credit deduction failed: {message}")
                        return False, message or "Failed to deduct credits", remaining
                else:
                    logger.error(f"Credit update API returned status {response.status_code}")
                    return False, f"Failed to update credits: HTTP {response.status_code}", None
                    
        except httpx.TimeoutException:
            logger.error("Credit deduction timed out")
            return False, "Request timed out", None
        except Exception as e:
            logger.error(f"Failed to deduct credits: {e}")
            return False, f"Error: {str(e)}", None
    
    @staticmethod
    async def get_credits(token: str) -> Tuple[bool, Optional[int], str]:
        """
        Query user's credit balance from RSHub
        
        Args:
            token: User authentication token
        
        Returns:
            Tuple of (success, credits, message)
        """
        try:
            async with httpx.AsyncClient(verify=settings.VERIFY_SSL) as client:
                response = await client.post(
                    f"{settings.RSHUB_BASE_URL}/users/api/Check-credits",
                    json={"token": token, "credits": 0},
                    headers={"Content-Type": "application/json"},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    credits = data.get("credits")
                    
                    if credits is not None:
                        logger.info(f"Credit query successful: {credits}")
                        return True, credits, "Credit balance retrieved successfully"
                    else:
                        logger.warning("Credits field not found in response")
                        return False, None, "Invalid response from RSHub"
                else:
                    logger.error(f"Credit API returned status {response.status_code}")
                    return False, None, f"Failed to query credits: HTTP {response.status_code}"
                    
        except httpx.TimeoutException:
            logger.error("Credit query timed out")
            return False, None, "Request timed out"
        except Exception as e:
            logger.error(f"Failed to query credits: {e}")
            return False, None, f"Error: {str(e)}"


# Global instance
_credit_service = None


def get_credit_service() -> CreditService:
    """Get global credit service instance"""
    global _credit_service
    if _credit_service is None:
        _credit_service = CreditService()
    return _credit_service

