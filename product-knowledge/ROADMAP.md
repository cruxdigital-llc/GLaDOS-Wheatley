<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-29
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

## Phase 6: Robust Git Engine & Real-Time Sync

**Goal**: Make git writes bulletproof for local developers and add real-time data flow.

### 6.1 Worktree Isolation

- [x] 6.1.1 Use `git worktree` for all write operations so Wheatley never touches the developer's working tree or index
- [x] 6.1.2 Dedicated Wheatley worktree lifecycle: auto-create on server start, clean up on shutdown
- [x] 6.1.3 All commits (claims, transitions, activity) target the worktree, then push to origin
- [x] 6.1.4 Fallback for repos that don't support worktrees (bare repos, older git versions)

### 6.2 Dirty State & Conflict Handling

- [x] 6.2.1 Remove the "working tree not clean" hard failure — reads should always work regardless of dirty state
- [x] 6.2.2 Detect and report untracked/modified/staged files as board-level status indicator ("repo has uncommitted changes")
- [x] 6.2.3 Handle push conflicts gracefully: pull-rebase-retry loop (up to 3 attempts) instead of `reset --hard`
- [x] 6.2.4 Merge conflict detection on pull: surface conflicted files in the UI with paths and conflict markers
- [x] 6.2.5 Manual conflict resolution prompt: link to files that need resolution, block writes until resolved

### 6.3 Git Identity & Config

- [x] 6.3.1 Auto-detect username from `git config user.name` and pre-populate the UI identity field
- [x] 6.3.2 Auto-detect email from `git config user.email` for commit attribution
- [x] 6.3.3 Configurable commit author override via `WHEATLEY_COMMIT_AUTHOR` env var
- [x] 6.3.4 Display detected git identity in the UI header (replace manual text input with auto-detected + editable)

### 6.4 Sync & Real-Time Updates

- [x] 6.4.1 Manual "Sync" button in the UI header: triggers immediate git pull + board re-parse
- [x] 6.4.2 Server-Sent Events (SSE) endpoint: push board-change events to connected clients (replace polling)
- [x] 6.4.3 Frontend SSE client: subscribe to real-time updates, fall back to polling if SSE disconnects
- [x] 6.4.4 Inbound webhook receiver (`POST /api/webhooks/github`, `POST /api/webhooks/gitlab`): accept push events to trigger re-sync in cloud mode
- [x] 6.4.5 Optimistic UI: update board state immediately on write operations, reconcile on next sync

### 6.5 Persistent Event Log

- [x] 6.5.1 Replace in-memory event log with file-backed storage (`product-knowledge/events.md`)
- [x] 6.5.2 Event log rotation: archive events older than configurable threshold
- [x] 6.5.3 Event replay: reconstruct board state from event log for debugging

## Phase 7: Content Editing & Card Management

**Goal**: Transform from read-only dashboard to a full project management tool that writes back to GLaDOS artifacts.

### 7.1 Card Creation

- [x] 7.1.1 "New Card" button per column: create a card in the target phase
- [x] 7.1.2 Card creation form: title, description, optional parent phase/section
- [x] 7.1.3 Backend: create spec directory (`specs/YYYY-MM-DD_feature_name/`) with README.md and tasks.md scaffolds
- [x] 7.1.4 Backend: append new roadmap item to ROADMAP.md under the correct phase/section
- [x] 7.1.5 Auto-assign item number based on existing numbering scheme in the section

### 7.2 Inline Spec Editing

- [x] 7.2.1 Markdown editor component with live preview (split-pane or toggle)
- [x] 7.2.2 Edit README.md from the card detail panel (feature description, status, overview)
- [x] 7.2.3 Edit tasks.md from the card detail panel (add/remove/reorder tasks)
- [x] 7.2.4 Task checkbox toggling: click a checkbox in the task list to toggle `[x]`/`[ ]` and commit
- [x] 7.2.5 Edit plan.md and requirements.md if present
- [x] 7.2.6 Save commits with descriptive messages: `wheatley: update {spec-name}/README.md`

### 7.3 Per-Card Comments & Discussion

- [x] 7.3.1 Comment thread UI in the card detail panel (below spec content)
- [x] 7.3.2 Comments stored as append-only entries in `specs/{feature}/comments.md`
- [x] 7.3.3 Each comment: author, timestamp, markdown body
- [x] 7.3.4 Comment notifications: emit webhook events when a comment is added
- [x] 7.3.5 @mention support: reference other users in comments with autocomplete

### 7.4 Roadmap Editing

- [x] 7.4.1 Edit card title from the board (inline rename)
- [x] 7.4.2 Delete/archive a card: delete removes from roadmap; archive logs to SPEC_LOG.md, deletes spec directory, and removes from roadmap
- [x] 7.4.3 Reorder items within a phase section in ROADMAP.md
- [x] 7.4.4 Undo last edit: revert the most recent Wheatley commit with `git revert`

## Phase 8: Search, Metadata & Navigation

**Goal**: Make the board usable at scale with search, rich metadata, and keyboard-driven navigation.

### 8.1 Search & Advanced Filtering

- [x] 8.1.1 Full-text search bar: search across card titles, spec content, comments, and claimant names
- [x] 8.1.2 Search results panel with highlighted matches and click-to-open
- [x] 8.1.3 Compound filters: combine phase, claimant, label, priority, date range, and free text
- [x] 8.1.4 Filter state persisted in URL query params (shareable filtered views)
- [x] 8.1.5 Saved filter presets per user (stored in localStorage or git-backed config)

### 8.2 Labels, Priority & Due Dates

- [x] 8.2.1 Label system: custom key-value tags stored as YAML frontmatter in spec README.md
- [x] 8.2.2 Label management UI: create, edit, delete labels with custom colors
- [x] 8.2.3 Priority field (P0–P3): stored in spec frontmatter, displayed as colored badge on cards
- [x] 8.2.4 Due date field: stored in spec frontmatter, displayed on card, highlight overdue items in red
- [x] 8.2.5 Sort by priority, due date, creation date, or last activity
- [x] 8.2.6 Bulk label/priority assignment from multi-select mode

### 8.3 Board Navigation & UX

- [x] 8.3.1 Visible horizontal scroll indicators (left/right arrows) when columns overflow
- [x] 8.3.2 Keyboard shortcuts: arrow keys to navigate cards, `c` to claim, `e` to edit, `Enter` to open detail
- [x] 8.3.3 Keyboard shortcut overlay (press `?` to show all shortcuts)
- [x] 8.3.4 Column collapse/expand: minimize columns to save horizontal space
- [x] 8.3.5 Card count badges always visible; empty columns auto-collapse option
- [x] 8.3.6 Card timeline: visual history of phase transitions, claims, and edits for each card

## Phase 9: GitHub Integration & GLaDOS Workflows

**Goal**: Deep integration with GitHub PRs/CI and the ability to trigger GLaDOS agent workflows from the board.

### 9.1 Pull Request / Merge Request Visibility

- [x] 9.1.1 Link cards to PRs/MRs: detect PRs whose branch matches a spec's feature branch (`feat/{spec-name}`)
- [x] 9.1.2 PR/MR status badge on cards: open, draft, merged, closed, review requested
- [x] 9.1.3 CI/check status badge: passing, failing, pending (GitHub check runs / GitLab pipelines)
- [x] 9.1.4 PR/MR detail in card panel: title, description, reviewer list, review status, merge status
- [x] 9.1.5 "View PR/MR" link from card detail panel (opens GitHub/GitLab in new tab)
- [x] 9.1.6 Platform abstraction: unified PR interface over Octokit (GitHub) and GitLab REST API

### 9.2 Pull Request / Merge Request Management

- [x] 9.2.1 "Create PR/MR" action from card detail: generate PR from card's feature branch to base branch
- [x] 9.2.2 PR/MR template auto-fill: populate description from spec README.md and tasks.md
- [x] 9.2.3 Request review action: assign reviewers to a card's PR/MR from the board
- [x] 9.2.4 Merge action: merge from the board (with strategy selector: merge, squash, rebase)
- [x] 9.2.5 Auto-transition card to "Verifying" when PR/MR is opened, "Done" when merged

### 9.3 GLaDOS Workflow Triggers

- [x] 9.3.1 Define GLaDOS runner interface: how Wheatley invokes agent workflows (subprocess, API, queue)
- [x] 9.3.2 "Run Plan" button on Unclaimed/Planning cards: invoke `glados:plan-feature` with card context
- [x] 9.3.3 "Run Spec" button on Planning cards: invoke `glados:spec-feature` with plan context
- [x] 9.3.4 "Run Implement" button on Speccing cards: invoke `glados:implement-feature` with spec context
- [x] 9.3.5 "Run Verify" button on Implementing cards: invoke `glados:verify-feature` with implementation context
- [x] 9.3.6 Workflow progress panel: stream agent stdout/stderr to a terminal-like UI within the card
- [x] 9.3.7 Workflow cancel button: kill a running agent workflow
- [x] 9.3.8 Auto-transition card phase when a GLaDOS workflow completes successfully

### 9.4 Parser Flexibility & Configuration

- [x] 9.4.1 Parser configuration schema: define roadmap format as a config object (regex patterns, capture group mappings, section hierarchy)
- [x] 9.4.2 Built-in presets: "glados" (current `## Phase N: / ### N.M / - [x] N.M.K` format), "flat" (no numbering), "jira-style" (`PROJ-123`)
- [x] 9.4.3 Custom parser config file: `wheatley.config.json` or `wheatley.config.ts` at repo root
- [x] 9.4.4 Parser config validation: reject configs with ReDoS-vulnerable patterns or invalid capture groups
- [x] 9.4.5 Incremental parsing: only re-parse changed files on git events (diff-based cache invalidation)
- [x] 9.4.6 Response caching with ETag/If-None-Match for API endpoints

## Phase 10: Authentication, Teams & Multi-Project

**Goal**: Secure the cloud-deployed board for team use. Local mode requires no auth.

### 10.1 Local Mode Identity (No Auth)

- [x] 10.1.1 Local mode skips all authentication — if you can reach the server, you have full access
- [x] 10.1.2 Identity derived from `git config user.name` / `user.email` (set up in Phase 6.3)
- [x] 10.1.3 All API endpoints are open; role = editor by default

### 10.2 Cloud Mode Authentication (GitHub & GitLab OAuth Only)

- [x] 10.2.1 GitHub OAuth2 integration: login flow, token exchange, profile fetch for identity
- [x] 10.2.2 GitLab OAuth2 integration: login flow, token exchange, profile fetch for identity
- [x] 10.2.3 OAuth provider selection: auto-detect from repo remote URL (github.com → GitHub, gitlab.com → GitLab), or manual config
- [x] 10.2.4 Session management: JWT tokens with configurable expiry, refresh token rotation
- [x] 10.2.5 API key authentication for headless/CI access (`WHEATLEY_API_KEY` header) — bypasses OAuth
- [x] 10.2.6 Login page: provider buttons only (no username/password form), redirect to OAuth consent screen

### 10.3 Authorization & Roles

- [x] 10.3.1 Role model: viewer (read-only), editor (claim, transition, edit), admin (webhooks, config, user management)
- [x] 10.3.2 Per-endpoint authorization middleware (viewers cannot POST/DELETE)
- [x] 10.3.3 Role assignment UI for admins
- [x] 10.3.4 Auto-role from GitHub/GitLab: map org owners → admin, org members → editor, outside collaborators → viewer
- [x] 10.3.5 Repo-level permission check: only users with write access to the repo get editor role

### 10.3 Per-User Notifications

- [x] 10.3.1 Notification preferences per user: which events to receive (claim, release, transition, comment, @mention)
- [x] 10.3.2 In-app notification bell with unread count and dropdown
- [x] 10.3.3 Email notification delivery (via configurable SMTP or SendGrid)
- [x] 10.3.4 Slack DM notifications: route events to individual Slack users based on identity mapping

### 10.4 Multi-Repo Support

- [x] 10.4.1 Configuration file for multiple repo sources (`wheatley.config.json` or env-based)
- [x] 10.4.2 Repo selector in the UI header (switch between managed repos)
- [x] 10.4.3 Per-repo adapter instantiation with independent git connections and parser configs
- [x] 10.4.4 Cross-repo dashboard: aggregate view of cards across multiple repos with repo badges

## Phase 11: Views, Bulk Operations & Production Polish

**Goal**: Feature parity with modern project management tools and production-grade quality.

### 11.1 Multiple Views

- [x] 11.1.1 List view: table layout with sortable columns (title, phase, assignee, priority, due date, last activity)
- [x] 11.1.2 Timeline view: horizontal Gantt-style chart showing card lifespans across phases
- [x] 11.1.3 View switcher in the header (Board / List / Timeline)
- [x] 11.1.4 Calendar view: cards plotted by due date on a month/week calendar grid

### 11.2 Bulk Operations

- [x] 11.2.1 Multi-select mode: Shift+Click or checkbox to select multiple cards
- [x] 11.2.2 Bulk move: transition all selected cards to a target phase
- [x] 11.2.3 Bulk assign: claim or reassign all selected cards to a user
- [x] 11.2.4 Bulk label/priority: apply labels or priority to all selected cards
- [x] 11.2.5 Bulk delete/archive: remove or archive selected cards

### 11.3 Card Relationships

- [x] 11.3.1 Parent/child relationships: nest sub-tasks under a parent card (stored as frontmatter references)
- [x] 11.3.2 Blocks/blocked-by relationships: flag dependencies between cards
- [x] 11.3.3 Dependency visualization: show blocked cards with a chain icon, tooltip listing blockers
- [x] 11.3.4 Cycle detection: prevent circular dependency chains

### 11.4 UI Polish

- [x] 11.4.1 Dark mode theme with system preference detection and manual toggle
- [x] 11.4.2 Responsive design for tablet and mobile viewports
- [x] 11.4.3 Frontend virtualized lists for boards with 100+ cards (react-window or similar)
- [x] 11.4.4 Undo/redo for recent board actions (in-memory action stack with revert-commit support)
- [x] 11.4.5 Drag-and-drop polish: smooth animations, ghost preview, touch support

### 11.5 Operational Tooling

- [x] 11.5.1 Structured JSON logging with configurable log levels (debug, info, warn, error)
- [x] 11.5.2 Prometheus metrics endpoint (`/metrics`): request latency, git operation duration, active connections
- [x] 11.5.3 Startup self-test: validate git connectivity, permissions, repo conformance, and required env vars
- [x] 11.5.4 Graceful shutdown: drain in-flight requests, close SSE connections, flush event log

### 11.6 Testing & Quality

- [x] 11.6.1 End-to-end tests with Playwright: board load, claim, release, transition, drag-drop, edit, search
- [x] 11.6.2 Load testing: concurrent claim/release/edit under contention (k6 or Artillery)
- [x] 11.6.3 Snapshot tests for all UI components
- [x] 11.6.4 API contract tests: OpenAPI spec generation and request/response validation
- [x] 11.6.5 Git edge-case test suite: dirty tree, merge conflicts, detached HEAD, shallow clones, missing remote

## Phase 12: UI/UX Design Overhaul

**Goal**: Transform the board from a developer prototype into a clean, intuitive product anyone can use without knowing GLaDOS vocabulary.

### 12.1 Header Reorganization

- [x] 12.1.1 Restructure header into Left (logo, repo) / Center (view switcher) / Right (user, notifications, settings) groups
- [x] 12.1.2 Move secondary controls (sync, branch selector, activity, health) into a toolbar or settings area
- [x] 12.1.3 Replace inline user identity text input with a cleaner user display

### 12.2 Collapsible Filter Drawer

- [x] 12.2.1 Replace always-visible filter bar with a "Filter" toggle button with active-filter badge
- [x] 12.2.2 Build slide-down filter drawer with pill-style status toggles
- [x] 12.2.3 Rename quick presets: "All", "Assigned to me", "Unassigned"

### 12.3 Terminology Cleanup

- [x] 12.3.1 Rename "Claim"/"Release" to "Assign to me"/"Unassign" across all components
- [x] 12.3.2 Rename "Claimant" to "Assigned to", "Mine" to "Assigned to me", "Unclaimed" to "Unassigned"
- [x] 12.3.3 Clean up jargon: remove "stale claim", "coordination branch" badges; rename "speccing" to "Spec", "Health" to "Branches"
- [x] 12.3.4 Update test assertions to match new terminology (no client tests exist; server tests unaffected)

### 12.4 Dark Mode Card & Panel Styling

- [x] 12.4.1 Update Card component: dark backgrounds, borders, text colors
- [x] 12.4.2 Update CardDetail panel, modals, and overlays for dark mode
- [x] 12.4.3 Fix Calendar view dark appearance and ensure all views adapt

### 12.5 Button & Label Polish

- [x] 12.5.1 Capitalize all view switcher labels and column headers
- [x] 12.5.2 Add tooltips to icon-only buttons (notifications, dark mode)
- [x] 12.5.3 Consistent button sizing, hover/focus states throughout

### 12.6 Visual Hierarchy & Spacing

- [x] 12.6.1 Differentiate primary vs secondary actions visually
- [x] 12.6.2 Improve card spacing, softer shadows, modern card styling
- [x] 12.6.3 Cleaner column headers, more whitespace, fewer borders

## Phase 13: API Documentation, Export & Integration (was 12)

**Goal**: Make Wheatley easy to integrate with external tools and provide data portability.

### 12.1 OpenAPI Documentation

- [ ] 12.1.1 Generate OpenAPI 3.1 spec from Fastify route definitions (fastify-swagger or manual)
- [ ] 12.1.2 Serve Swagger UI at `/docs` for interactive API exploration
- [ ] 12.1.3 Per-endpoint request/response schema with examples
- [ ] 12.1.4 API versioning strategy (URL prefix `/api/v1/` or Accept header)

### 12.2 Data Export & Import

- [ ] 12.2.1 CSV export: download board state as CSV (cards, phases, metadata, claims)
- [ ] 12.2.2 JSON export: full board snapshot as machine-readable JSON
- [ ] 12.2.3 CSV/JSON import: bulk-create cards from uploaded file with validation
- [ ] 12.2.4 Jira import: parse Jira CSV export and map to Wheatley card model
- [ ] 12.2.5 Archive/snapshot: create timestamped board snapshot for historical tracking

### 12.3 Webhooks & Integration

- [ ] 12.3.1 Outbound webhook management UI: add, edit, test, delete webhook subscriptions
- [ ] 12.3.2 Webhook payload signing: HMAC-SHA256 signature in `X-Wheatley-Signature` header
- [ ] 12.3.3 Webhook retry: exponential backoff on delivery failure (max 3 retries)
- [ ] 12.3.4 Inbound webhook API: accept events from external tools to update board state
- [ ] 12.3.5 Zapier/n8n compatible triggers: standardized event payloads for no-code automation

### 12.4 Plugin System

- [ ] 12.4.1 Plugin interface: define lifecycle hooks (onCardCreate, onTransition, onClaim, etc.)
- [ ] 12.4.2 Plugin loader: discover and load plugins from `plugins/` directory or npm packages
- [ ] 12.4.3 Built-in plugin: auto-label cards based on spec directory content
- [ ] 12.4.4 Built-in plugin: Slack channel sync (mirror board changes to a Slack channel)

## Phase 14: Analytics, Reporting & Insights (was 13)

**Goal**: Provide data-driven insights into project velocity, bottlenecks, and team productivity.

### 13.1 Board Analytics

- [ ] 13.1.1 Cycle time calculation: average time cards spend in each phase
- [ ] 13.1.2 Throughput chart: cards completed per day/week/sprint (line chart)
- [ ] 13.1.3 Phase distribution chart: current cards per phase (bar/pie chart)
- [ ] 13.1.4 Cumulative flow diagram: stacked area chart of cards across phases over time

### 13.2 Team Metrics

- [ ] 13.2.1 Per-agent/user workload: cards claimed, completed, average cycle time
- [ ] 13.2.2 Activity heatmap: contribution calendar showing commits/claims per day
- [ ] 13.2.3 Bottleneck detection: flag phases where cards accumulate with high average age

### 13.3 Reporting

- [ ] 13.3.1 Scheduled reports: configurable weekly/monthly email digest of board metrics
- [ ] 13.3.2 PDF report generation: downloadable summary with charts and key metrics
- [ ] 13.3.3 Dashboard view: dedicated analytics page with configurable widget grid
- [ ] 13.3.4 Custom date range selector for all analytics views
