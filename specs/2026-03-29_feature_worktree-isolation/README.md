# Feature: Worktree Isolation

**Phase**: 6.1
**Status**: Planning
**Created**: 2026-03-29
**Branch**: feat/phase-6-robust-git-engine

## Overview

Use `git worktree` for all write operations so Wheatley never touches the developer's working tree or index. This is the foundational change that makes Wheatley safe to run as a sidecar against a developer's active repository.

## Active Personas

- **Architect**: System design for worktree lifecycle and adapter refactoring
- **Security Expert**: Ensure worktree isolation doesn't introduce path traversal or race conditions

## Trace Log

- 2026-03-29: Session started — planning worktree isolation feature
- 2026-03-29: Context — LocalGitAdapter currently requires clean working tree for writes, uses developer's checkout directly
