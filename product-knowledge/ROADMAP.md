<!--
SDA: v1.0
Last Updated: 2026-04-02
-->

<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-04-02
To modify: Edit this file directly. GLaDOS will read the current state before making future updates.
-->

# Roadmap

<!-- Phases 1-12 completed and archived to product-knowledge/SPEC_LOG.md -->

## Phase 13: Correctness & Bug Fixes

**Goal**: Fix known bugs and ensure the board accurately represents repo state before adding new features.

### 13.1 Spec Directory Naming

- [ ] 13.1.1 Fix double-prefixing bug: transition engine wraps existing spec dir names in another date prefix (e.g., `specs/2026-04-03_feature_2026-03-24_feature_foo/`)
- [ ] 13.1.2 When card already has a spec directory, use it directly instead of generating a new one

### 13.2 Phase Detection Accuracy

- [ ] 13.2.1 Audit spec phase detection logic: verify that completed specs (all tasks done, verify passed) show as "done" not stuck in earlier phases
- [ ] 13.2.2 Handle edge cases: specs with no tasks.md, specs with partial completion, specs missing expected files
- [ ] 13.2.3 Add phase detection tests against real-world GLaDOS repos (research-agents, CongaLine)

### 13.3 Resilient Markdown Parsing

- [ ] 13.3.1 Graceful degradation for malformed or non-conforming ROADMAP.md (partial parse instead of failure)
- [ ] 13.3.2 Diagnostic warnings surfaced in the UI when parsing encounters issues
- [ ] 13.3.3 Tolerance for minor formatting variations (trailing whitespace, missing blank lines, alternate checkbox styles)

### 13.4 Card Detail Panel Performance

- [ ] 13.4.1 Open detail panel immediately on card click with skeleton/spinner placeholders
- [ ] 13.4.2 Load panel sections asynchronously (metadata, spec files, workflows, PRs) with individual loading indicators
- [ ] 13.4.3 Render each section as it resolves rather than waiting for all data before showing the panel

### 13.5 Column Naming & UX Clarity

- [ ] 13.5.1 Clarify column semantics: columns represent "next action needed" not "current state" — update headers or add tooltips
- [ ] 13.5.2 Configurable column labels: allow repos to define display names for phases in `.wheatley/` config

## Phase 14: Docker & Deployment Hardening

**Goal**: Make Docker deployment production-ready with proper git authentication and credential management.

### 14.1 Git Credential Forwarding

- [ ] 14.1.1 Docker git credential forwarding: mount SSH keys or configure credential helper so worktree can push to origin
- [ ] 14.1.2 GPG signing support: forward GPG agent or configure signing in worktree for repos that require signed commits
- [ ] 14.1.3 Credential validation at startup: fail fast with clear errors if push credentials are missing or invalid

### 14.2 Local-Only Write Mode

- [ ] 14.2.1 Commit-only mode: commit to worktree without pushing to origin (useful for air-gapped or credential-less Docker setups)
- [ ] 14.2.2 UI indicator when running in local-only mode (no push capability)
- [ ] 14.2.3 Configuration via environment variable (`WHEATLEY_PUSH_MODE=local|remote`)

### 14.3 Remaining Docker Polish

- [ ] 14.3.1 Complete Docker test verification for brownfield-standardization, docker-deployment, and frontend-board-view specs
- [ ] 14.3.2 Docker Compose health checks and restart policies for production deployments
- [ ] 14.3.3 Container image size optimization (multi-stage build review, dependency pruning)

## Phase 15: UX & Usability

**Goal**: Make the board usable at scale by reducing visual noise and supporting real developer workflows.

### 15.1 Board Grouping & Collapse

- [ ] 15.1.1 Group cards in Unassigned column by Phase > Section (collapsible tree)
- [ ] 15.1.2 Show item counts per group; expand on click to reveal individual cards
- [ ] 15.1.3 Persist expand/collapse state in localStorage

### 15.2 Card Chrome Reduction

- [ ] 15.2.1 Board cards show only: title, phase badge, assignee — move item IDs, spec paths, and "Assign to me" to detail panel
- [ ] 15.2.2 Truncate long titles on board cards with ellipsis; full title in detail panel and tooltip

### 15.3 Ad-Hoc Spec Support

- [ ] 15.3.1 Detect spec directories that don't match any roadmap item; show them in an "Unplanned" section on the board
- [ ] 15.3.2 "Add to Roadmap" action on unplanned cards: creates a roadmap entry retroactively
- [ ] 15.3.3 Allow creating a new spec directory from the board without requiring a roadmap entry first

## Phase 16: Conformance & Onboarding

**Goal**: Guide users when repo artifacts don't conform to the SDA standard and help them adopt Wheatley on existing projects.

### 16.1 ROADMAP.md Conformance Warnings

- [ ] 16.1.1 Surface conformance warnings in the board UI when ROADMAP.md doesn't match the SDA grammar
- [ ] 16.1.2 Show actionable suggestions (e.g., "ROADMAP.md uses flat checkboxes — expected phase/section/task hierarchy")
- [ ] 16.1.3 Link to SDA standard and GLaDOS profile docs from the warning banner

### 16.2 Spec Log Integration

- [ ] 16.2.1 Auto-populate SPEC_LOG.md entries when a spec reaches "done" phase
- [ ] 16.2.2 Archive completed spec directories after logging (move to `specs/.archive/` or delete, configurable)
