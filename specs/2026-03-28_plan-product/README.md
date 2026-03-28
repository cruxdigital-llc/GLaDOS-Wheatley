# Plan Product Session — 2026-03-28

## Session Log

Ran `/glados/plan-product` for Wheatley based on the seed document and tech stack discussion.

## Decisions Made

### Roadmap
- 5 phases defined, matching the seed document exactly
- Phase 1 (Read-Only Board) is the MVP target
- Full roadmap written to `product-knowledge/ROADMAP.md`

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, React Query, Zustand
- **Backend**: Node.js + TypeScript, Fastify
- **Git abstraction**: Unified adapter pattern
  - `LocalGitAdapter` (simple-git) for sidecar/Docker mode
  - `RemoteGitAdapter` (GitHub/GitLab REST API) for cloud mode
  - Mode selected via `WHEATLEY_MODE=local|remote` env var
- **Deployment**: Single Docker image; `docker-compose.yml` for local sidecar; deployable standalone for cloud use case
- **No separate database** — repo markdown files are the source of truth

### Key Architectural Decision
Boot mode duality (local sidecar vs. cloud) was confirmed by the user. This means the git layer must be abstracted from day one — the board UI and parser logic are identical in both modes; only the git I/O differs.

## Files Created/Updated

- `product-knowledge/MISSION.md` — created
- `product-knowledge/ROADMAP.md` — created
- `product-knowledge/TECH_STACK.md` — created
- `product-knowledge/PROJECT_STATUS.md` — updated
