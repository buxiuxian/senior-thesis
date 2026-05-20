from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List, Optional
import subprocess
import time


@dataclass
class SyncConfig:
    enabled: bool = True
    repo_path: str = ""
    remote: str = "origin"
    branch: str = "main"
    timeout_seconds: int = 30
    require_gh_auth: bool = True


@dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str


@dataclass
class SyncResult:
    success: bool
    action: str
    reason: str
    repo_path: str
    remote: str
    branch: str
    ahead: int = 0
    behind: int = 0
    duration_seconds: float = 0.0
    stderr: str = ""
    commands: List[str] = field(default_factory=list)


def parse_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _find_git_root(start_path: Path) -> Optional[Path]:
    for candidate in [start_path, *start_path.parents]:
        if (candidate / ".git").exists():
            return candidate
    return None


def resolve_repo_path(configured_path: str, anchors: Iterable[Path]) -> Optional[Path]:
    if configured_path:
        candidate = Path(configured_path).expanduser().resolve()
        if (candidate / ".git").exists():
            return candidate
        return None

    seen = set()
    for anchor in anchors:
        resolved = anchor.resolve()
        root = _find_git_root(resolved)
        if root is None:
            continue
        key = str(root)
        if key in seen:
            continue
        seen.add(key)
        return root

    return None


def run_command(command: List[str], timeout_seconds: int, cwd: Optional[Path] = None) -> CommandResult:
    try:
        completed = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=timeout_seconds,
            check=False,
        )
        return CommandResult(
            command=" ".join(command),
            returncode=completed.returncode,
            stdout=(completed.stdout or "").rstrip("\r\n"),
            stderr=(completed.stderr or "").strip(),
        )
    except subprocess.TimeoutExpired as exc:
        return CommandResult(
            command=" ".join(command),
            returncode=-1,
            stdout=(exc.stdout or "").rstrip("\r\n"),
            stderr=f"command timed out after {timeout_seconds}s",
        )
    except OSError as exc:
        return CommandResult(
            command=" ".join(command),
            returncode=-1,
            stdout="",
            stderr=str(exc),
        )


def run_git(repo_path: Path, timeout_seconds: int, args: List[str]) -> CommandResult:
    command = ["git", "-C", str(repo_path)] + args
    return run_command(command, timeout_seconds)


def _precheck(config: SyncConfig, repo_path: Path) -> Optional[SyncResult]:
    git_check = run_command(["git", "--version"], config.timeout_seconds)
    if git_check.returncode != 0:
        return SyncResult(
            success=False,
            action="skip",
            reason="git command unavailable",
            repo_path=str(repo_path),
            remote=config.remote,
            branch=config.branch,
            stderr=git_check.stderr,
            commands=[git_check.command],
        )

    if config.require_gh_auth:
        gh_check = run_command(["gh", "auth", "status"], config.timeout_seconds)
        if gh_check.returncode != 0:
            return SyncResult(
                success=False,
                action="skip",
                reason="gh not authenticated",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=gh_check.stderr,
                commands=[git_check.command, gh_check.command],
            )

    repo_check = run_git(repo_path, config.timeout_seconds, ["rev-parse", "--is-inside-work-tree"])
    if repo_check.returncode != 0 or repo_check.stdout.lower() != "true":
        return SyncResult(
            success=False,
            action="skip",
            reason="target path is not a git work tree",
            repo_path=str(repo_path),
            remote=config.remote,
            branch=config.branch,
            stderr=repo_check.stderr,
            commands=[git_check.command, repo_check.command],
        )

    remote_check = run_git(repo_path, config.timeout_seconds, ["remote", "get-url", config.remote])
    if remote_check.returncode != 0:
        return SyncResult(
            success=False,
            action="skip",
            reason=f"git remote '{config.remote}' not found",
            repo_path=str(repo_path),
            remote=config.remote,
            branch=config.branch,
            stderr=remote_check.stderr,
            commands=[git_check.command, remote_check.command],
        )

    return None


def _finalize(result: SyncResult, started: float) -> SyncResult:
    result.duration_seconds = round(time.monotonic() - started, 3)
    return result


def run_startup_sync(config: SyncConfig, anchors: Iterable[Path]) -> SyncResult:
    started = time.monotonic()

    repo_path = resolve_repo_path(config.repo_path, anchors)
    if not config.enabled:
        return _finalize(
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
        return _finalize(
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

    precheck = _precheck(config, repo_path)
    if precheck is not None:
        return _finalize(precheck, started)

    commands: List[str] = []

    status_res = run_git(repo_path, config.timeout_seconds, ["status", "--porcelain"])
    commands.append(status_res.command)
    if status_res.returncode != 0:
        return _finalize(
            SyncResult(
                success=False,
                action="error",
                reason="failed to inspect working tree",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                stderr=status_res.stderr,
                commands=commands,
            ),
            started,
        )

    if status_res.stdout:
        return _finalize(
            SyncResult(
                success=False,
                action="skip",
                reason="working tree is dirty; sync skipped",
                repo_path=str(repo_path),
                remote=config.remote,
                branch=config.branch,
                commands=commands,
            ),
            started,
        )

    # Mandatory first step: fetch latest remote state.
    fetch_res = run_git(repo_path, config.timeout_seconds, ["fetch", config.remote, config.branch, "--prune"])
    commands.append(fetch_res.command)
    if fetch_res.returncode != 0:
        return _finalize(
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
        return _finalize(
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
        return _finalize(
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
        return _finalize(
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
            return _finalize(
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

        return _finalize(
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
        push_res = run_git(repo_path, config.timeout_seconds, ["push", config.remote, f"HEAD:{config.branch}"])
        commands.append(push_res.command)
        if push_res.returncode != 0:
            return _finalize(
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

        return _finalize(
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

    return _finalize(
        SyncResult(
            success=False,
            action="skip",
            reason="local and remote diverged; manual resolution required",
            repo_path=str(repo_path),
            remote=config.remote,
            branch=config.branch,
            ahead=ahead,
            behind=behind,
            commands=commands,
        ),
        started,
    )


def format_summary(result: SyncResult) -> str:
    return (
        f"action={result.action} success={result.success} "
        f"ahead={result.ahead} behind={result.behind} "
        f"reason={result.reason} repo={result.repo_path} "
        f"remote={result.remote}/{result.branch} duration={result.duration_seconds}s"
    )
