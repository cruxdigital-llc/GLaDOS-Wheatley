<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly. GLaDOS will read the current state before making future updates.
-->

# Roadmap

## Phase 1: Read-Only Board

**Goal**: Parse GLaDOS artifacts and render a Kanban board.

### 1.1 Parsing Grammar & Contract

- [x] 1.1.1 Define the canonical markdown grammar for ROADMAP.md task items (checkbox syntax, phase markers, metadata)
- [x] 1.1.2 Define the canonical directory naming convention for `specs/` (e.g., `specs/YYYY-MM-DD_feature-name/`)
- [x] 1.1.3 Define the canonical structure within each spec directory (README.md, plan.md, requirements.md, etc.)
- [x] 1.1.4 Define how phase is determined from spec directory contents (which files present = which phase)
- [x] 1.1.5 Define the canonical format for PROJECT_STATUS.md task extraction
- [x] 1.1.6 Document the full grammar as a specification in `product-knowledge/standards/`
- [x] 1.1.7 Create a validation utility that checks whether a repo's artifacts conform to the grammar

### 1.2 Markdown Parsers

- [x] 1.2.1 ROADMAP.md parser: extract task items with status, phase, and metadata
- [x] 1.2.2 Spec directory scanner: enumerate `specs/` directories, detect phase from contents
- [x] 1.2.3 PROJECT_STATUS.md parser: extract active tasks, current focus, and leads
- [x] 1.2.4 Claims.md parser: extract existing claims (for Phase 2 readiness, read-only in Phase 1)
- [x] 1.2.5 Unified board state assembler: merge parser outputs into a single board model
- [x] 1.2.6 Unit tests for each parser against known-good and malformed inputs

### 1.3 Git Adapter

- [x] 1.3.1 Define `GitAdapter` TypeScript interface (readFile, listDirectory, listBranches, getCurrentBranch)
- [x] 1.3.2 Implement `LocalGitAdapter` using simple-git (filesystem reads from a volume-mounted repo)
- [x] 1.3.3 Implement `RemoteGitAdapter` using Octokit (GitHub REST API: contents, branches, trees)
- [x] 1.3.4 Adapter factory: select implementation based on `WHEATLEY_MODE` environment variable
- [x] 1.3.5 Integration tests for `LocalGitAdapter` against a fixture repo
- [x] 1.3.6 Integration tests for `RemoteGitAdapter` against a test GitHub repo

### 1.4 Source Watching & Sync

- [x] 1.4.1 Local mode file watcher: monitor `.git/HEAD` and `.git/refs/` for changes via filesystem events
- [x] 1.4.2 Cloud mode poller: configurable-interval API poll for ref changes
- [x] 1.4.3 Debounce layer: coalesce rapid changes into a single board refresh
- [x] 1.4.4 Full re-sync: on-demand and periodic full re-parse as a drift-correction fallback
- [x] 1.4.5 Change event bus: internal pub/sub so UI can subscribe to repo-change events

### 1.5 API Server

- [x] 1.5.1 Fastify server scaffold with TypeScript
- [x] 1.5.2 `GET /api/board` — return full board state (columns, cards, metadata)
- [x] 1.5.3 `GET /api/board/card/:id` — return detail for a single card (spec contents, plan, requirements)
- [x] 1.5.4 `GET /api/branches` — list available branches
- [x] 1.5.5 `POST /api/branch` — switch the active branch the board reads from
- [x] 1.5.6 `GET /api/health` — health check endpoint
- [x] 1.5.7 Error handling middleware: structured error responses
- [x] 1.5.8 CORS configuration for local dev (frontend on Vite dev server)

### 1.6 Frontend: Board View

- [x] 1.6.1 React + Vite + TypeScript project scaffold
- [x] 1.6.2 TailwindCSS setup and base theme
- [x] 1.6.3 React Query configuration and API client
- [x] 1.6.4 Board layout: columns for each GLaDOS phase (Unclaimed, Planning, Speccing, Implementing, Verifying, Done)
- [x] 1.6.5 Card component: title, phase badge, assignee (if claimed), spec link
- [x] 1.6.6 Card detail panel: render README, spec, plan, and requirements from the feature's spec directory
- [x] 1.6.7 Markdown renderer for card detail content
- [x] 1.6.8 Branch selector dropdown in the header
- [x] 1.6.9 Auto-refresh on repo change events (via polling or SSE from the API)
- [x] 1.6.10 Empty state: helpful messaging when no tasks are found or repo doesn't conform
- [x] 1.6.11 Loading and error states for all data-fetching views

### 1.7 Brownfield Standardization

- [x] 1.7.1 CLI command or API endpoint to analyze a repo's conformance to the parsing grammar
- [x] 1.7.2 Report: list non-conforming files with specific violations
- [x] 1.7.3 Auto-fix mode: rewrite non-conforming files to match the grammar (with git commit)

### 1.8 Docker & Deployment

- [x] 1.8.1 Multi-stage Dockerfile (dev target with hot reload, production target with built assets)
- [x] 1.8.2 docker-compose.yml for local sidecar (volume-mounted repo, WHEATLEY_MODE=local)
- [x] 1.8.3 Environment variable documentation (WHEATLEY_MODE, WHEATLEY_REPO_PATH, GITHUB_TOKEN, WHEATLEY_REPO)
- [x] 1.8.4 Startup validation: fail fast with clear errors if required env vars are missing
- [x] 1.8.5 Cloud deployment example (standalone Docker run with WHEATLEY_MODE=remote)

## Phase 2: Claims & Assignment

**Goal**: Enable atomic task claiming through the board.

### 2.1 Claims Data Model

- [x] 2.1.1 Define `claims.md` format: structured entries with task ID, claimant, timestamp, status
- [x] 2.1.2 Define claim lifecycle states: claimed, released, expired
- [x] 2.1.3 Extend the parsing grammar specification to cover `claims.md`

### 2.2 Claim Operations (Backend)

- [x] 2.2.1 Extend `GitAdapter` interface with write operations (commitFile, push)
- [x] 2.2.2 Implement write operations in `LocalGitAdapter` (commit to coordination branch)
- [x] 2.2.3 Implement write operations in `RemoteGitAdapter` (create/update file via API, target coordination branch)
- [x] 2.2.4 `POST /api/claims` — claim a task (append to claims.md, commit to coordination branch)
- [x] 2.2.5 `DELETE /api/claims/:id` — release a claim (update claims.md, commit)
- [x] 2.2.6 Conflict detection: catch failed commits (someone else claimed first), return conflict response
- [x] 2.2.7 Coordination branch configuration: configurable target branch for claim commits (default: `main`)

### 2.3 Claim Operations (Frontend)

- [x] 2.3.1 "Claim" button on unclaimed card components
- [x] 2.3.2 "Release" button on cards claimed by the current user
- [x] 2.3.3 Claim conflict modal: show who claimed it, offer to refresh
- [x] 2.3.4 Visual indicators on cards: claimant name/avatar, claim timestamp
- [x] 2.3.5 Filter/sort: view by claimant, show only unclaimed items

### 2.4 Cross-Branch Claim Visibility

- [x] 2.4.1 Board always reads claims from the coordination branch, regardless of selected view branch
- [x] 2.4.2 Visual distinction between coordination-branch claims and viewed-branch spec state
- [x] 2.4.3 Stale claim detection: flag claims where no matching spec activity exists

## Phase 3: Phase Transitions & Workflow Triggers

**Goal**: Let users move cards through GLaDOS phases from the board.

### 3.1 Phase Transition Engine

- [x] 3.1.1 Define valid phase transitions (Unclaimed → Planning → Speccing → Implementing → Verifying → Done)
- [x] 3.1.2 Transition logic: determine which markdown files to create/update for each phase change
- [x] 3.1.3 Commit generation: produce a well-formed commit for each transition
- [x] 3.1.4 Transition validation: prevent invalid transitions (e.g., Unclaimed → Done)

### 3.2 Drag-and-Drop UI

- [x] 3.2.1 Drag-and-drop library integration for card movement between columns
- [x] 3.2.2 Drop zone validation: highlight valid target columns, reject invalid transitions
- [x] 3.2.3 Optimistic UI update with rollback on commit failure
- [x] 3.2.4 Confirmation dialog for transitions that create files (e.g., entering Planning creates spec directory)

### 3.3 GLaDOS Workflow Integration

- [x] 3.3.1 "Start Planning" action: trigger `/glados/plan-feature` (open terminal, queue for agent, or API call)
- [x] 3.3.2 "Start Spec" action: trigger `/glados/spec-feature`
- [x] 3.3.3 Define integration mechanism: terminal launch, agent queue, or webhook
- [x] 3.3.4 Status feedback: show when a GLaDOS workflow is in progress for a card

### 3.4 Status Writeback

- [x] 3.4.1 Update PROJECT_STATUS.md on phase transitions
- [x] 3.4.2 Update spec directory contents to reflect new phase (e.g., create plan.md when entering Planning)
- [x] 3.4.3 Commit message conventions for phase transitions (machine-parseable for audit trail)

## Phase 4: Multi-Branch Awareness

**Goal**: Aggregate view across branches.

### 4.1 Branch Enumeration & Scanning

- [x] 4.1.1 List all active branches (filter: configurable prefix/pattern, e.g., `feat/*`)
- [x] 4.1.2 Parse board state from each active branch independently
- [x] 4.1.3 Caching layer: avoid re-parsing branches that haven't changed since last scan
- [x] 4.1.4 Configurable scan scope: which branches to include/exclude

### 4.2 Consolidated Board View

- [x] 4.2.1 Unified board that merges cards from all scanned branches
- [x] 4.2.2 Branch badge on each card: which branch a spec lives on
- [x] 4.2.3 Deduplication: same spec appearing on multiple branches shown once with branch indicators
- [x] 4.2.4 Toggle between single-branch view and consolidated view

### 4.3 Branch Diff & Health

- [x] 4.3.1 Visual diff: specs that exist on a feature branch but not on main
- [x] 4.3.2 Commits-behind indicator: how far a feature branch is behind main
- [x] 4.3.3 Merge conflict risk: flag branches with overlapping file changes
- [x] 4.3.4 Branch age indicator: last commit timestamp per branch

## Phase 5: Team & Agent Coordination

**Goal**: Support multiple humans and AI agents working concurrently.

### 5.1 Agent Activity Feed

- [x] 5.1.1 Define agent trace log format (or adopt existing GLaDOS trace format)
- [x] 5.1.2 Parse agent trace logs from `specs/` session directories
- [x] 5.1.3 Activity feed UI: real-time view of what each agent is doing
- [x] 5.1.4 Agent identification: map git committer identity to agent/human label

### 5.2 Claim TTL & Auto-Release

- [x] 5.2.1 Configurable TTL per claim (default: 24 hours)
- [x] 5.2.2 Staleness detector: flag claims with no associated commit activity within TTL window
- [x] 5.2.3 Auto-release: commit a release to claims.md when TTL expires
- [x] 5.2.4 Grace period notification: warn claimant before auto-release

### 5.3 Conflict Early Warning

- [x] 5.3.1 Cross-branch file overlap detection: identify when two branches are editing the same files
- [x] 5.3.2 Warning indicators on affected cards
- [x] 5.3.3 Suggested resolution: recommend which branch should merge first

### 5.4 Notification Hooks

- [x] 5.4.1 Webhook system: configurable outbound webhooks for events (claim, release, phase transition, conflict)
- [x] 5.4.2 Slack integration: pre-built webhook formatter for Slack
- [x] 5.4.3 Event log: persistent log of all Wheatley events for audit
