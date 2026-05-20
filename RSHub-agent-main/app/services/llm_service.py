"""
LLM Service - OpenRouter API Integration

This module handles:
- OpenRouter API calls with OpenAI SDK
- Function calling support
- Token management
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI, BadRequestError, AuthenticationError, PermissionDeniedError, UnprocessableEntityError

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM interactions via OpenAI-compatible APIs (Volcengine Ark / OpenRouter)"""
    
    def __init__(self, api_key: str, model: str, base_url: str = "https://ark.cn-beijing.volces.com/api/v3"):
        """
        Initialize LLM service
        
        Args:
            api_key: API key for the provider
            model: Model name (e.g. 'deepseek-v3-2-251201')
            base_url: Base URL for the OpenAI-compatible API
        """
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.model = model
        logger.info(f"LLMService initialized with model: {model} using base_url: {base_url}")
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Call LLM with optional function calling
        
        Args:
            messages: List of message dicts (OpenAI format)
            tools: Optional list of tool schemas (OpenAI format)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            
        Returns:
            Response dict with message and optional tool_calls, or stream object
        """
        max_retries = 2
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                # Prepare request params
                params = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": stream
                }

                # Add tools if provided
                if tools:
                    params["tools"] = tools
                    params["tool_choice"] = "auto"

                logger.info(f"Calling LLM (stream={stream}) with {len(messages)} messages, {len(tools) if tools else 0} tools"
                            + (f" (retry {attempt}/{max_retries})" if attempt > 0 else ""))

                # Call OpenRouter API
                response = await self.client.chat.completions.create(**params)

                # If streaming, return the stream object directly
                if stream:
                    return response

                # Validate response
                if response is None:
                    raise Exception("API returned None response")

                if not hasattr(response, 'choices') or not response.choices:
                    raise Exception("API returned empty choices list")

                # Extract response
                choice = response.choices[0]
                message = choice.message

                # Convert to dict format
                result = {
                    "message": {
                        "role": message.role,
                        "content": message.content
                    }
                }

                # Add reasoning_details if present (required for Gemini models)
                if hasattr(message, 'reasoning_details') and message.reasoning_details:
                    result["message"]["reasoning_details"] = message.reasoning_details

                # Add tool calls if present
                if message.tool_calls:
                    result["message"]["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": tc.type,
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        }
                        for tc in message.tool_calls
                    ]
                    logger.info(f"LLM requested {len(message.tool_calls)} tool calls")

                logger.info(f"LLM response received: {len(message.content) if message.content else 0} chars")
                return result

            except (BadRequestError, AuthenticationError, PermissionDeniedError, UnprocessableEntityError) as e:
                # Client errors (400, 401, 403, 422) are deterministic — don't retry
                logger.error(f"LLM call failed with non-retryable error: {e}", exc_info=True)
                raise
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    wait_seconds = 2 ** attempt
                    logger.warning(f"LLM call failed (attempt {attempt + 1}/{max_retries + 1}): {e}. Retrying in {wait_seconds}s...")
                    await asyncio.sleep(wait_seconds)
                else:
                    logger.error(f"LLM call failed after {max_retries + 1} attempts: {e}", exc_info=True)
                    raise


# Global instance
_llm_service = None


def get_llm_service(api_key: str = None, model: str = None) -> LLMService:
    """Get global LLM service instance based on LLM_PROVIDER"""
    global _llm_service
    if _llm_service is None:
        from app.config import get_settings
        settings = get_settings()
        
        llm_config = settings.get_llm_config()
        
        _llm_service = LLMService(
            api_key=api_key or llm_config["api_key"],
            model=model or llm_config["model"],
            base_url=llm_config["base_url"]
        )
    return _llm_service

