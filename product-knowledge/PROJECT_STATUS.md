<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly. GLaDOS will read the current state before making future updates.
-->

# GLaDOS System Status

## Project Overview

**Mission**: [product-knowledge/MISSION.md](MISSION.md)
**Current Phase**: Implementing

Wheatley is a lightweight, local-first (and cloud-capable) project board that renders a Kanban view of a GLaDOS-managed repo's markdown files. No external database — the repo is the board.

## Architecture

**Frontend**: React 18 + TypeScript, Vite, TailwindCSS, React Query
**Backend**: Node.js + TypeScript, Fastify
**Git Layer**: Unified adapter — `LocalGitAdapter` (simple-git, sidecar mode) and `RemoteGitAdapter` (GitHub/GitLab REST API, cloud mode)
**Storage**: Target repo's markdown files (`ROADMAP.md`, `specs/`, `PROJECT_STATUS.md`, `claims.md`)
**Deployment**: Single Docker image; sidecar via volume mount or standalone cloud service

See [product-knowledge/TECH_STACK.md](TECH_STACK.md) for full details.

## Current Focus

### 1. Phase 1 — Read-Only Board (MVP)

*Lead: TBD*

- [x] **Repo parser**: Extract unclaimed items from `ROADMAP.md`, phase from `specs/` directories, active tasks from `PROJECT_STATUS.md`
- [x] **API Server**: Fastify with board, branch, health endpoints
- [x] **Kanban board UI**: Column-based view mapping GLaDOS phases to columns
- [x] **Card detail view**: Show README, spec, plan, and requirements from a feature's `specs/` directory
- [x] **Branch selector**: Switch which branch the board reads from
- [x] **Conformance analyzer**: GET /api/conformance for brownfield repos
- [x] **Git adapter**: Unified interface with local (simple-git) and remote (API) implementations
- [x] **Docker packaging**: Single image supporting both `local` and `remote` boot modes
- [x] **Parsing grammar**: Strict, machine-readable contract for extracting tasks from ROADMAP.md, specs/, and PROJECT_STATUS.md
- [x] **Source watching & sync**: `.git/` watcher (local), API polling (cloud), debounce, full re-sync fallback

### 2. Backlog / Upcoming

- [ ] Phase 2: Claims & Assignment
- [ ] Phase 3: Phase Transitions & Workflow Triggers
- [ ] Phase 4: Multi-Branch Awareness
- [ ] Phase 5: Team & Agent Coordination

## Known Issues / Technical Debt

*None yet — project is in planning.*

## Recent Changes

- 2026-03-28: Project initialized. Mission, roadmap, and tech stack defined.
- 2026-03-28: PR #1 review feedback incorporated — removed Zustand, reinforced no-database stance, added parsing grammar and sync architecture as Phase 1 items.
- 2026-03-28: Feature 1.1 (Parsing Grammar) complete — 44 validator tests, phase detection, grammar spec.
- 2026-03-28: Feature 1.2 (Markdown Parsers) complete — 88 tests total, section-level spec matching, shared utils.
- 2026-03-28: Feature 1.3 (Git Adapter) complete — 130 tests total, path traversal protection, dual-mode adapter.
- 2026-03-28: Feature 1.4 (Source Watching) complete — 172 tests total, SHA-based polling, debounce, event bus.
- 2026-03-28: Feature 1.5 (API Server) complete — 189 tests total, stateless branch API, graceful shutdown.
- 2026-03-28: Feature 1.6 (Frontend) complete — React + TailwindCSS Kanban board.
- 2026-03-28: Feature 1.7 (Brownfield) complete — conformance analyzer + API endpoint.
- 2026-03-28: Feature 1.8 (Docker) complete — multi-stage Dockerfile with health check.
- 2026-03-28: **PHASE 1 COMPLETE** — 194 tests passing, 48/48 roadmap items done.
