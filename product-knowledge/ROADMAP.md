<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly. GLaDOS will read the current state before making future updates.
-->

# Roadmap

## Phase 1: Read-Only Board

**Goal**: Parse GLaDOS artifacts and render a Kanban board.

- [ ] Parse `product-knowledge/ROADMAP.md` for unclaimed items
- [ ] Parse `specs/` directories to detect in-flight features and their current phase
- [ ] Parse `PROJECT_STATUS.md` for active tasks
- [ ] Render a column-based Kanban board (web UI)
- [ ] Card click opens detail view showing README, spec, plan, and requirements from the feature's `specs/` directory
- [ ] Branch selector dropdown — switch which branch the board reads from
- [ ] Configurable coordination branch setting (default: `main`)
- [ ] Local sidecar mode: serve from Docker container with volume-mounted repo
- [ ] Cloud mode: connect to a remote repo via GitHub REST API (Octokit)
- [ ] Define parsing grammar for ROADMAP.md, specs/ directories, and PROJECT_STATUS.md — strict, machine-readable contract (no fuzzy matching)
- [ ] Standardization workflow for brownfield codebases that don't conform to the parsing contract
- [ ] File watching and sync: `.git/` directory watcher (local mode), API polling (cloud mode), debounce for rapid commits, full re-sync fallback

## Phase 2: Claims & Assignment

**Goal**: Enable atomic task claiming through the board.

- [ ] "Claim" button on unclaimed roadmap items
- [ ] Claiming appends to `product-knowledge/claims.md` and commits to the coordination branch
- [ ] Conflict detection: if the commit fails (someone else claimed it), refresh and show the conflict
- [ ] Visual indicators: who owns what, when it was claimed
- [ ] Release/unclaim action for abandoned work
- [ ] Board reflects claims from coordination branch regardless of which branch is being viewed

## Phase 3: Phase Transitions & Workflow Triggers

**Goal**: Let users move cards through GLaDOS phases from the board.

- [ ] Drag card between columns to update phase status
- [ ] Phase changes update the relevant markdown files and commit
- [ ] "Start Planning" button triggers `/glados/plan-feature`
- [ ] "Start Spec" button triggers `/glados/spec-feature`
- [ ] Status written back to `PROJECT_STATUS.md`

## Phase 4: Multi-Branch Awareness

**Goal**: Aggregate view across branches.

- [ ] Show specs from feature branches alongside main
- [ ] Visual diff: what exists on a branch that doesn't exist on main yet
- [ ] Branch health indicators (how far behind main, merge conflict risk)
- [ ] Consolidated view: everything happening across all active branches as a single board

## Phase 5: Team & Agent Coordination

**Goal**: Support multiple humans and AI agents working concurrently.

- [ ] Agent activity feed: what each agent is currently doing (parsed from trace logs)
- [ ] Claim reservation with TTL (auto-release if no progress in X hours)
- [ ] Conflict early-warning: flag when two branches are touching overlapping files
- [ ] Notification hooks (Slack, etc.) for phase transitions and claim events
