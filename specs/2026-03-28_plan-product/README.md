# Plan Product Session — 2026-03-28

## Session Log

Ran `/glados/plan-product` for Wheatley based on the seed document and tech stack discussion.

## Decisions Made

### Roadmap
- 5 phases defined, matching the seed document exactly
- Phase 1 (Read-Only Board) is the MVP target
- Full roadmap written to `product-knowledge/ROADMAP.md`

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, React Query + React useState/useReducer
- **Backend**: Node.js + TypeScript, Fastify
- **Git abstraction**: Unified adapter pattern
  - `LocalGitAdapter` (simple-git) for sidecar/Docker mode
  - `RemoteGitAdapter` (GitHub/GitLab REST API) for cloud mode
  - Mode selected via `WHEATLEY_MODE=local|remote` env var
- **Deployment**: Single Docker image; `docker-compose.yml` for local sidecar; deployable standalone for cloud use case
- **No separate database** — repo markdown files are the source of truth

### Key Architectural Decisions

1. **Boot mode duality** (local sidecar vs. cloud) was confirmed by the user. The git layer must be abstracted from day one — the board UI and parser logic are identical in both modes; only the git I/O differs.

2. **No relational database** — git/markdown is the storage layer. This is the whole advantage. Confirmed by @jed2nd in PR #1 review.

3. **Single state management strategy** — React Query for server state, React built-ins for local UI state. No Zustand. Avoid sprawling into multiple strategies. Confirmed by @jed2nd: "start with a strong opinion, avoid all 'or's."

4. **Parsing grammar** (added from PR #1 review by @zhendershot-crux) — strict, machine-readable contract for extracting tasks from GLaDOS artifacts. No fuzzy matching. GLaDOS should support a "strict mode"; Wheatley should include a standardization workflow for brownfield codebases.

5. **Source watching & sync** (added from PR #1 review by @zhendershot-crux) — `.git/` directory watcher for local mode, API polling for cloud, debounce for rapid commits, full re-sync fallback. Getting this right is critical for reliability.

## Files Created/Updated

- `product-knowledge/MISSION.md` — created
- `product-knowledge/ROADMAP.md` — created
- `product-knowledge/TECH_STACK.md` — created
- `product-knowledge/PROJECT_STATUS.md` — updated
