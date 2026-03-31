<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly. GLaDOS will read the current state before making future updates.
-->

# Product Mission

## Problem

GLaDOS structures AI-driven development into traceable, phased workflows — but visibility into project state requires reading markdown files and navigating `specs/` directories manually. For teams with multiple developers and agents working concurrently, there is no visual layer showing:

- What's being worked on and by whom
- What phase each feature is in
- What's available to claim
- What the specs/plans actually say without opening an editor

The concurrency problem is real: two agents or developers can grab the same roadmap item because there is no claim mechanism with a single global view.

## Audience

- **Primary**: Developers (human and AI agents) working in GLaDOS-managed codebases who need to coordinate work, claim tasks, and track feature progress
- **Secondary**: Non-technical stakeholders who need to understand what's in flight without touching git or opening an editor

## Solution

Wheatley is a lightweight, local-first project board that uses a GLaDOS-managed codebase's markdown files as its database.

- **No external services. No syncing. No separate state.** The repo is the board.
- The board is assembled from existing GLaDOS artifacts: `ROADMAP.md`, `specs/` directories, `PROJECT_STATUS.md`, and a `claims.md` coordination file.
- Columns map to GLaDOS workflow phases: Unclaimed → Planning → Speccing → Implementing → Verifying → Done
- Task claiming is atomic and conflict-free — claims are git commits, and git resolves contention
- Every board action that mutates state produces a commit; the tool is read-only by default

Think Trello/Linear, but the cards are your `specs/` directories, the columns are workflow phases, and every drag-and-drop is a git commit.
