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
| State | React Query (server state) + Zustand (UI state) |

## Backend

| Concern | Choice |
|---|---|
| Runtime | Node.js (LTS) |
| Language | TypeScript |
| Framework | Fastify |
| Git (local mode) | simple-git |
| Git (cloud mode) | GitHub REST API / GitLab REST API (via Octokit / native fetch) |

The backend exposes a unified **Git Adapter** interface with two implementations:
- `LocalGitAdapter` — clones/reads from a filesystem path; used in sidecar mode
- `RemoteGitAdapter` — reads/writes via REST API; used in cloud mode

Mode is selected at boot via environment variable (`WHEATLEY_MODE=local|remote`).

## Storage

No separate database. The target repository's markdown files are the source of truth:

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
