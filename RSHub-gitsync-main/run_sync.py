from __future__ import annotations

import asyncio
from datetime import datetime
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from rshub_gitsync.sync import (
    SyncConfig,
    SyncResult,
    format_summary,
    parse_bool,
    resolve_repo_path,
    run_command,
    run_git,
)


def load_env_file(env_file: Path, overwrite: bool) -> bool:
    if not env_file.exists():
        return False

    loaded_any = False
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        env_key = key.strip()
        if (not overwrite) and env_key in os.environ:
            continue

        os.environ[env_key] = value.strip()
        loaded_any = True

    return loaded_any


def build_sync_config() -> SyncConfig:
    enabled = parse_bool(os.getenv("GIT_SYNC_ENABLED"), True)
    repo_path = os.getenv("GIT_SYNC_REPO_PATH", "")
    remote = os.getenv("GIT_SYNC_REMOTE", "origin")
    branch = os.getenv("GIT_SYNC_BRANCH", "main")

    try:
        timeout_value = int(os.getenv("GIT_SYNC_TIMEOUT_SECONDS", "30"))
    except ValueError:
        timeout_value = 30

    require_gh_auth = parse_bool(os.getenv("GIT_SYNC_REQUIRE_GH_AUTH"), True)

    return SyncConfig(
        enabled=enabled,
        repo_path=repo_path,
        remote=remote,
        branch=branch,
        timeout_seconds=timeout_value,
        require_gh_auth=require_gh_auth,
    )


def sync_exit_code(success: bool, action: str) -> int:
    if success:
        return 0
    if action == "skip":
        return 2
    return 1


def parse_porcelain_status(status_output: str) -> tuple[bool, bool]:
    has_staged_changes = False
    has_unstaged_changes = False

    for line in status_output.splitlines():
        if not line:
            continue
        if line.startswith("??"):
            has_unstaged_changes = True
            continue

        if len(line) < 2:
            has_unstaged_changes = True
            continue

        index_state = line[0]
        worktree_state = line[1]

        if index_state != " ":
            has_staged_changes = True
        if worktree_state != " ":
            has_unstaged_changes = True

    return has_staged_changes, has_unstaged_changes


def parse_positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        parsed_value = int(raw_value)
    except ValueError:
        return default
    if parsed_value <= 0:
        return default
    return parsed_value


def normalize_commit_message(raw_message: str) -> str:
    ignored_lines = {
        "plaintext",
        "text",
        "markdown",
        "md",
        "txt",
        "commit",
        "message",
    }
    lines: list[str] = []
    previous_blank = False
    for raw_line in raw_message.replace("\r", "").splitlines():
        line = raw_line.strip()
        if not line:
            if lines and not previous_blank:
                lines.append("")
                previous_blank = True
            continue

        if line.startswith("```"):
            continue

        line = line.strip("`").strip()
        lowered = line.lower()
        if lowered.startswith("commit message"):
            _, _, tail = line.partition(":")
            line = tail.strip() or line

        line = line.lstrip("-*0123456789. ").strip()
        if line.lower() in ignored_lines:
            continue
        if line:
            lines.append(line)
            previous_blank = False

    while lines and lines[-1] == "":
        lines.pop()

    if not lines:
        return ""

    subject = lines[0][:180]
    body_lines = [line for line in lines[1:] if line]
    if not body_lines:
        return subject

    return subject + "\n\n" + "\n".join(body_lines[:6])


def build_ai_commit_user_input(changed_files: str, staged_diff: str) -> str:
    return (
        "以下是本次已暂存的 Git 变更材料，请据此生成提交信息。\n"
        f"Changed files:\n{changed_files or '(none)'}\n\n"
        f"Staged diff:\n{staged_diff or '(empty)'}\n"
    )


def sanitize_text(value: str) -> str:
    if not value:
        return ""

    return value.encode("utf-8", errors="replace").decode("utf-8")


def resolve_agent_python(agent_project_path: Path) -> Path:
    candidates = [
        agent_project_path / ".venv" / "Scripts" / "python.exe",
        agent_project_path / ".venv" / "bin" / "python",
        Path(sys.executable),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return Path(sys.executable)


def build_agent_helper_code() -> str:
    return """\
import asyncio
import sys

sys.path.insert(0, sys.argv[1])

from app.services.llm_service import get_llm_service

system_prompt = "你是一个严格的 git commit message 生成助手。你只能输出一条可直接用于 git commit 的中文提交信息。输出规则：1) 第一行必须是 Conventional Commits 标题，格式为 type(scope): summary。2) 空一行后补充 2-4 行简洁正文，说明关键改动、原因或影响。3) 内容必须具体，优先体现受影响模块、功能或文件语义，避免泛化描述。4) 不要解释、不要代码块、不要语言标签、不要多余前后缀。"
user_input = sys.stdin.buffer.read().decode("utf-8", "replace")


async def main():
    llm_service = get_llm_service()
    response = await llm_service.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        tools=None,
        temperature=0.2,
        max_tokens=320,
    )
    print(str(response.get("message", {}).get("content", "") or ""))


asyncio.run(main())
"""


def run_agent_helper(
    agent_python: Path,
    agent_project_path: Path,
    user_input: str,
    timeout_seconds: int,
) -> tuple[str | None, str | None, str]:
    helper_code = build_agent_helper_code()
    command = [str(agent_python), "-X", "utf8", "-c", helper_code, str(agent_project_path)]

    helper_env = os.environ.copy()
    helper_env["PYTHONUTF8"] = "1"
    helper_env["PYTHONIOENCODING"] = "utf-8"

    try:
        completed = subprocess.run(
            command,
            cwd=str(agent_project_path),
            env=helper_env,
            input=user_input,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None, f"local agent generation timed out after {timeout_seconds}s", " ".join(command[:2] + ["<helper>", str(agent_project_path)])
    except OSError as exc:
        return None, f"failed to start agent python '{agent_python}': {exc}", " ".join(command[:2] + ["<helper>", str(agent_project_path)])

    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout or "").strip()
        return None, f"local agent generation failed via {agent_python}: {stderr}", " ".join(command[:2] + ["<helper>", str(agent_project_path)])

    return completed.stdout or "", None, " ".join(command[:2] + ["<helper>", str(agent_project_path)])


def run_git_commit(repo_path: Path, timeout_seconds: int, message: str):
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", delete=False, suffix=".txt") as temp_file:
            temp_file.write(message)
            temp_path = temp_file.name

        return run_git(repo_path, timeout_seconds, ["commit", "-F", temp_path])
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except OSError:
                pass


def generate_ai_commit_message(
    repo_path: Path,
    config: SyncConfig,
    commands: list[str],
) -> tuple[str | None, str | None]:
    files_res = run_git(repo_path, config.timeout_seconds, ["diff", "--cached", "--name-status"])
    commands.append(files_res.command)
    if files_res.returncode != 0:
        return None, files_res.stderr or "failed to collect staged file list"

    diff_res = run_git(repo_path, config.timeout_seconds, ["diff", "--cached", "--no-color", "--unified=2"])
    commands.append(diff_res.command)
    if diff_res.returncode != 0:
        return None, diff_res.stderr or "failed to collect staged diff"

    diff_limit = parse_positive_int_env("GIT_SYNC_AGENT_DIFF_MAX_CHARS", 12000)
    staged_diff = diff_res.stdout
    if len(staged_diff) > diff_limit:
        staged_diff = staged_diff[:diff_limit] + "\n\n[diff truncated for prompt size]"

    user_input = sanitize_text(build_ai_commit_user_input(files_res.stdout, staged_diff))

    agent_project_path = repo_path / "RSHub-agent-main"
    llm_service_file = agent_project_path / "app" / "services" / "llm_service.py"
    if not llm_service_file.exists():
        return None, f"RSHub-agent llm service not found: {llm_service_file}"

    agent_python = resolve_agent_python(agent_project_path)
    raw_message, helper_error, helper_command = run_agent_helper(
        agent_python=agent_python,
        agent_project_path=agent_project_path,
        user_input=user_input,
        timeout_seconds=config.timeout_seconds,
    )
    commands.append(helper_command)

    if helper_error is not None:
        return None, helper_error

    message = normalize_commit_message(raw_message)
    if not message:
        return None, "local agent returned empty commit message"

    return message, None


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    while True:
        try:
            answer = input(f"[gitsync] {prompt} {suffix}: ").strip().lower()
        except EOFError:
            return default

        if not answer:
            return default
        if answer in {"y", "yes"}:
            return True
        if answer in {"n", "no"}:
            return False

        print("[gitsync] Please answer 'y' or 'n'.")


def ask_choice(prompt: str, choices: dict[str, str], default: str) -> str:
    print(f"[gitsync] {prompt}")
    for key, description in choices.items():
        default_suffix = " (default)" if key == default else ""
        print(f"[gitsync]   {key}. {description}{default_suffix}")

    while True:
        try:
            answer = input("[gitsync] Enter choice: ").strip().lower()
        except EOFError:
            return default

        if not answer:
            return default
        if answer in choices:
            return answer

        print(f"[gitsync] Please choose one of: {', '.join(choices.keys())}.")


def prompt_manual_commit_message(default_message: str) -> str:
    try:
        input_message = input(
            "[gitsync] Enter commit message manually (leave empty to use default): "
        ).strip()
    except EOFError:
        input_message = ""
    return input_message or default_message


def combine_command_output(stdout: str, stderr: str) -> str:
    parts: list[str] = []
    if stderr:
        parts.append(stderr.strip())
    if stdout:
        normalized_stdout = stdout.strip()
        if normalized_stdout and normalized_stdout not in parts:
            parts.append(normalized_stdout)
    return "\n".join(parts)


def has_git_conflict(output: str) -> bool:
    lowered = output.lower()
    conflict_markers = [
        "conflict",
        "automatic merge failed",
        "fix conflicts",
        "merge conflict",
        "could not apply",
        "resolve all conflicts manually",
    ]
    return any(marker in lowered for marker in conflict_markers)


def finish(result: SyncResult, started: float) -> int:
    result.duration_seconds = round(time.monotonic() - started, 3)
    print(
        "[gitsync] "
        f"action={result.action} success={result.success} "
        f"ahead={result.ahead} behind={result.behind} "
        f"repo={result.repo_path} remote={result.remote}/{result.branch} "
        f"duration={result.duration_seconds}s"
    )
    print("[gitsync] reason:")
    for line in result.reason.splitlines():
        print("[gitsync]   " + line)
    if result.stderr:
        print("[gitsync] details:")
        for line in result.stderr.splitlines():
            print("[gitsync]   " + line)
    return sync_exit_code(result.success, result.action)


def read_working_tree_state(
    repo_path: Path,
    config: SyncConfig,
    commands: list[str],
) -> tuple[bool, bool, SyncResult | None]:
    status_res = run_git(repo_path, config.timeout_seconds, ["status", "--porcelain"])
    commands.append(status_res.command)

    if status_res.returncode != 0:
        error_result = SyncResult(
            success=False,
            action="error",
            reason="failed to inspect working tree",
            repo_path=str(repo_path),
            remote=config.remote,
            branch=config.branch,
            stderr=status_res.stderr,
            commands=commands,
        )
        return False, False, error_result

    has_staged, has_unstaged = parse_porcelain_status(status_res.stdout)
    return has_staged, has_unstaged, None


def main() -> int:
    started = time.monotonic()
    committed_this_run = False

    if len(sys.argv) > 1:
        print("[gitsync] run_sync.py does not accept command line arguments.")
        print("[gitsync] Please run exactly: python run_sync.py")
        return 2

    script_dir = Path(__file__).resolve().parent

    gitsync_env_file = script_dir / ".env"
    load_env_file(gitsync_env_file, overwrite=True)

    agent_env_file = script_dir.parent / "RSHub-agent-main" / ".env"
    if load_env_file(agent_env_file, overwrite=True):
        print(f"[gitsync] Loaded env from {agent_env_file}")
    else:
        print(f"[gitsync] WARNING: Agent env file not found: {agent_env_file}")

    config = build_sync_config()
    non_interactive = parse_bool(os.getenv("GIT_SYNC_NON_INTERACTIVE"), False)
    ai_commit_enabled = parse_bool(os.getenv("GIT_SYNC_AI_COMMIT_ENABLED"), True)
    interactive = (not non_interactive) and sys.stdin.isatty()

    anchors = [Path.cwd(), script_dir, script_dir.parent]
    repo_path = resolve_repo_path(config.repo_path, anchors)

    if not config.enabled:
        return finish(
            SyncResult(
                success=True,
                action="none",
                reason="disabled",
                repo_path=str(repo_path) if repo_path else "",
                remote=config.remote,
                branch=config.branch,
            ),
            started,
        )

    if repo_path is None:
        return finish(
            SyncResult(
                success=False,
                action="skip",
                reason="git repository root not found",
                repo_path="",
                remote=config.remote,
                branch=config.branch,
            ),
            started,
        )

    commands: list[str] = []

    git_check = run_command(["git", "--version"], config.timeout_seconds)
    commands.append(git_check.command)
    if git_check.returncode != 0:
        return finish(
            SyncResult(
                success=False,
                action="skip",
                reason="git command unavailable",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=git_check.stderr,
                commands=commands,
            ),
            started,
        )

    if config.require_gh_auth:
        gh_check = run_command(["gh", "auth", "status"], config.timeout_seconds)
        commands.append(gh_check.command)
        if gh_check.returncode != 0:
            return finish(
                SyncResult(
                    success=False,
                    action="skip",
                    reason="gh not authenticated",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    stderr=gh_check.stderr,
                    commands=commands,
                ),
                started,
            )

    repo_check = run_git(repo_path, config.timeout_seconds, ["rev-parse", "--is-inside-work-tree"])
    commands.append(repo_check.command)
    if repo_check.returncode != 0 or repo_check.stdout.lower() != "true":
        return finish(
            SyncResult(
                success=False,
                action="skip",
                reason="target path is not a git work tree",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=repo_check.stderr,
                commands=commands,
            ),
            started,
        )

    remote_check = run_git(repo_path, config.timeout_seconds, ["remote", "get-url", config.remote])
    commands.append(remote_check.command)
    if remote_check.returncode != 0:
        return finish(
            SyncResult(
                success=False,
                action="skip",
                reason=f"git remote '{config.remote}' not found",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=remote_check.stderr,
                commands=commands,
            ),
            started,
        )

    has_staged, has_unstaged, status_error = read_working_tree_state(repo_path, config, commands)
    if status_error is not None:
        return finish(status_error, started)

    if has_staged or has_unstaged:
        print("[gitsync] Working tree has local changes.")
        if has_unstaged:
            print("[gitsync] Unstaged changes detected.")
        if has_staged:
            print("[gitsync] Staged but uncommitted changes detected.")

        if interactive:
            if has_unstaged and ask_yes_no("Stage all local changes now using git add -A?", default=False):
                add_res = run_git(repo_path, config.timeout_seconds, ["add", "-A"])
                commands.append(add_res.command)
                if add_res.returncode != 0:
                    return finish(
                        SyncResult(
                            success=False,
                            action="error",
                            reason="git add failed",
                            repo_path=str(repo_path),
                            remote=config.remote,
                            branch=config.branch,
                            stderr=add_res.stderr,
                            commands=commands,
                        ),
                        started,
                    )

            has_staged, has_unstaged, status_error = read_working_tree_state(repo_path, config, commands)
            if status_error is not None:
                return finish(status_error, started)

            if has_staged:
                if has_unstaged:
                    print("[gitsync] Unstaged changes will not be included in the commit.")

                if ask_yes_no("Create a commit from staged changes now?", default=False):
                    default_message = datetime.now().strftime("chore: gitsync snapshot %Y-%m-%d %H:%M:%S")
                    commit_message = ""

                    use_ai_commit = ai_commit_enabled and ask_yes_no(
                        "Generate the commit message by AI?",
                        default=False,
                    )

                    if use_ai_commit:
                        generated_message, generation_error = generate_ai_commit_message(
                            repo_path,
                            config,
                            commands,
                        )
                        if generated_message:
                            commit_message = generated_message
                            print(f"[gitsync] AI commit message: {commit_message}")
                        else:
                            print(f"[gitsync] AI commit message failed: {generation_error}")
                            commit_message = prompt_manual_commit_message(default_message)
                    else:
                        commit_message = prompt_manual_commit_message(default_message)

                    commit_res = run_git_commit(
                        repo_path,
                        config.timeout_seconds,
                        commit_message,
                    )
                    commands.append(commit_res.command)
                    if commit_res.returncode != 0:
                        commit_stderr = commit_res.stderr or commit_res.stdout
                        return finish(
                            SyncResult(
                                success=False,
                                action="error",
                                reason="git commit failed",
                                repo_path=str(repo_path),
                                remote=config.remote,
                                branch=config.branch,
                                stderr=commit_stderr,
                                commands=commands,
                            ),
                            started,
                        )

                    committed_this_run = True
                    print("[gitsync] Local commit created successfully.")

                    has_staged, has_unstaged, status_error = read_working_tree_state(repo_path, config, commands)
                    if status_error is not None:
                        return finish(status_error, started)
        else:
            print("[gitsync] Non-interactive mode: add/commit prompts are disabled.")

    if has_staged or has_unstaged:
        remaining = "staged and unstaged"
        if has_staged and not has_unstaged:
            remaining = "staged"
        elif has_unstaged and not has_staged:
            remaining = "unstaged"

        return finish(
            SyncResult(
                success=False,
                action="skip",
                reason=f"working tree still has {remaining} changes; sync skipped",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                commands=commands,
            ),
            started,
        )

    fetch_res = run_git(repo_path, config.timeout_seconds, ["fetch", config.remote, config.branch, "--prune"])
    commands.append(fetch_res.command)
    if fetch_res.returncode != 0:
        return finish(
            SyncResult(
                success=False,
                action="error",
                reason="git fetch failed",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=fetch_res.stderr,
                commands=commands,
            ),
            started,
        )

    compare_res = run_git(
        repo_path,
        config.timeout_seconds,
        ["rev-list", "--left-right", "--count", f"HEAD...{config.remote}/{config.branch}"],
    )
    commands.append(compare_res.command)
    if compare_res.returncode != 0:
        return finish(
            SyncResult(
                success=False,
                action="error",
                reason="failed to compare local and remote commits",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=compare_res.stderr,
                commands=commands,
            ),
            started,
        )

    try:
        ahead_str, behind_str = compare_res.stdout.split()
        ahead = int(ahead_str)
        behind = int(behind_str)
    except ValueError:
        return finish(
            SyncResult(
                success=False,
                action="error",
                reason="unexpected rev-list output",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=compare_res.stdout,
                commands=commands,
            ),
            started,
        )

    if ahead == 0 and behind == 0:
        return finish(
            SyncResult(
                success=True,
                action="none",
                reason="up-to-date",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                ahead=ahead,
                behind=behind,
                commands=commands,
            ),
            started,
        )

    if behind > 0 and ahead == 0:
        ff_res = run_git(repo_path, config.timeout_seconds, ["merge", "--ff-only", f"{config.remote}/{config.branch}"])
        commands.append(ff_res.command)
        if ff_res.returncode != 0:
            return finish(
                SyncResult(
                    success=False,
                    action="error",
                    reason="fast-forward sync failed",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    ahead=ahead,
                    behind=behind,
                    stderr=ff_res.stderr,
                    commands=commands,
                ),
                started,
            )

        return finish(
            SyncResult(
                success=True,
                action="pull",
                reason="fast-forwarded from remote",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                ahead=ahead,
                behind=behind,
                commands=commands,
            ),
            started,
        )

    if ahead > 0 and behind == 0:
        if not interactive:
            return finish(
                SyncResult(
                    success=False,
                    action="skip",
                    reason="local commits ahead; push requires interactive confirmation",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    ahead=ahead,
                    behind=behind,
                    commands=commands,
                ),
                started,
            )

        if not ask_yes_no("Local commits are ahead of remote. Push now?", default=False):
            return finish(
                SyncResult(
                    success=False,
                    action="skip",
                    reason="local commits ahead; push not confirmed",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    ahead=ahead,
                    behind=behind,
                    commands=commands,
                ),
                started,
            )

        push_res = run_git(repo_path, config.timeout_seconds, ["push", config.remote, f"HEAD:{config.branch}"])
        commands.append(push_res.command)
        if push_res.returncode != 0:
            return finish(
                SyncResult(
                    success=False,
                    action="error",
                    reason="push failed",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    ahead=ahead,
                    behind=behind,
                    stderr=push_res.stderr,
                    commands=commands,
                ),
                started,
            )

        return finish(
            SyncResult(
                success=True,
                action="push",
                reason="local commits pushed to remote",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                ahead=ahead,
                behind=behind,
                commands=commands,
            ),
            started,
        )

    if interactive:
        print("[gitsync] Remote sync not completed: local and remote have diverged.")
        if committed_this_run:
            print("[gitsync] Your local commit was created successfully and is still preserved.")

        diverged_choice = ask_choice(
            "Choose how to resolve divergence",
            {
                "1": "pull and create a merge commit",
                "2": "rebase local commits onto remote branch",
                "3": "force push with lease (overwrite remote if unchanged since fetch)",
                "4": "skip and resolve manually later",
            },
            default="4",
        )

        if diverged_choice == "1":
            merge_res = run_git(repo_path, config.timeout_seconds, ["pull", "--no-rebase", config.remote, config.branch])
            commands.append(merge_res.command)
            if merge_res.returncode != 0:
                merge_output = combine_command_output(merge_res.stdout, merge_res.stderr)
                merge_reason = "pull and merge failed; local commit remains successful"
                if has_git_conflict(merge_output):
                    merge_reason = "pull and merge encountered conflicts; local commit remains successful"
                return finish(
                    SyncResult(
                        success=False,
                        action="error",
                        reason=merge_reason,
                        repo_path=str(repo_path),
                        remote=config.remote,
                        branch=config.branch,
                        ahead=ahead,
                        behind=behind,
                        stderr=merge_output,
                        commands=commands,
                    ),
                    started,
                )

            return finish(
                SyncResult(
                    success=True,
                    action="merge",
                    reason="divergence resolved by pull merge; local commit preserved",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    commands=commands,
                ),
                started,
            )

        if diverged_choice == "2":
            rebase_res = run_git(repo_path, config.timeout_seconds, ["pull", "--rebase", config.remote, config.branch])
            commands.append(rebase_res.command)
            if rebase_res.returncode != 0:
                rebase_output = combine_command_output(rebase_res.stdout, rebase_res.stderr)
                rebase_reason = "rebase failed; local commit remains successful"
                if has_git_conflict(rebase_output):
                    rebase_reason = "rebase encountered conflicts; local commit remains successful"
                return finish(
                    SyncResult(
                        success=False,
                        action="error",
                        reason=rebase_reason,
                        repo_path=str(repo_path),
                        remote=config.remote,
                        branch=config.branch,
                        ahead=ahead,
                        behind=behind,
                        stderr=rebase_output,
                        commands=commands,
                    ),
                    started,
                )

            return finish(
                SyncResult(
                    success=True,
                    action="rebase",
                    reason="divergence resolved by rebase; local commit preserved",
                    repo_path=str(repo_path),
                    remote=config.remote,
                    branch=config.branch,
                    commands=commands,
                ),
                started,
            )

        if diverged_choice == "3":
            if not ask_yes_no(
                "Force push with lease will overwrite remote history if it still matches the fetched state. Continue?",
                default=False,
            ):
                diverged_choice = "4"
            else:
                push_res = run_git(repo_path, config.timeout_seconds, ["push", "--force-with-lease", config.remote, f"HEAD:{config.branch}"])
                commands.append(push_res.command)
                if push_res.returncode != 0:
                    push_output = combine_command_output(push_res.stdout, push_res.stderr)
                    return finish(
                        SyncResult(
                            success=False,
                            action="error",
                            reason="force push with lease failed; local commit remains successful",
                            repo_path=str(repo_path),
                            remote=config.remote,
                            branch=config.branch,
                            ahead=ahead,
                            behind=behind,
                            stderr=push_output,
                            commands=commands,
                        ),
                        started,
                    )

                return finish(
                    SyncResult(
                        success=True,
                        action="force-push",
                        reason="divergence resolved by force push with lease",
                        repo_path=str(repo_path),
                        remote=config.remote,
                        branch=config.branch,
                        commands=commands,
                    ),
                    started,
                )

    return finish(
        SyncResult(
            success=False,
            action="skip",
            reason="remote sync not completed because local and remote diverged; local commit remains successful",
            repo_path=str(repo_path),
            remote=config.remote,
            branch=config.branch,
            ahead=ahead,
            behind=behind,
            commands=commands,
        ),
        started,
    )


if __name__ == "__main__":
    sys.exit(main())
