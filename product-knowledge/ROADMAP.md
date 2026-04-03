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

### 13.4 Column Naming & UX Clarity

- [ ] 13.4.1 Clarify column semantics: columns represent "next action needed" not "current state" — update headers or add tooltips
- [ ] 13.4.2 Configurable column labels: allow repos to define display names for phases in `.wheatley/` config

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

## Phase 15: Conformance & Onboarding

**Goal**: Guide users when repo artifacts don't conform to the SDA standard and help them adopt Wheatley on existing projects.

### 15.1 ROADMAP.md Conformance Warnings

- [ ] 15.1.1 Surface conformance warnings in the board UI when ROADMAP.md doesn't match the SDA grammar
- [ ] 15.1.2 Show actionable suggestions (e.g., "ROADMAP.md uses flat checkboxes — expected phase/section/task hierarchy")
- [ ] 15.1.3 Offer a one-click "Generate compatible ROADMAP.md" action that restructures the existing roadmap
- [ ] 15.1.4 Link to SDA standard and GLaDOS profile docs from the warning banner

### 15.2 Completed Specs on Timeline

- [ ] 15.2.1 Include finished spec directories in the timeline view (not just active phase transitions)
- [ ] 15.2.2 Show spec completion dates derived from trace logs (README.md session entries) or git commit dates
- [ ] 15.2.3 Visual distinction between active specs and completed/archived specs on the timeline

### 15.3 Spec Log Integration

- [ ] 15.3.1 Auto-populate SPEC_LOG.md entries when a spec reaches "done" phase
- [ ] 15.3.2 Display SPEC_LOG.md contents in a project history view in the UI
- [ ] 15.3.3 Archive completed spec directories after logging (move to `specs/.archive/` or delete, configurable)

## Phase 16: API Documentation & Data Portability

**Goal**: Make Wheatley easy to integrate with external tools and provide data import/export.

### 16.1 OpenAPI Documentation

- [ ] 16.1.1 Generate OpenAPI 3.1 spec from Fastify route definitions (fastify-swagger or manual)
- [ ] 16.1.2 Serve Swagger UI at `/docs` for interactive API exploration
- [ ] 16.1.3 Per-endpoint request/response schema with examples
- [ ] 16.1.4 API versioning strategy (URL prefix `/api/v1/` or Accept header)

### 16.2 Data Export

- [ ] 16.2.1 CSV export: download board state as CSV (cards, phases, metadata, claims)
- [ ] 16.2.2 JSON export: full board snapshot as machine-readable JSON
- [ ] 16.2.3 Archive/snapshot: create timestamped board snapshot for historical tracking

### 16.3 Data Import

- [ ] 16.3.1 CSV/JSON import: bulk-create cards from uploaded file with validation
- [ ] 16.3.2 Jira import: parse Jira CSV export and map to Wheatley card model
- [ ] 16.3.3 Import preview: show what will be created before committing changes

## Phase 17: External Integrations & Extensibility

**Goal**: Enable third-party integrations through webhooks and a plugin system.

### 17.1 Webhook Management

- [ ] 17.1.1 Outbound webhook management UI: add, edit, test, delete webhook subscriptions
- [ ] 17.1.2 Webhook payload signing: HMAC-SHA256 signature in `X-Wheatley-Signature` header
- [ ] 17.1.3 Webhook retry: exponential backoff on delivery failure (max 3 retries)
- [ ] 17.1.4 Inbound webhook API: accept events from external tools to update board state
- [ ] 17.1.5 Zapier/n8n compatible triggers: standardized event payloads for no-code automation

### 17.2 Plugin System

- [ ] 17.2.1 Plugin interface: define lifecycle hooks (onCardCreate, onTransition, onClaim, etc.)
- [ ] 17.2.2 Plugin loader: discover and load plugins from `plugins/` directory or npm packages
- [ ] 17.2.3 Built-in plugin: auto-label cards based on spec directory content
- [ ] 17.2.4 Built-in plugin: Slack channel sync (mirror board changes to a Slack channel)

## Phase 18: Analytics, Reporting & Insights

**Goal**: Provide data-driven insights into project velocity, bottlenecks, and team productivity.

### 18.1 Board Analytics

- [ ] 18.1.1 Cycle time calculation: average time cards spend in each phase
- [ ] 18.1.2 Throughput chart: cards completed per day/week/sprint (line chart)
- [ ] 18.1.3 Phase distribution chart: current cards per phase (bar/pie chart)
- [ ] 18.1.4 Cumulative flow diagram: stacked area chart of cards across phases over time

### 18.2 Team Metrics

- [ ] 18.2.1 Per-agent/user workload: cards claimed, completed, average cycle time
- [ ] 18.2.2 Activity heatmap: contribution calendar showing commits/claims per day
- [ ] 18.2.3 Bottleneck detection: flag phases where cards accumulate with high average age

### 18.3 Reporting

- [ ] 18.3.1 Scheduled reports: configurable weekly/monthly email digest of board metrics
- [ ] 18.3.2 PDF report generation: downloadable summary with charts and key metrics
- [ ] 18.3.3 Dashboard view: dedicated analytics page with configurable widget grid
- [ ] 18.3.4 Custom date range selector for all analytics views
