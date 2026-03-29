# Feature: Agent Activity Feed

**Phase**: 5.1
**Status**: Implementing

## Overview

Real-time activity feed showing what each agent and human is doing across the project. Parses an append-only `product-knowledge/activity.md` log and maps git committer identities to agent/human labels.

## Components

- `activity-parser.ts` — Parse activity.md into TraceEntry[]
- `agent-identity.ts` — Map committer names to agent/human classification
- `activity-service.ts` — Service layer for reading/writing activity feed
- `routes/activity.ts` — GET /api/activity endpoint
- `ActivityFeed.tsx` — Slide-in panel showing real-time activity
