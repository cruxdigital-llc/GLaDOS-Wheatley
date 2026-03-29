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

### 2. Phase 2 — Claims & Assignment

- [x] **Claims Data Model**: claims.md format spec, lifecycle states, validator rules (3 new rules, 8 new tests)
- [x] **Claim Operations (Backend)**: GitAdapter write ops, POST/DELETE /api/claims, ConflictError, coordination branch
- [x] **Claim Operations (Frontend)**: Claim/Release buttons, conflict modal, filter dropdown, user identity
- [x] **Cross-Branch Claim Visibility**: Coordination branch claim reads, stale claim detection, visual indicators

### 3. Phase 3 — Phase Transitions & Workflow Triggers

- [x] **Phase Transition Engine**: valid transitions, file actions, commit generation, validation
- [x] **Drag-and-Drop UI**: native HTML5 DnD, drop zone validation, optimistic updates, confirmation dialog
- [x] **GLaDOS Workflow Integration**: webhook system, workflow status polling, "GLaDOS Running..." UI feedback
- [x] **Status Writeback**: PROJECT_STATUS.md updates, spec directory file creation, machine-parseable commits

### 4. Phase 4 — Multi-Branch Awareness

- [x] **Branch Enumeration & Scanning**: configurable include/exclude filters, SHA-based caching, independent per-branch parsing
- [x] **Consolidated Board View**: mergeBoards deduplication, branch badges, single/consolidated view toggle
- [x] **Branch Diff & Health**: commits-behind indicator, last commit date, unique specs, conflict risk detection

### 5. Phase 5 — Team & Agent Coordination

- [x] **Agent Activity Feed**: trace log format, activity parser, real-time feed UI, agent/human identity classification
- [x] **Claim TTL & Auto-Release**: configurable TTL (24h default), staleness detection, auto-release, grace period warnings
- [x] **Conflict Early Warning**: cross-branch spec overlap detection, resolution suggestions based on branch size
- [x] **Notification Hooks**: webhook system with Slack formatter, event log, configurable per event type

### 6. Backlog / Upcoming

- [ ] Phase 6: Authentication & Multi-Tenancy (4 features, 15 items)
- [ ] Phase 7: Polish & Production Readiness (3 features, 15 items)

## Known Issues / Technical Debt

*None critical.*

## Recent Changes

- 2026-03-28: Project initialized. Mission, roadmap, and tech stack defined.
- 2026-03-28: **PHASE 1 COMPLETE** — 194 tests passing, 51/51 roadmap items done.
- 2026-03-28: Feature 2.1 (Claims Data Model) complete — 202 tests, grammar spec, lifecycle states, 3 new validator rules.
- 2026-03-28: Feature 2.2 (Claim Operations Backend) complete — 234 tests, GitAdapter write ops, claim/release API, conflict detection.
- 2026-03-28: Feature 2.3 (Claim Operations Frontend) complete — Claim/Release UI, conflict modal, filters.
- 2026-03-28: Feature 2.4 (Cross-Branch Claims) complete — 241 tests, coordination branch reads, stale detection.
- 2026-03-28: **PHASE 2 COMPLETE** — 246 tests passing, 18/18 roadmap items done.
- 2026-03-28: Feature 3.1 (Phase Transition Engine) complete — 307 tests, validation, actions, service, API.
- 2026-03-28: Features 3.2-3.4 complete — drag-and-drop, GLaDOS webhooks, status writeback.
- 2026-03-28: **PHASE 3 COMPLETE** — 316 tests passing, 15/15 roadmap items done.
- 2026-03-28: Features 4.1-4.3 complete — branch scanning, consolidated view, branch health.
- 2026-03-28: **PHASE 4 COMPLETE** — 339 tests passing, 12/12 roadmap items done.
- 2026-03-28: Features 5.1-5.4 complete — activity feed, claim TTL, conflict detection, notification hooks.
- 2026-03-28: **PHASE 5 COMPLETE** — 397 tests passing, 14/14 roadmap items done.
- 2026-03-28: Roadmap extended with Phase 6 (Auth & Multi-Tenancy) and Phase 7 (Polish & Production Readiness).
