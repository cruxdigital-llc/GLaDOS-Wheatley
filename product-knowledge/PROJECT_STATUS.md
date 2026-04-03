<!--
SDA: v1.0
Last Updated: 2026-04-02
-->

<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-29
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

### 6. Phase 6 — Robust Git Engine & Real-Time Sync

- [x] **Worktree Isolation**: Dedicated git worktree for all writes — developer's working tree never touched
- [x] **Dirty State & Conflict Handling**: Repo status API, dirty/conflict indicators, resolution prompts
- [x] **Git Identity & Config**: Auto-detect from git config, env var override, UI auto-populate
- [x] **Sync & Real-Time**: SSE endpoint, Sync button, GitHub/GitLab webhook receivers, polling fallback
- [x] **Persistent Event Log**: File-backed events.md, rotation, replay API

### 7. Phase 7 — Content Editing & Card Management

- [x] **Card CRUD**: Create cards via modal, rename inline, delete with confirmation, ROADMAP.md auto-update
- [x] **Inline Spec Editing**: MarkdownEditor component, save/cancel, allowlisted file types, content size limit
- [x] **Comments**: Per-spec comment thread, append-only markdown format, author sanitization
- [x] **Task Checkboxes**: Interactive `tasks.md` checkbox toggling with optimistic updates

### 8. Phase 8 — Search, Metadata & Navigation

- [x] **Search & Filtering**: Full-text search across titles/specs/comments/claimants, compound filters, URL persistence, saved presets
- [x] **Labels, Priority & Due Dates**: YAML frontmatter metadata, priority badges (P0-P3), overdue highlighting, sort controls
- [x] **Board Navigation & UX**: Keyboard shortcuts with overlay, column collapse/expand, horizontal scroll indicators, card timeline

### 9. Phase 9 — GitHub Integration & GLaDOS Workflows

- [x] **PR/MR Visibility**: Platform abstraction (GitHub/GitLab/null), PR link service, PR detail panel with state/CI badges
- [x] **PR/MR Management**: Create, merge (merge/squash/rebase), request review from board
- [x] **GLaDOS Workflow Triggers**: Subprocess runner, phase-aware buttons, terminal output streaming, cancel support
- [x] **Parser Flexibility**: Config schema with 3 presets (glados/flat/jira), wheatley.config.json, ReDoS validation, ETag caching

### 10. Backlog / Upcoming

- [x] Phase 10: Authentication, Teams & Multi-Project (4 features, 18 items)
- [x] Phase 11: Views, Bulk Operations & Production Polish (6 features, 23 items)

### 11. Resilient Markdown Parsing — Planning

*Lead: Architect + QA + Product Manager*
*See `specs/2026-03-31_feature_resilient-markdown-parsing/` for full trace*

- [ ] **ParseWarning type**: Add warning type, plumb through BoardState and API
- [ ] **Status parser fallbacks**: Unnumbered section headings, plain-text task lines
- [ ] **Roadmap parser fallbacks**: Flexible phase/section/task formats, synthetic IDs
- [ ] **Validator relaxation**: Downgrade non-critical errors to warnings
- [ ] **Tests**: Fallback parsing tests, CongaLine-style fixtures, regression coverage

### 12. Autonomous Workflow Execution — Verified

*Lead: Architect + QA + Product Manager*
*See `specs/2026-04-02_feature_interactive-workflows/` for full trace*

- [x] **Workflow Launch Panel**: Unified modal for all workflow types with per-workflow params
- [x] **Autonomous Context Injection**: Prompt assembly with preamble + command + autonomousContext + postamble
- [x] **Per-Workflow Configuration**: `.wheatley/workflows.json` with params, preamble, postamble per workflow type
- [x] **Transition Integration**: workflowSuggestion in transition API response triggers launch panel
- [x] **Config API**: GET /api/config/workflows endpoint

### 13. Backlog / Upcoming

- [ ] Phase 12: API Documentation, Export & Integration (4 features, 18 items)
- [ ] Phase 14: Board Accuracy & Onboarding (3 features, 10 items) — phase detection, ROADMAP conformance warnings, completed specs on timeline
- [ ] Phase 15: Analytics, Reporting & Insights (3 features, 11 items)

## Known Issues / Technical Debt

- Card editing limited to allowlisted spec files (no arbitrary path editing)
- JWT token revocation not yet implemented (role persists for full expiry period)
- Button-in-button HTML nesting in Card component (accessibility/validity issue)
- Search results show markdown bold markers as literal text (should render as HTML bold)
- GitLab requestReview requires numeric user IDs (currently logs warning)

## Recent Changes

- 2026-03-28: Project initialized. Mission, roadmap, and tech stack defined.
- 2026-03-28: **PHASE 1 COMPLETE** — 194 tests passing, 51/51 roadmap items done.
- 2026-03-28: **PHASE 2 COMPLETE** — 246 tests passing, 18/18 roadmap items done.
- 2026-03-28: **PHASE 3 COMPLETE** — 316 tests passing, 15/15 roadmap items done.
- 2026-03-28: **PHASE 4 COMPLETE** — 339 tests passing, 12/12 roadmap items done.
- 2026-03-28: **PHASE 5 COMPLETE** — 397 tests passing, 14/14 roadmap items done.
- 2026-03-29: Roadmap revised: phases 6-11 rewritten based on product feedback (git robustness, editing, search, GitHub/GitLab integration, auth, polish).
- 2026-03-29: Full product walkthrough completed (WALKTHROUGH.md) — all 16 features verified.
- 2026-03-29: **PHASE 6 COMPLETE** — 416 tests passing, 21/21 roadmap items done. Worktree isolation, dirty state detection, git identity, SSE, event log.
- 2026-03-29: **PHASE 7 COMPLETE** — 416 tests passing, 20/20 roadmap items done. Card CRUD, inline spec editing, comments, task checkboxes. MR review: fixed path traversal, injection, error handling.
- 2026-03-29: **PHASE 8 COMPLETE** — 416 tests passing, 17/17 roadmap items done. Full-text search, YAML frontmatter metadata, keyboard shortcuts, column collapse, scroll indicators, card timeline. MR review: fixed branch validation, label injection, concurrent array mutation.
- 2026-03-29: **PHASE 9 COMPLETE** — 416 tests passing, 25/25 roadmap items done. GitHub/GitLab platform adapters, PR panels, GLaDOS workflow subprocess runner, parser config presets, ETag caching. MR review: fixed SSRF guard, specDir validation, memory leak, API mismatches.
- 2026-03-29: **PHASE 10 COMPLETE** — 416 tests passing, 18/18 roadmap items done. JWT auth, OAuth2 GitHub/GitLab, role-based authorization, in-memory notifications, multi-repo support. MR review: fixed timing-safe API key comparison, OAuth CSRF state parameter, fetch error handling, userId injection, auth route exclusion.
- 2026-03-29: **PHASE 11 COMPLETE** — 439 tests passing, 23/23 roadmap items done. List/Timeline/Calendar views, bulk operations, card relationships with cycle detection, dark mode, virtualized lists, undo/redo, structured logging, Prometheus metrics, startup self-test, graceful shutdown. MR review: fixed metrics memory leak, input validation, branch guards.
- 2026-03-31: Resilient Markdown Parsing feature planned — 10 structural mismatches identified between CongaLine's GLaDOS markdown and Wheatley's parsers. Adding fallback parsing with diagnostic warnings.
- 2026-03-31: **Auth Paradigm Completion** — 474 tests passing. Fixed 4 auth gaps: local mode git identity from `git config`, client JWT Bearer header loop, repo-level access verification (GitHub collaborator/GitLab member checks), provider auto-detection warnings. PR #16 on `fix/auth-gaps` targeting `chore/mode-cleanup`.
- 2026-04-02: **Autonomous Workflow Execution** — 494 tests passing. Unified WorkflowLaunchPanel for all workflow types, per-workflow params (plan: Feature Name/Goal/Personas, spec: Focus Areas, implement: Approach Notes, verify: Verification Focus), configurable preamble/postamble in `.wheatley/workflows.json`, autonomousContext templates with {{placeholder}} resolution, workflowSuggestion from transitions. PR #21 on `feat/interactive-workflows`.
