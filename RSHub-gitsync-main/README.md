# RSHub Git Sync Workspace

This is an independent workspace dedicated to GitHub sync behavior for the monorepo.
It is intentionally separated from `RSHub-agent-main` and `RSHub-web-main`.

## What It Does

- Uses only `gh` CLI and `git` commands for sync decisions.
- Sync sequence is fixed:
  1. validate prerequisites (`git`, optional `gh auth`, repo root, remote)
  2. inspect working tree state
  3. when local changes exist, prompt for optional `git add -A` and optional `git commit` (interactive mode only)
  4. when committing staged changes, generate commit message using `RSHub-agent-main/.env` configured base URL and API key
  5. `git fetch <remote> <branch> --prune`
  6. compare ahead/behind using `git rev-list --left-right --count HEAD...<remote>/<branch>`
  7. auto action:
     - behind only: fast-forward sync (`git merge --ff-only`)
     - ahead only: ask for push confirmation, then `git push` only if confirmed
     - diverged: skip and warn
     - dirty working tree: skip and warn if still not clean after prompts

## Workspace Structure

- `run_sync.py`: standalone runner (pure sync only)
- `rshub_gitsync/sync.py`: gh+git sync logic
- `env_example.txt`: environment configuration template
- `pyproject.toml`: independent project metadata

## Prerequisites

- Python 3.10+
- `git` available in PATH
- `gh` available in PATH
- `gh auth login` completed (unless you run with `--no-gh-auth`)
- `RSHub-agent-main/.env` exists with valid LLM provider config

### If `gh` Is Not Recognized

If you see an error like:

`gh: The term 'gh' is not recognized as a name of a cmdlet, function, script file, or executable program.`

It usually means GitHub CLI is not installed or not added to PATH.

Install on Windows:

```powershell
winget install --id GitHub.cli -e
```

After installation, close and reopen PowerShell, then verify:

```powershell
gh --version
gh auth login
```

## Quick Start

1. Create env file:

```powershell
cd RSHub-gitsync-main
copy env_example.txt .env
```

2. Confirm `RSHub-agent-main/.env` is configured.

3. Run sync:

```powershell
python run_sync.py
```

`run_sync.py` does not accept command line arguments.

## Notes

- This workspace does not start backend agent processes.
- Sync failure or skip is reported clearly in console logs.
- If your working tree is dirty, sync is skipped unless you explicitly confirm cleanup actions in interactive mode.
- No add/commit/push action is
- When AI commit generation fails, the script asks whether to use fallback timestamp message.
