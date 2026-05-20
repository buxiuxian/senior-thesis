"""Agent orchestrator - Main agent loop with ReAct pattern and HITL.

HITL: IDLE → PENDING → CONFIRMED → (submit) → IDLE.
Strict exact-match keywords gate confirmation; non-matching input in PENDING
short-circuits without calling LLM.
"""

import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime
from app.config import get_settings
from app.services.result_cache import result_cache
from app.models.hitl_state import (
    HITLState,
    HITLPhase,
    extract_hitl_state_from_session,
    save_hitl_state_to_session,
)
from app.services.skills.hitl_context import (
    is_exact_confirmation,
    is_exact_rejection,
    extract_task_spec_from_text,
    append_hitl_pending_prompt,
    strip_appended_hitl_pending_prompt,
    HITL_PENDING_PROMPT,
)
from app.services.skills.skill_registry import get_skill_registry
from app.services.skills.skill_router import select_skill_ids_for_turn

logger = logging.getLogger(__name__)
settings = get_settings()


class AgentOrchestrator:
    """Main agent orchestrator with tool calling support and HITL state machine."""

    def __init__(self, llm_service, tool_registry, chat_service, credit_service):
        self.llm_service = llm_service
        self.tool_registry = tool_registry
        self.chat_service = chat_service
        self.credit_service = credit_service

    def _get_tools_for_hitl_phase(self, hitl_state: HITLState) -> List[Dict[str, Any]]:
        """Hide submit_rshub_task unless phase == CONFIRMED."""
        all_tools = self.tool_registry.get_tools_schema()

        if not settings.HITL_ENABLED:
            return all_tools

        if hitl_state.phase == HITLPhase.CONFIRMED:
            return all_tools

        # Hide submit tool
        return [
            t for t in all_tools
            if (t.get("function") or {}).get("name") != "submit_rshub_task"
        ]

    async def _handle_tool_execution(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        hitl_state: HITLState,
        user_token: str,
    ) -> Dict[str, Any]:
        """Execute tool. Enforce HITL submit gate at execution time."""
        if tool_name == "submit_rshub_task":
            if settings.HITL_ENABLED and hitl_state.phase != HITLPhase.CONFIRMED:
                logger.warning(
                    "HITL: blocked submit_rshub_task execution in phase=%s",
                    hitl_state.phase.value,
                )
                return {
                    "success": False,
                    "error": "submit_rshub_task requires explicit user confirmation before execution",
                    "hitl_phase": hitl_state.phase.value,
                }

            # Execute submit
            result = await self.tool_registry.execute_tool(tool_name, **tool_args)

            # Deduct credits ONLY on successful submission
            if result.get("success"):
                deduct_ok, msg, balance = await self.credit_service.deduct_credits(
                    user_token, settings.TASK_SUBMIT_COST
                )
                if deduct_ok:
                    logger.info(f"HITL: Task credits deducted, remaining={balance}")
                    result["credits_deducted"] = settings.TASK_SUBMIT_COST
                    result["remaining_credits"] = balance
                else:
                    logger.warning(f"HITL: Credit deduction failed: {msg}")

                # Mark as submitted
                hitl_state.mark_submitted()
            elif settings.HITL_ENABLED:
                hitl_state.phase = HITLPhase.PENDING_CONFIRMATION
                logger.info(
                    "HITL: submit failed, returned to PENDING_CONFIRMATION for reconfirmation"
                )

            return result

        # Non-submit tools: execute normally (no credit deduction)
        return await self.tool_registry.execute_tool(tool_name, **tool_args)

    def _recover_hitl_state(self, session_data: Optional[Dict[str, Any]]) -> HITLState:
        """Recover HITL state from session metadata. No fallback — metadata is sole truth."""
        if not settings.HITL_ENABLED:
            return HITLState()
        if session_data:
            return extract_hitl_state_from_session(session_data)
        return HITLState()

    def _update_hitl_state_after_assistant(
        self, hitl_state: HITLState, assistant_content: str, has_tool_calls: bool
    ) -> bool:
        """Return True when assistant response moves HITL from idle to pending."""
        if not settings.HITL_ENABLED or has_tool_calls or not hitl_state.is_idle():
            return False

        task_spec = extract_task_spec_from_text(assistant_content)
        if not task_spec:
            return False

        hitl_state.set_pending(task_spec)
        logger.info(f"HITL: Entered PENDING state for {task_spec.get('project_name')}")
        return True

    async def run(
        self,
        user_message: str,
        user_token: str,
        chat_id: Optional[str] = None,
        max_iterations: int = 5
    ) -> Dict[str, Any]:
        """Main agent loop with ReAct pattern and HITL.

        HITL: No credit deduction for LLM calls. Only deduct on successful submit.
        """
        try:
            # Load chat history
            chat_history: List[Dict[str, Any]] = []
            session_data: Optional[Dict[str, Any]] = None

            if chat_id:
                session_data = await self.chat_service.load_session(user_token, chat_id)
                if session_data:
                    chat_history = session_data.get("messages", [])

            # Recover HITL state from metadata (sole truth source)
            hitl_state = self._recover_hitl_state(session_data)

            # HITL short-circuit: if PENDING, only exact keywords pass through
            if settings.HITL_ENABLED and hitl_state.is_pending():
                if is_exact_rejection(user_message):
                    hitl_state.reset()
                    logger.info("HITL: User rejected, reset to IDLE")
                elif is_exact_confirmation(user_message):
                    hitl_state.confirm()
                    logger.info("HITL: User confirmed, advanced to CONFIRMED")
                else:
                    # Non-matching input: short-circuit, no LLM call
                    new_chat_id = await self._save_conversation_with_hitl(
                        user_token, chat_id, user_message, HITL_PENDING_PROMPT, hitl_state
                    )
                    return {
                        "success": True,
                        "response": HITL_PENDING_PROMPT,
                        "chat_id": new_chat_id,
                        "tool_calls_made": 0,
                        "hitl_phase": hitl_state.phase.value,
                    }

            # Build messages and tools
            messages = self._build_messages(user_message, chat_history)
            tools_schema = self._get_tools_for_hitl_phase(hitl_state)

            last_download_ref = None
            last_download_task = None
            total_tool_calls = 0
            all_content_parts = []

            # Agent loop
            for iteration in range(max_iterations):
                logger.info(f"Agent iteration {iteration + 1}/{max_iterations}")

                response = await self.llm_service.chat_completion(
                    messages=messages,
                    tools=tools_schema,
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                )

                assistant_message = response.get("message", {})
                tool_calls = assistant_message.get("tool_calls")
                iteration_content = assistant_message.get("content") or ""

                entered_pending = self._update_hitl_state_after_assistant(
                    hitl_state, iteration_content, bool(tool_calls)
                )
                if entered_pending:
                    iteration_content = append_hitl_pending_prompt(iteration_content)

                if iteration_content:
                    all_content_parts.append(iteration_content)

                # If no tool calls, we're done
                if not tool_calls:
                    final_response = "\n\n".join(all_content_parts) if all_content_parts else ""
                    logger.info(f"Agent completed after {total_tool_calls} tool calls")

                    new_chat_id = await self._save_conversation_with_hitl(
                        user_token, chat_id, user_message, final_response, hitl_state
                    )

                    return {
                        "success": True,
                        "response": final_response,
                        "chat_id": new_chat_id,
                        "tool_calls_made": total_tool_calls,
                        "hitl_phase": hitl_state.phase.value if settings.HITL_ENABLED else None,
                    }

                # Execute tools
                total_tool_calls += len(tool_calls)
                logger.info(f"Executing {len(tool_calls)} tool calls")

                messages.append({
                    "role": "assistant",
                    "content": iteration_content,
                    "tool_calls": tool_calls
                })

                for tool_call in tool_calls:
                    tool_name = tool_call["function"]["name"]
                    tool_args = json.loads(tool_call["function"]["arguments"])

                    # Inject user token
                    if tool_name in ["submit_rshub_task", "download_task_result", "read_task_parameters"]:
                        tool_args["token"] = user_token

                    # Handle plot_results data_ref logic
                    if tool_name == "plot_results":
                        data_ref = tool_args.get("data_ref")
                        if not data_ref and last_download_ref:
                            data_ref = last_download_ref
                            tool_args["data_ref"] = data_ref
                        if data_ref and not result_cache.exists(data_ref):
                            data_ref = None
                            tool_args.pop("data_ref", None)

                        project = tool_args.get("project_name")
                        task = tool_args.get("task_name")
                        if not project and last_download_task:
                            project = last_download_task.get("project")
                            task = last_download_task.get("task")

                        if not data_ref and project and task:
                            cached_ref = result_cache.get_latest_ref(project, task)
                            if cached_ref and result_cache.exists(cached_ref):
                                data_ref = cached_ref
                                tool_args["data_ref"] = data_ref
                            else:
                                refresh_result = await self.tool_registry.execute_tool(
                                    "download_task_result",
                                    project_name=project,
                                    task_name=task,
                                    token=user_token
                                )
                                if refresh_result.get("success") and refresh_result.get("data_ref"):
                                    data_ref = refresh_result["data_ref"]
                                    tool_args["data_ref"] = data_ref
                                    last_download_ref = data_ref
                                    last_download_task = {"project": project, "task": task}

                    tool_result = await self._handle_tool_execution(
                        tool_name, tool_args, hitl_state, user_token
                    )

                    logger.info(f"Tool {tool_name} executed: success={tool_result.get('success')}")

                    # If submit fails, hide tool and break to prevent retry loops
                    if tool_name == "submit_rshub_task" and not tool_result.get("success"):
                        tools_schema = self._get_tools_for_hitl_phase(hitl_state)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps(tool_result, ensure_ascii=False)
                        })
                        # Force break from tool loop - let model respond with error explanation
                        break

                    if tool_name == "download_task_result" and tool_result.get("success") and tool_result.get("data_ref"):
                        last_download_ref = tool_result.get("data_ref")
                        last_download_task = {
                            "project": tool_result.get("project"),
                            "task": tool_result.get("task")
                        }

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(tool_result, ensure_ascii=False)
                    })

            # Max iterations reached
            final_response = "\n\n".join(all_content_parts) if all_content_parts else "Maximum iterations reached."
            new_chat_id = await self._save_conversation_with_hitl(
                user_token, chat_id, user_message, final_response, hitl_state
            )

            return {
                "success": True,
                "response": final_response,
                "chat_id": new_chat_id,
                "tool_calls_made": total_tool_calls,
                "note": "Maximum iterations reached",
                "hitl_phase": hitl_state.phase.value if settings.HITL_ENABLED else None,
            }

        except Exception as e:
            logger.error(f"Agent execution failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Agent execution failed: {str(e)}",
                "chat_id": chat_id,
            }

    async def run_streaming(
        self,
        user_message: str,
        user_token: str,
        chat_id: Optional[str] = None,
        attachments: Optional[list] = None,
        max_iterations: int = 5
    ) -> AsyncGenerator[str, None]:
        """Streaming version with HITL short-circuit."""
        try:
            if "test-token" not in user_token.lower():
                has_credits, msg, balance = await self.credit_service.check_credits(
                    user_token, 0
                )
                if not has_credits:
                    yield f'data: {json.dumps({"type": "error", "error": f"Insufficient credits: {msg}"}, ensure_ascii=False)}\n\n'
                    return

            # Process attachments
            processed_message = user_message
            if attachments:
                attachment_context = "\n\n"
                for idx, att in enumerate(attachments, 1):
                    filename = att.get('filename', f'unknown_{idx}')
                    content = att.get('content', '')
                    file_type = att.get('file_type', 'txt')
                    attachment_context += f"[Attachment: {filename}]\n```{file_type}\n{content}\n```\n\n"
                processed_message = user_message + attachment_context

            # Load history
            chat_history: List[Dict[str, Any]] = []
            session_data: Optional[Dict[str, Any]] = None

            if chat_id:
                session_data = await self.chat_service.load_session(user_token, chat_id)
                if session_data:
                    chat_history = session_data.get("messages", [])

            # Recover HITL state from metadata
            hitl_state = self._recover_hitl_state(session_data)

            # HITL short-circuit: if PENDING, only exact keywords pass through
            # Use user_message (not processed_message) to avoid attachment text pollution
            if settings.HITL_ENABLED and hitl_state.is_pending():
                if is_exact_rejection(user_message):
                    hitl_state.reset()
                elif is_exact_confirmation(user_message):
                    hitl_state.confirm()
                else:
                    # Non-matching: short-circuit with fixed prompt
                    new_chat_id = await self._save_conversation_with_hitl(
                        user_token, chat_id, user_message, HITL_PENDING_PROMPT, hitl_state
                    )
                    chunk_size = 50
                    for i in range(0, len(HITL_PENDING_PROMPT), chunk_size):
                        yield f'data: {json.dumps({"type": "content", "delta": HITL_PENDING_PROMPT[i:i+chunk_size]}, ensure_ascii=False)}\n\n'
                    yield f'data: {json.dumps({"type": "done", "chat_id": new_chat_id}, ensure_ascii=False)}\n\n'
                    return

            yield f'data: {json.dumps({"type": "thinking", "content": "Processing your request..."}, ensure_ascii=False)}\n\n'

            # Build messages and tools
            messages = self._build_messages(processed_message, chat_history)
            tools_schema = self._get_tools_for_hitl_phase(hitl_state)

            last_download_ref = None
            last_download_task = None
            final_response = ""
            total_llm_calls = 0

            for iteration in range(max_iterations):
                response = await self.llm_service.chat_completion(
                    messages=messages,
                    tools=tools_schema,
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                    stream=False
                )

                total_llm_calls += 1

                assistant_message = response.get("message", {})
                tool_calls = assistant_message.get("tool_calls")
                content = assistant_message.get("content", "")

                entered_pending = self._update_hitl_state_after_assistant(
                    hitl_state, content, bool(tool_calls)
                )
                if entered_pending:
                    content = append_hitl_pending_prompt(content)

                if not tool_calls:
                    final_response = content
                    break

                # Handle tool calls
                messages.append({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls
                })

                for tool_call in tool_calls:
                    tool_name = tool_call["function"]["name"]
                    tool_args = json.loads(tool_call["function"]["arguments"])

                    if tool_name in ["submit_rshub_task", "download_task_result", "read_task_parameters"]:
                        tool_args["token"] = user_token

                    if tool_name == "plot_results":
                        data_ref = tool_args.get("data_ref")
                        if not data_ref and last_download_ref:
                            data_ref = last_download_ref
                            tool_args["data_ref"] = data_ref
                        if data_ref and not result_cache.exists(data_ref):
                            data_ref = None
                            tool_args.pop("data_ref", None)

                        project = tool_args.get("project_name")
                        task = tool_args.get("task_name")
                        if not project and last_download_task:
                            project = last_download_task.get("project")
                            task = last_download_task.get("task")

                        if not data_ref and project and task:
                            cached_ref = result_cache.get_latest_ref(project, task)
                            if cached_ref and result_cache.exists(cached_ref):
                                data_ref = cached_ref
                                tool_args["data_ref"] = data_ref
                            else:
                                refresh = await self.tool_registry.execute_tool(
                                    "download_task_result", project_name=project,
                                    task_name=task, token=user_token
                                )
                                if refresh.get("success") and refresh.get("data_ref"):
                                    data_ref = refresh["data_ref"]
                                    tool_args["data_ref"] = data_ref
                                    last_download_ref = data_ref
                                    last_download_task = {"project": project, "task": task}

                    # Execute tool
                    tool_result = await self._handle_tool_execution(
                        tool_name, tool_args, hitl_state, user_token
                    )

                    # If submit fails, hide tool and break to prevent retry loops
                    if tool_name == "submit_rshub_task" and not tool_result.get("success"):
                        tools_schema = self._get_tools_for_hitl_phase(hitl_state)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps(tool_result, ensure_ascii=False)
                        })
                        break

                    if tool_name == "download_task_result" and tool_result.get("success"):
                        last_download_ref = tool_result.get("data_ref")
                        last_download_task = {
                            "project": tool_result.get("project"),
                            "task": tool_result.get("task")
                        }

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(tool_result, ensure_ascii=False)
                    })

            # Stream final response
            if not final_response:
                final_response = "Processing complete."

            chunk_size = 50
            for i in range(0, len(final_response), chunk_size):
                chunk = final_response[i:i+chunk_size]
                yield f'data: {json.dumps({"type": "content", "delta": chunk}, ensure_ascii=False)}\n\n'

            # Save with HITL state
            new_chat_id = await self._save_conversation_with_hitl(
                user_token, chat_id, user_message, final_response, hitl_state
            )

            yield f'data: {json.dumps({"type": "done", "chat_id": new_chat_id}, ensure_ascii=False)}\n\n'

        except Exception as e:
            logger.error(f"Streaming failed: {e}", exc_info=True)
            yield f'data: {json.dumps({"type": "error", "error": str(e)}, ensure_ascii=False)}\n\n'

    def _build_messages(self, user_message: str, chat_history: List[Dict]) -> List[Dict]:
        """Build message list for LLM."""
        messages = [
            {
                "role": "system",
                "content": self._get_system_prompt(user_message, chat_history)
            }
        ]

        for msg in chat_history[-settings.CHAT_HISTORY_WINDOW:]:
            content = msg["content"]
            if msg["role"] == "assistant":
                content = strip_appended_hitl_pending_prompt(content)
                if not content:
                    continue

            messages.append({
                "role": msg["role"],
                "content": content
            })

        messages.append({
            "role": "user",
            "content": user_message
        })

        return messages

    def _get_system_prompt(self, user_message: str, chat_history: List[Dict]) -> str:
        """Render system prompt with Skill Registry."""
        from jinja2 import Environment, FileSystemLoader

        cfg = get_settings()

        try:
            registry = get_skill_registry()
            skill_ids = select_skill_ids_for_turn(
                user_message,
                hitl_enabled=cfg.HITL_ENABLED,
                tiered_skill_load=cfg.SKILL_TIERED_LOAD_ENABLED,
                skills=registry.all_skills(),
            )
            skill_catalog_layer1 = (
                registry.format_layer1_catalog() if cfg.SKILL_TIERED_LOAD_ENABLED else ""
            )
            loaded_skill_docs = registry.render_layer2_docs(skill_ids)
            if not loaded_skill_docs.strip():
                loaded_skill_docs = "_Skill registry returned no documents._"

            env = Environment(loader=FileSystemLoader("app/prompts/system"))
            template = env.get_template("agent.j2")
            return template.render(
                current_date=datetime.now().strftime("%Y-%m-%d"),
                hitl_enabled=cfg.HITL_ENABLED,
                skill_catalog_layer1=skill_catalog_layer1,
                loaded_skill_docs=loaded_skill_docs,
                hitl_resolved_block="",  # HITL v2 uses state machine instead
            )
        except Exception as e:
            logger.error(f"Failed to load system prompt: {e}", exc_info=True)
            return "You are RSHub AI Assistant, an expert in microwave remote sensing."

    async def _save_conversation_with_hitl(
        self,
        token: str,
        chat_id: Optional[str],
        user_message: str,
        assistant_response: str,
        hitl_state: HITLState,
    ) -> str:
        """Save conversation and persist HITL state to session metadata."""
        try:
            if chat_id:
                # Update existing session
                result = await self.chat_service.update_session(
                    token, chat_id, user_message, assistant_response
                )
                if not result.get("success"):
                    logger.error(f"Failed to update session: {result.get('error')}")
                    return chat_id

                # Persist HITL state into session metadata
                session_data = await self.chat_service.load_session(token, chat_id)
                if session_data:
                    save_hitl_state_to_session(session_data, hitl_state)
                    await self.chat_service.save_session_data(token, chat_id, session_data)

                return chat_id
            else:
                # Create new session
                result = await self.chat_service.create_session(
                    token, user_message, assistant_response
                )
                if not result.get("success"):
                    logger.error(f"Failed to create session: {result.get('error')}")
                    return None

                session_id = result.get("session_id")

                # Persist HITL state into session metadata
                session_data = await self.chat_service.load_session(token, session_id)
                if session_data:
                    save_hitl_state_to_session(session_data, hitl_state)
                    await self.chat_service.save_session_data(token, session_id, session_data)

                # Generate title
                try:
                    title = await self.chat_service.generate_session_title(
                        user_message, assistant_response, self.llm_service
                    )
                    await self.chat_service.update_session_title(token, session_id, title)
                except Exception as e:
                    logger.error(f"Failed to generate title: {e}")

                return session_id
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")
            return chat_id
