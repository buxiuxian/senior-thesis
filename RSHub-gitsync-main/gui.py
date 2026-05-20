"""RSHub GitSync — tkinter GUI.

A thin UI shell that replaces CLI prompts (ask_yes_no / ask_choice / input)
with tkinter messagebox / simpledialog. All git operations are 100% reused
from run_sync.py and rshub_gitsync/sync.py.
"""

from __future__ import annotations

import queue
import subprocess
import sys
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import messagebox, scrolledtext, simpledialog

# ---------------------------------------------------------------------------
# On Windows GUI (pythonw), prevent subprocess from flashing console windows.
# ---------------------------------------------------------------------------
if sys.platform == "win32":
    _orig_Popen_init = subprocess.Popen.__init__

    def _no_window_Popen_init(self, *args, **kwargs):
        if kwargs.get("startupinfo") is None:
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0
            kwargs["startupinfo"] = si
        _orig_Popen_init(self, *args, **kwargs)

    subprocess.Popen.__init__ = _no_window_Popen_init

# ---------------------------------------------------------------------------
# Ensure this script's directory is on sys.path so imports work when run
# directly via `python gui.py` from the RSHub-gitsync-main folder.
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from rshub_gitsync.sync import (  # noqa: E402
    SyncConfig,
    parse_bool,
    resolve_repo_path,
    run_command,
    run_git,
)
from run_sync import (  # noqa: E402
    build_sync_config,
    generate_ai_commit_message,
    load_env_file,
    parse_porcelain_status,
    read_working_tree_state,
    run_git_commit,
)

# ---------------------------------------------------------------------------
# Thread-safe dialog helpers
# ---------------------------------------------------------------------------

# Shared queues for cross-thread communication
_ask_queue: queue.Queue = queue.Queue()
_answer_queue: queue.Queue = queue.Queue()


def _ask_on_main_thread(kind: str, **kwargs):
    """Post a dialog request to the main thread and block until answered."""
    _ask_queue.put((kind, kwargs))
    return _answer_queue.get()


def _poll_ask_queue(root: tk.Tk):
    """Called periodically on the main thread to process dialog requests."""
    try:
        kind, kwargs = _ask_queue.get_nowait()
    except queue.Empty:
        root.after(50, _poll_ask_queue, root)
        return

    answer = None
    if kind == "yesno":
        answer = messagebox.askyesno(kwargs.get("title", "确认"), kwargs.get("message", ""))
    elif kind == "askstring":
        answer = simpledialog.askstring(
            kwargs.get("title", "输入"),
            kwargs.get("prompt", ""),
            initialvalue=kwargs.get("initialvalue", ""),
        )
    elif kind == "choice":
        answer = _show_choice_dialog(root, kwargs)

    _answer_queue.put(answer)
    root.after(50, _poll_ask_queue, root)


def _show_choice_dialog(root: tk.Tk, kwargs: dict) -> str:
    """Show a modal choice dialog and return the selected key."""
    choices: dict[str, str] = kwargs.get("choices", {})
    title = kwargs.get("title", "选择")
    message = kwargs.get("message", "")
    default = kwargs.get("default", "")

    result = [default]

    dialog = tk.Toplevel(root)
    dialog.title(title)
    dialog.resizable(False, False)
    dialog.grab_set()

    # Center on parent
    dialog.geometry("+%d+%d" % (root.winfo_x() + 80, root.winfo_y() + 80))

    if message:
        tk.Label(dialog, text=message, wraplength=350, justify="left", padx=10, pady=8).pack()

    for key, desc in choices.items():
        btn = tk.Button(
            dialog,
            text=f"{key}. {desc}",
            width=45,
            anchor="w",
            command=lambda k=key: (_set_and_close(result, k, dialog)),
        )
        btn.pack(padx=10, pady=3)

    dialog.protocol("WM_DELETE_WINDOW", lambda: _set_and_close(result, default, dialog))
    dialog.wait_window()
    return result[0]


def _set_and_close(result_list: list, value: str, dialog: tk.Toplevel):
    result_list[0] = value
    dialog.destroy()


# ---------------------------------------------------------------------------
# Main sync logic (runs in worker thread, uses _ask_on_main_thread for UI)
# ---------------------------------------------------------------------------


class GitSyncApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("RSHub GitSync")
        self.root.geometry("620x420")
        self.root.resizable(True, True)

        # -- Top frame: button
        top = tk.Frame(root, pady=8)
        top.pack(fill="x")

        self.sync_btn = tk.Button(
            top, text="🔄 同步", font=("Microsoft YaHei", 13, "bold"),
            width=14, height=1, command=self._on_sync_click,
        )
        self.sync_btn.pack()

        # -- Log area
        self.log = scrolledtext.ScrolledText(
            root, wrap="word", font=("Consolas", 9), state="disabled",
        )
        self.log.pack(fill="both", expand=True, padx=6, pady=(0, 6))

        # Start polling for dialog requests
        self.root.after(50, _poll_ask_queue, self.root)

    # -----------------------------------------------------------------------
    # Logging
    # -----------------------------------------------------------------------

    def _log(self, msg: str):
        """Thread-safe append to log widget."""
        self.root.after(0, self._log_main, msg)

    def _log_main(self, msg: str):
        self.log.configure(state="normal")
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    # -----------------------------------------------------------------------
    # Sync entry
    # -----------------------------------------------------------------------

    def _on_sync_click(self):
        self.sync_btn.configure(state="disabled")
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        threading.Thread(target=self._run_sync, daemon=True).start()

    def _run_sync(self):
        try:
            self._do_sync()
        except Exception as exc:
            self._log(f"[错误] 未处理异常: {exc}")
        finally:
            self.root.after(0, lambda: self.sync_btn.configure(state="normal"))

    def _do_sync(self):
        # 1) Load env
        script_dir = _SCRIPT_DIR
        gitsync_env = script_dir / ".env"
        load_env_file(gitsync_env, overwrite=True)

        agent_env = script_dir.parent / "RSHub-agent-main" / ".env"
        if load_env_file(agent_env, overwrite=True):
            self._log(f"[配置] 已加载 {agent_env}")
        else:
            self._log(f"[配置] 未找到 agent .env: {agent_env}")

        import os
        config = build_sync_config()
        ai_commit_enabled = parse_bool(os.getenv("GIT_SYNC_AI_COMMIT_ENABLED"), True)

        if not config.enabled:
            self._log("[跳过] GIT_SYNC_ENABLED=false，同步已禁用。")
            return

        # 2) Resolve repo
        anchors = [Path.cwd(), script_dir, script_dir.parent]
        repo_path = resolve_repo_path(config.repo_path, anchors)
        if repo_path is None:
            self._log("[错误] 未找到 Git 仓库根目录。")
            return
        self._log(f"[仓库] {repo_path}")

        # 3) Precheck
        git_check = run_command(["git", "--version"], config.timeout_seconds)
        if git_check.returncode != 0:
            self._log("[错误] git 命令不可用。")
            return

        if config.require_gh_auth:
            gh_check = run_command(["gh", "auth", "status"], config.timeout_seconds)
            if gh_check.returncode != 0:
                self._log("[错误] gh 未认证。请先运行 gh auth login。")
                return

        repo_check = run_git(repo_path, config.timeout_seconds, ["rev-parse", "--is-inside-work-tree"])
        if repo_check.returncode != 0 or repo_check.stdout.lower() != "true":
            self._log("[错误] 目标路径不是 git 工作树。")
            return

        remote_check = run_git(repo_path, config.timeout_seconds, ["remote", "get-url", config.remote])
        if remote_check.returncode != 0:
            self._log(f"[错误] git remote '{config.remote}' 不存在。")
            return

        # 4) Working tree state
        commands: list[str] = []
        has_staged, has_unstaged, status_error = read_working_tree_state(repo_path, config, commands)
        if status_error is not None:
            self._log(f"[错误] 无法检查工作树状态: {status_error.reason}")
            return

        # 5) Handle uncommitted changes
        if has_staged or has_unstaged:
            self._log("[状态] 工作树有本地改动。")
            if has_unstaged:
                self._log("  - 有未暂存的改动")
            if has_staged:
                self._log("  - 有已暂存但未提交的改动")

            # Ask to add
            if has_unstaged:
                do_add = _ask_on_main_thread(
                    "yesno",
                    title="暂存改动",
                    message="检测到未暂存的改动。\n是否执行 git add -A 暂存所有？",
                )
                if do_add:
                    add_res = run_git(repo_path, config.timeout_seconds, ["add", "-A"])
                    if add_res.returncode != 0:
                        self._log(f"[错误] git add 失败: {add_res.stderr}")
                        return
                    self._log("[完成] git add -A")

            # Re-check state after add
            has_staged, has_unstaged, status_error = read_working_tree_state(repo_path, config, commands)
            if status_error is not None:
                self._log(f"[错误] {status_error.reason}")
                return

            # Ask to commit
            if has_staged:
                if has_unstaged:
                    self._log("  ⚠ 仍有未暂存改动，不会包含在提交中。")

                do_commit = _ask_on_main_thread(
                    "yesno",
                    title="提交改动",
                    message="有已暂存的改动。\n是否创建一个 commit？",
                )
                if do_commit:
                    commit_message = self._get_commit_message(
                        repo_path, config, ai_commit_enabled, commands
                    )
                    if commit_message:
                        commit_res = run_git_commit(repo_path, config.timeout_seconds, commit_message)
                        commands.append(commit_res.command)
                        if commit_res.returncode != 0:
                            self._log(f"[错误] git commit 失败: {commit_res.stderr or commit_res.stdout}")
                            return
                        self._log("[完成] 本地 commit 创建成功。")
                    else:
                        self._log("[跳过] 未提供 commit message，取消提交。")

                    # Re-check
                    has_staged, has_unstaged, status_error = read_working_tree_state(repo_path, config, commands)
                    if status_error is not None:
                        self._log(f"[错误] {status_error.reason}")
                        return

        # If still dirty, skip sync
        if has_staged or has_unstaged:
            self._log("[跳过] 工作树仍有未处理改动，远程同步已跳过。")
            return

        # 6) Fetch remote
        self._log(f"[同步] 正在 fetch {config.remote}/{config.branch} ...")
        fetch_res = run_git(repo_path, config.timeout_seconds, ["fetch", config.remote, config.branch, "--prune"])
        if fetch_res.returncode != 0:
            self._log(f"[错误] git fetch 失败: {fetch_res.stderr}")
            return

        # 7) Compare ahead/behind
        compare_res = run_git(
            repo_path, config.timeout_seconds,
            ["rev-list", "--left-right", "--count", f"HEAD...{config.remote}/{config.branch}"],
        )
        if compare_res.returncode != 0:
            self._log(f"[错误] 无法比较本地和远程: {compare_res.stderr}")
            return

        try:
            ahead_str, behind_str = compare_res.stdout.split()
            ahead = int(ahead_str)
            behind = int(behind_str)
        except ValueError:
            self._log(f"[错误] rev-list 输出异常: {compare_res.stdout}")
            return

        self._log(f"[状态] ahead={ahead}, behind={behind}")

        # 8) Already up to date
        if ahead == 0 and behind == 0:
            self._log("[完成] ✅ 已是最新，无需操作。")
            return

        # 9) Behind only → pull
        if behind > 0 and ahead == 0:
            do_pull = _ask_on_main_thread(
                "yesno",
                title="拉取更新",
                message=f"远程有 {behind} 个新提交。\n是否拉取（fast-forward merge）？",
            )
            if do_pull:
                ff_res = run_git(repo_path, config.timeout_seconds, ["merge", "--ff-only", f"{config.remote}/{config.branch}"])
                if ff_res.returncode != 0:
                    self._log(f"[错误] fast-forward 失败: {ff_res.stderr}")
                    return
                self._log(f"[完成] ✅ 已拉取 {behind} 个提交。")
            else:
                self._log("[跳过] 用户取消拉取。")
            return

        # 10) Ahead only → push
        if ahead > 0 and behind == 0:
            do_push = _ask_on_main_thread(
                "yesno",
                title="推送提交",
                message=f"本地有 {ahead} 个新提交领先远程。\n是否推送到 {config.remote}/{config.branch}？",
            )
            if do_push:
                push_res = run_git(repo_path, config.timeout_seconds, ["push", config.remote, f"HEAD:{config.branch}"])
                if push_res.returncode != 0:
                    self._log(f"[错误] push 失败: {push_res.stderr}")
                    return
                self._log(f"[完成] ✅ 已推送 {ahead} 个提交。")
            else:
                self._log("[跳过] 用户取消推送。")
            return

        # 11) Diverged
        self._log(f"[冲突] 本地和远程已分叉 (ahead={ahead}, behind={behind})。")
        choice = _ask_on_main_thread(
            "choice",
            title="分叉处理",
            message=f"本地领先 {ahead} 个提交，落后 {behind} 个提交。\n请选择处理方式：",
            choices={
                "1": "Pull & Merge（创建合并提交）",
                "2": "Rebase（将本地提交变基到远程之上）",
                "3": "Force Push with Lease（强制推送覆盖远程）",
                "4": "跳过，稍后手动处理",
            },
            default="4",
        )

        if choice == "1":
            merge_res = run_git(repo_path, config.timeout_seconds, ["pull", "--no-rebase", config.remote, config.branch])
            if merge_res.returncode != 0:
                self._log(f"[错误] pull merge 失败: {merge_res.stderr or merge_res.stdout}")
                return
            self._log("[完成] ✅ 分叉已通过 merge 解决。")

        elif choice == "2":
            rebase_res = run_git(repo_path, config.timeout_seconds, ["pull", "--rebase", config.remote, config.branch])
            if rebase_res.returncode != 0:
                self._log(f"[错误] rebase 失败: {rebase_res.stderr or rebase_res.stdout}")
                return
            self._log("[完成] ✅ 分叉已通过 rebase 解决。")

        elif choice == "3":
            confirm = _ask_on_main_thread(
                "yesno",
                title="确认强制推送",
                message="Force push with lease 会覆盖远程历史。\n确定要继续吗？",
            )
            if confirm:
                fp_res = run_git(repo_path, config.timeout_seconds, ["push", "--force-with-lease", config.remote, f"HEAD:{config.branch}"])
                if fp_res.returncode != 0:
                    self._log(f"[错误] force push 失败: {fp_res.stderr or fp_res.stdout}")
                    return
                self._log("[完成] ✅ 分叉已通过 force push 解决。")
            else:
                self._log("[跳过] 用户取消 force push。")
        else:
            self._log("[跳过] 用户选择稍后手动处理。")

    # -----------------------------------------------------------------------
    # Commit message helper
    # -----------------------------------------------------------------------

    def _get_commit_message(
        self,
        repo_path: Path,
        config: SyncConfig,
        ai_commit_enabled: bool,
        commands: list[str],
    ) -> str | None:
        default_message = datetime.now().strftime("chore: gitsync snapshot %Y-%m-%d %H:%M:%S")

        if ai_commit_enabled:
            use_ai = _ask_on_main_thread(
                "yesno",
                title="AI Commit Message",
                message="是否使用 AI 生成 commit message？\n\n选「否」将手动输入。",
            )
            if use_ai:
                self._log("[AI] 正在生成 commit message ...")
                generated, error = generate_ai_commit_message(repo_path, config, commands)
                if generated:
                    self._log(f"[AI] 生成结果:\n{generated}")
                    # Let user confirm or edit
                    final_msg = _ask_on_main_thread(
                        "askstring",
                        title="确认 Commit Message",
                        prompt="AI 生成的 commit message（可编辑）：",
                        initialvalue=generated,
                    )
                    return final_msg if final_msg else None
                else:
                    self._log(f"[AI] 生成失败: {error}")
                    self._log("[AI] 回退到手动输入。")

        # Manual input
        msg = _ask_on_main_thread(
            "askstring",
            title="Commit Message",
            prompt="请输入 commit message：",
            initialvalue=default_message,
        )
        return msg if msg else None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    root = tk.Tk()
    GitSyncApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
