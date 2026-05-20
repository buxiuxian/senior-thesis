from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import Optional
import logging

from app.models.agent import ChatRequest, ChatResponse, ChatListResponse
from app.services.agent.agent_orchestrator import AgentOrchestrator
from app.services.llm_service import get_llm_service
from app.services.tools.tool_registry import ToolRegistry
from app.services.tools import FetchPaperTool, SubmitTaskTool, DownloadResultTool, PlotResultsTool, ReadParametersTool
from app.services.chat_service import get_chat_service
from app.services.rshub_service import RSHubService
from app.services.credit_service import get_credit_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services and tools
def _get_agent_orchestrator() -> AgentOrchestrator:
    """Initialize and return agent orchestrator with all tools"""
    # Initialize services
    llm_service = get_llm_service()
    chat_service = get_chat_service()
    rshub_service = RSHubService()
    credit_service = get_credit_service()
    
    # Initialize tool registry
    tool_registry = ToolRegistry()
    
    # Register tools
    tool_registry.register(FetchPaperTool())
    tool_registry.register(SubmitTaskTool(
        rshub_service=rshub_service,
        credit_service=credit_service
    ))
    tool_registry.register(DownloadResultTool(
        rshub_service=rshub_service
    ))
    tool_registry.register(PlotResultsTool())
    tool_registry.register(ReadParametersTool(
        rshub_service=rshub_service
    ))
    
    # Create orchestrator
    return AgentOrchestrator(
        llm_service=llm_service,
        tool_registry=tool_registry,
        chat_service=chat_service,
        credit_service=credit_service
    )


@router.post("/chat", response_model=ChatResponse)
async def agent_chat(request: ChatRequest):
    """
    Agent chat endpoint with tool calling support
    
    The agent can:
    - Answer questions directly
    - Fetch scientific papers when needed
    - Submit RSHub computational tasks
    - Download task results
    
    Request body:
    {
        "message": "user message",
        "chat_id": "optional session id",
        "token": "user rshub token"
    }
    """
    try:
        logger.info(f"Agent chat request: {request.message[:50]}...")
        
        # Validate token
        if not request.token:
            raise HTTPException(status_code=401, detail="Token is required")
        
        # Get agent orchestrator
        agent = _get_agent_orchestrator()
        
        # Run agent
        result = await agent.run(
            user_message=request.message,
            user_token=request.token,
            chat_id=request.chat_id
        )
        
        if result.get("success"):
            return ChatResponse(
                success=True,
                response=result.get("response", ""),
                chat_id=result.get("chat_id"),
                tool_calls_made=result.get("tool_calls_made", 0)
            )
        else:
            return ChatResponse(
                success=False,
                response="",
                error=result.get("error", "Unknown error"),
                chat_id=request.chat_id
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent chat failed: {e}", exc_info=True)
        return ChatResponse(
            success=False,
            response="",
            error=str(e),
            chat_id=request.chat_id
        )


@router.post("/chat/stream")
async def agent_chat_stream(request: ChatRequest):
    """
    Agent chat endpoint with streaming support
    
    Returns Server-Sent Events (SSE) stream with:
    - type: "thinking" - Agent is thinking
    - type: "tool_call" - Tool is being called
    - type: "tool_result" - Tool execution result
    - type: "content" - Content delta (streamed text)
    - type: "done" - Stream complete
    - type: "error" - Error occurred
    """
    try:
        logger.info(f"Agent streaming chat request: {request.message[:50]}...")
        
        # Validate token
        if not request.token:
            raise HTTPException(status_code=401, detail="Token is required")
        
        # Prepare attachments data if provided
        attachments_list = None
        if request.attachments:
            attachments_list = [
                {
                    'filename': att.filename,
                    'content': att.content,
                    'file_type': att.file_type
                }
                for att in request.attachments
            ]
            logger.info(f"Request includes {len(attachments_list)} attachment(s): {[a['filename'] for a in attachments_list]}")
        
        # Get agent orchestrator
        agent = _get_agent_orchestrator()
        
        # Create async generator for SSE
        async def event_generator():
            async for event in agent.run_streaming(
                user_message=request.message,
                user_token=request.token,
                chat_id=request.chat_id,
                attachments=attachments_list
            ):
                yield event
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent streaming chat failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions", response_model=ChatListResponse)
async def list_chat_sessions(authorization: Optional[str] = Header(None)):
    """
    List all chat sessions for the user
    
    Headers:
        Authorization: Bearer {token}
    """
    try:
        # Extract token from Authorization header
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        token = authorization.replace("Bearer ", "")
        
        # Get chat service
        chat_service = get_chat_service()
        
        # List sessions
        sessions = await chat_service.list_sessions(token)
        
        logger.info(f"Listed {len(sessions)} chat sessions")
        
        return ChatListResponse(
            success=True,
            sessions=sessions
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List sessions failed: {e}", exc_info=True)
        return ChatListResponse(
            success=False,
            sessions=[],
            error=str(e)
        )


@router.get("/sessions/{session_id}")
async def get_session_details(session_id: str, authorization: Optional[str] = Header(None)):
    """
    Get details of a specific chat session including message history
    
    Headers:
        Authorization: Bearer {token}
    """
    try:
        # Extract token from Authorization header
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        token = authorization.replace("Bearer ", "")
        
        # Get chat service
        chat_service = get_chat_service()
        
        # Load session
        session_data = await chat_service.load_session(token, session_id)
        
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return session_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get session details failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/create")
async def create_empty_session(authorization: Optional[str] = Header(None)):
    """
    Create a new empty chat session
    
    Headers:
        Authorization: Bearer {token}
    
    Returns:
        {
            "success": true,
            "session_id": "1234567890123",
            "title": "Empty Chat"
        }
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        token = authorization.replace("Bearer ", "")
        
        chat_service = get_chat_service()
        
        result = await chat_service.create_empty_session(token, title="Empty Chat")
        
        if result.get("success"):
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to create session"))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create empty session failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Delete a chat session
    
    Note: The delete-chat API doesn't require a token, but we validate
    that the user is authenticated before allowing deletion.
    
    Headers:
        Authorization: Bearer {token}
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        chat_service = get_chat_service()
        success = await chat_service.delete_session("", session_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete session")
        
        return {
            "success": True,
            "message": "Session deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete session failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


