# Feature: Source Watching & Sync

**Date**: 2026-03-28
**Phase**: implementing
**Roadmap Section**: 1.4

## Summary

Implement a change detection system that watches for repository changes and triggers board state refreshes. Supports two modes: local filesystem watching (for sidecar) and remote API polling (for cloud). Includes debouncing, periodic full re-sync, and an event bus for downstream subscribers.

## Goals

- Detect git ref changes in local repos via filesystem events
- Detect changes in remote repos via periodic API polling
- Debounce rapid changes to avoid excessive re-parses
- Provide periodic full re-sync as a drift-correction fallback
- Event bus for decoupled change notifications

## Non-Goals

- WebSocket/SSE push to the frontend (that's Feature 1.5/1.6)
- Granular per-file change tracking (we re-parse the whole board on any change)
