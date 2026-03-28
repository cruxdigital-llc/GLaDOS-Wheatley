<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly. GLaDOS will read the current state before making future updates.
-->

# Tech Stack

## Frontend

| Concern | Choice |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| Bundler | Vite |
| Styling | TailwindCSS |
| State | React Query (server state) + React useState/useReducer (local UI state) |

## Backend

| Concern | Choice |
|---|---|
| Runtime | Node.js (LTS) |
| Language | TypeScript |
| Framework | Fastify |
| Git (local mode) | simple-git |
| Git (cloud mode) | GitHub REST API via Octokit |

The backend exposes a unified **Git Adapter** interface with two implementations:
- `LocalGitAdapter` — clones/reads from a filesystem path; used in sidecar mode
- `RemoteGitAdapter` — reads/writes via REST API; used in cloud mode

Mode is selected at boot via environment variable (`WHEATLEY_MODE=local|remote`).

## Storage

**No relational database. No cache layer. No separate state.** Git and markdown are the storage layer — this is a deliberate design decision, not a limitation. The tradeoff is speed for simplicity and auditability: every state change is a git commit.

The target repository's markdown files are the source of truth:

| Artifact | Purpose |
|---|---|
| `product-knowledge/ROADMAP.md` | Unclaimed items |
| `specs/` directories | In-flight features and their current phase |
| `product-knowledge/PROJECT_STATUS.md` | Active tasks and current focus |
| `product-knowledge/claims.md` | Claim ledger (written by Wheatley) |

## Deployment

| Mode | Description |
|---|---|
| **Sidecar (Docker)** | Container with access to the host repo via volume mount; `WHEATLEY_MODE=local` |
| **Cloud** | Standalone service deployed to any container host; authenticates to GitHub/GitLab via PAT or OAuth; `WHEATLEY_MODE=remote` |

Both modes are packaged as the same Docker image. A `docker-compose.yml` is provided for the sidecar use case.

## Infrastructure

- **Containerization**: Docker (single multi-stage image)
- **Compose**: `docker-compose.yml` for local sidecar boot
- **Config**: Environment variables only (no config files at runtime)
- **CI**: GitHub Actions (lint, typecheck, build, test)

## Parsing Contract

Wheatley must parse GLaDOS artifacts reliably. This requires a strict, machine-readable grammar for:

- **ROADMAP.md**: Task items, phase markers, completion status
- **specs/ directories**: Directory naming convention, phase detection from contents
- **PROJECT_STATUS.md**: Active task extraction

The parsing grammar is a first-class architectural concern. Fuzzy matching is not acceptable — the contract must be explicit so that two independent parsers would produce identical board state from the same repo. GLaDOS should enforce this format in a "strict mode"; Wheatley should include a standardization workflow for brownfield codebases that don't yet conform.

## Source Watching & Sync

Wheatley must detect repo changes and refresh board state. Architecture:

- **Local mode**: Watch `.git/` directory (e.g., `HEAD`, `refs/`) for changes via filesystem events
- **Cloud mode**: Poll the API on a configurable interval
- **Debounce**: Rapid commits must be coalesced — a fast-moving repo should not trigger per-commit re-renders
- **Full re-sync**: Periodic or on-demand full re-parse as a fallback to catch anything the watcher missed
