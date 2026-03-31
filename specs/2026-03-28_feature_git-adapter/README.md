# Feature: Git Adapter

**Date**: 2026-03-28
**Phase**: implementing
**Roadmap Section**: 1.3

## Summary

Implement a unified `GitAdapter` interface with two implementations: `LocalGitAdapter` (simple-git, for Docker sidecar mode) and `RemoteGitAdapter` (Octokit, for cloud mode). An adapter factory selects the implementation based on the `WHEATLEY_MODE` environment variable.

## Goals

- Define a clean TypeScript interface for git operations needed by the board
- Implement local filesystem reads via simple-git
- Implement remote reads via GitHub REST API (Octokit)
- Factory pattern for runtime adapter selection
- Integration tests for both adapters

## Non-Goals

- Write operations (Phase 2+)
- GitLab/Bitbucket support (future)
- Authentication UI (cloud mode uses PAT from env var)
