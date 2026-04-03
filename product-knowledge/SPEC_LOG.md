# Spec Log

Historical record of all feature specifications.
Each entry includes the merge commit where the work landed — use
`git show <hash>` to see the full diff.

Entries are in reverse chronological order (newest first).

---

## Implemented

| Date | Spec | Merge Commit | Summary |
|------|------|:------------:|---------|
| 2026-04-02 | interactive-workflows | `e3159ed` | Interactive workflow execution with autonomous mode, launch panel, and event handling |
| 2026-03-31 | auth-paradigm-completion | `9d1c24d` | Close gaps between auth implementation and intended split-mode paradigm (local git config, cloud OAuth + repo gating) |
| 2026-03-30 | ui-ux-design-overhaul | `18f9674` | Transform board from developer prototype into clean, intuitive product with terminology cleanup and dark mode |
| 2026-03-28 | phase-transition-engine | `c4aaf02` | Engine governing valid phase transitions with validation and file generation |
| 2026-03-28 | claim-operations-frontend | `17a6f80` | Claim and release interactions in the board UI with identity persistence |
| 2026-03-28 | claim-operations-backend | `1153fa2` | Write support for git adapters and REST endpoints for claiming/releasing roadmap items |
| 2026-03-28 | cross-branch-claims | `a9714b7` | Claims always read from coordination branch regardless of viewed branch |
| 2026-03-28 | claims-data-model | `07ae7fd` | Formalized claims.md format and claim lifecycle as authoritative specification |
| 2026-03-28 | glados-integration | `5272ccf` | Connects board to GLaDOS workflows via webhooks with status tracking |
| 2026-03-28 | status-writeback | `5272ccf` | Extends transition engine to update PROJECT_STATUS.md on phase changes |
| 2026-03-28 | drag-drop-ui | `5272ccf` | Native HTML5 drag-and-drop support for the Kanban board |
| 2026-03-28 | markdown-parsers | `dffec87` | Parsers extracting structured data from ROADMAP.md, specs/, PROJECT_STATUS.md, claims.md |
| 2026-03-28 | parsing-grammar-and-project-scaffold | `9e341e8` | TypeScript project scaffold with strict parsing grammar for GLaDOS artifacts |
| 2026-03-28 | source-watching | `1053f2a` | Change detection system watching for repository changes and triggering board refreshes |
| 2026-03-28 | git-adapter | `934fd40` | Unified GitAdapter interface with LocalGitAdapter and RemoteGitAdapter implementations |
| 2026-03-28 | api-server | `3904f03` | Fastify-based REST API serving board state assembled from parsed markdown files |
| 2026-03-28 | branch-health | `9f5f1c8` | Per-branch health indicators for commit lag, age, unique specs, and conflict risk |
| 2026-03-28 | branch-scanning | `9f5f1c8` | Configurable scanning of multiple branches with SHA-based caching |
| 2026-03-28 | consolidated-view | `9f5f1c8` | Merges board states from multiple branches into a single unified view |
| 2026-03-28 | agent-activity-feed | `32f4ea1` | Real-time activity feed showing agent and human activity across the project |
| 2026-03-28 | claim-ttl-auto-release | `32f4ea1` | Configurable TTL for claims with automatic staleness detection and auto-release |
| 2026-03-28 | conflict-early-warning | `32f4ea1` | Cross-branch file overlap detection identifying when two branches edit the same files |
| 2026-03-28 | notification-hooks | `32f4ea1` | Configurable outbound webhook system for Wheatley events with Slack formatter |
| 2026-03-28 | frontend-board-view | `2325c25` | React + TypeScript frontend with TailwindCSS rendering a Kanban board |

## In Progress

| Date | Spec | Phase | Summary |
|------|------|-------|---------|
| 2026-04-02 | docker-git-auth | implementing | Configure git credentials and SSH/GPG keys for Docker write operations |
| 2026-03-31 | resilient-markdown-parsing | speccing | Make Wheatley resilient to real-world GLaDOS markdown with graceful degradation |
| 2026-03-31 | ui-modernization-v2 | planning | Cherry-pick best architectural ideas from conflicting PR onto current main |
| 2026-03-29 | worktree-isolation | planning | Use git worktree for write operations to isolate from developer's working tree |
| 2026-03-28 | brownfield-standardization | implementing | Conformance analyzer checking repository markdown files against parsing grammar |
| 2026-03-28 | docker-deployment | implementing | Finalize Docker packaging for sidecar and cloud deployment modes |

## Non-Feature

| Date | Spec | Summary |
|------|------|---------|
| 2026-03-28 | mission-statement | Mission definition for Wheatley |
| 2026-03-28 | plan-product | Product plan with roadmap, tech stack decisions, and architecture |
