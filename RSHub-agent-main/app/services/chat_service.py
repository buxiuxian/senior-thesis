"""
Chat session management service using RSHub Chat API
"""

import json
import requests
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ChatService:
    """Service for managing chat sessions via RSHub Chat API"""
    
    def __init__(self, rshub_api_base: str = "https://rshub.zju.edu.cn"):
        self.rshub_api_base = rshub_api_base
    
    async def create_session(
        self,
        token: str,
        user_prompt: str,
        ai_response: str
    ) -> Dict[str, Any]:
        """
        Create a new chat session
        
        Args:
            token: User's RSHub token
            user_prompt: User's first message
            ai_response: AI's response
            
        Returns:
            Dict with session_id, title, and success status
        """
        try:
            session_id = str(int(datetime.now().timestamp() * 1000))
            
            title = user_prompt[:20] + "..." if len(user_prompt) > 20 else user_prompt
            
            session_data = {
                "session_id": session_id,
                "title": title,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "messages": [
                    {
                        "role": "user",
                        "content": user_prompt,
                        "timestamp": datetime.now().isoformat()
                    },
                    {
                        "role": "assistant",
                        "content": ai_response,
                        "timestamp": datetime.now().isoformat()
                    }
                ]
            }
            
            success = await self._save_session_to_rshub(token, session_id, session_data)
            
            if success:
                logger.info(f"Session {session_id} created successfully")
                return {
                    "success": True,
                    "session_id": session_id,
                    "title": title
                }
            else:
                logger.error(f"Session {session_id} creation failed")
                return {
                    "success": False,
                    "session_id": session_id,
                    "title": title,
                    "error": "Failed to save session"
                }
        
        except Exception as e:
            logger.error(f"Create session failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_empty_session(
        self,
        token: str,
        title: str = "Empty Chat"
    ) -> Dict[str, Any]:
        """
        Create a new empty chat session
        
        Args:
            token: User's RSHub token
            title: Session title (default: "Empty Chat")
            
        Returns:
            Dict with session_id, title, and success status
        """
        try:
            session_id = str(int(datetime.now().timestamp() * 1000))
            
            session_data = {
                "session_id": session_id,
                "title": title,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "messages": []
            }
            
            success = await self._save_session_to_rshub(token, session_id, session_data)
            
            if success:
                logger.info(f"Empty session {session_id} created successfully")
                return {
                    "success": True,
                    "session_id": session_id,
                    "title": title
                }
            else:
                logger.error(f"Empty session {session_id} creation failed")
                return {
                    "success": False,
                    "error": "Failed to save session"
                }
        
        except Exception as e:
            logger.error(f"Create empty session failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_session(
        self,
        token: str,
        session_id: str,
        user_prompt: str,
        ai_response: str
    ) -> Dict[str, Any]:
        """
        Update existing chat session
        
        Args:
            token: User's RSHub token
            session_id: Session ID to update
            user_prompt: User's new message
            ai_response: AI's response
            
        Returns:
            Dict with success status
        """
        try:
            # Load existing session
            session_data = await self._load_session_from_rshub(token, session_id)
            
            if not session_data:
                logger.error(f"Session {session_id} not found")
                return {
                    "success": False,
                    "error": "Session not found"
                }
            
            # Add new messages
            session_data["messages"].append({
                "role": "user",
                "content": user_prompt,
                "timestamp": datetime.now().isoformat()
            })
            
            session_data["messages"].append({
                "role": "assistant",
                "content": ai_response,
                "timestamp": datetime.now().isoformat()
            })
            
            # Update timestamp
            session_data["updated_at"] = datetime.now().isoformat()
            
            # Save to RSHub
            success = await self._save_session_to_rshub(token, session_id, session_data)
            
            if success:
                logger.info(f"Session {session_id} updated successfully")
                return {
                    "success": True,
                    "session_id": session_id
                }
            else:
                logger.error(f"Session {session_id} update failed")
                return {
                    "success": False,
                    "error": "Failed to save session"
                }
        
        except Exception as e:
            logger.error(f"Update session failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def load_session(
        self,
        token: str,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Load chat session data
        
        Args:
            token: User's RSHub token
            session_id: Session ID to load
            
        Returns:
            Session data dict or None if not found
        """
        try:
            return await self._load_session_from_rshub(token, session_id)
        except Exception as e:
            logger.error(f"Load session failed: {e}")
            return None
    
    async def list_sessions(
        self,
        token: str
    ) -> List[Dict[str, Any]]:
        """
        Get list of all user's chat sessions
        
        Args:
            token: User's RSHub token
            
        Returns:
            List of session info dicts
        """
        try:
            # Get session IDs from RSHub
            response = requests.post(
                f"{self.rshub_api_base}/users/api/list-chats",
                json={"token": token},
                timeout=30
            )
            
            logger.info(f"List sessions API response: status={response.status_code}, content_type={response.headers.get('content-type')}")
            
            if response.status_code != 200:
                logger.error(f"List sessions API failed: {response.status_code}, response: {response.text[:500]}")
                return []
            
            try:
                result = response.json()
                logger.info(f"List sessions result: {result}")
                session_ids = result.get("chatids", [])
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse list sessions response as JSON: {e}")
                logger.error(f"Response content: {response.text[:500]}")
                return []
            
            # Load basic info for each session
            sessions = []
            for session_id in session_ids:
                session_data = await self._load_session_from_rshub(token, session_id)
                if session_data:
                    sessions.append({
                        "session_id": session_id,
                        "title": session_data.get("title", "Untitled"),
                        "created_at": session_data.get("created_at"),
                        "updated_at": session_data.get("updated_at"),
                        "message_count": len(session_data.get("messages", []))
                    })
            
            # Sort by update time (handle None values)
            sessions.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
            
            return sessions
        
        except Exception as e:
            logger.error(f"List sessions failed: {e}")
            return []
    
    async def generate_session_title(
        self,
        user_message: str,
        ai_response: str,
        llm_service
    ) -> str:
        """
        Use LLM to generate a concise session title based on first exchange
        
        Args:
            user_message: User's first message
            ai_response: AI's response
            llm_service: LLM service instance
            
        Returns:
            Generated title (max 30 chars)
        """
        try:
            title_prompt = f"""Based on this conversation, generate a concise title (max 30 characters, in the same language as user's message):

User: {user_message[:200]}
Assistant: {ai_response[:200]}

Generate only the title, no quotes or explanations."""

            response = await llm_service.chat_completion(
                messages=[{"role": "user", "content": title_prompt}],
                temperature=0.3,
                max_tokens=50
            )
            
            title = response["message"]["content"].strip()
            title = title.strip('"').strip("'").strip()
            title = title[:30]
            
            logger.info(f"Generated title: {title}")
            return title
            
        except Exception as e:
            logger.error(f"Failed to generate title: {e}")
            return user_message[:20] + "..." if len(user_message) > 20 else user_message
    
    async def update_session_title(
        self,
        token: str,
        session_id: str,
        new_title: str
    ) -> bool:
        """
        Update session title
        
        Args:
            token: User's RSHub token
            session_id: Session ID
            new_title: New title
            
        Returns:
            Success status
        """
        try:
            session_data = await self._load_session_from_rshub(token, session_id)
            if not session_data:
                return False
            
            session_data["title"] = new_title
            session_data["updated_at"] = datetime.now().isoformat()
            
            return await self._save_session_to_rshub(token, session_id, session_data)
            
        except Exception as e:
            logger.error(f"Update session title failed: {e}")
            return False
    
    async def save_session_data(
        self,
        token: str,
        session_id: str,
        session_data: Dict[str, Any]
    ) -> bool:
        """Public method to persist full session data (including metadata) to RSHub."""
        return await self._save_session_to_rshub(token, session_id, session_data)

    async def _save_session_to_rshub(
        self,
        token: str,
        session_id: str,
        session_data: Dict[str, Any]
    ) -> bool:
        """Save session to RSHub Chat API"""
        try:
            # Prepare file data
            json_data = json.dumps(session_data, ensure_ascii=False, indent=2)
            
            # Call RSHub API
            files = {
                'file': ('session.json', json_data, 'application/json')
            }
            
            data = {
                'token': token,
                'chatid': session_id
            }
            
            response = requests.post(
                f"{self.rshub_api_base}/api/create-update-chat",
                files=files,
                data=data,
                timeout=30
            )
            
            logger.info(f"Save session API response: status={response.status_code}, content_type={response.headers.get('content-type')}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    logger.info(f"Save session result: {result}")
                    return result.get("result", False)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse save session response as JSON: {e}")
                    logger.error(f"Response content: {response.text[:500]}")
                    return False
            else:
                logger.error(f"Save session API failed: {response.status_code}, response: {response.text[:200]}")
                return False
        
        except Exception as e:
            logger.error(f"Save session to RSHub failed: {e}")
            return False
    
    async def _load_session_from_rshub(
        self,
        token: str,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Load session from RSHub Chat API"""
        try:
            response = requests.post(
                f"{self.rshub_api_base}/api/retrieve-chat",
                json={
                    "token": token,
                    "chatid": session_id
                },
                timeout=30
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, dict) and 'error_message' in data:
                        error_msg = data.get('error_message')
                        if error_msg:
                            logger.warning(f"RSHub error: {error_msg}")
                            return None
                    return data
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse load session response as JSON: {e}")
                    logger.error(f"Response content: {response.text[:500]}")
                    return None
            else:
                logger.error(f"Load session API failed: {response.status_code}, response: {response.text[:200]}")
                return None
        
        except Exception as e:
            logger.error(f"Load session from RSHub failed: {e}")
            return None
    
    async def delete_session(
        self,
        token: str,
        session_id: str
    ) -> bool:
        """
        Delete a chat session
        
        Args:
            token: User's RSHub token (not used by delete API but kept for consistency)
            session_id: Session ID to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            response = requests.post(
                f"{self.rshub_api_base}/users/api/delete-chat",
                json={"chatid": session_id},
                timeout=30
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("result"):
                        logger.info(f"Session {session_id} deleted successfully")
                        return True
                    else:
                        logger.error(f"Delete session failed: {data.get('error_message')}")
                        return False
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse delete response as JSON: {e}")
                    return False
            else:
                logger.error(f"Delete session API failed: {response.status_code}")
                return False
        
        except Exception as e:
            logger.error(f"Delete session failed: {e}")
            return False


# Global instance
_chat_service = None


def get_chat_service() -> ChatService:
    """Get global chat service instance"""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service

