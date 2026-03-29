# Feature: Status Writeback (3.4)

## Summary

Extends the transition engine to update `PROJECT_STATUS.md` when a board item
changes phase, and creates spec directories when an item enters planning.
Provides a machine-parseable audit trail via commit message conventions already
established in 3.1.

## Goals

- PROJECT_STATUS.md is updated automatically on phase transitions
- Tasks move between sections (active focus / backlog / done) as phases change
- Spec directories are created with the correct template files when entering
  planning phase
- Tests cover the status writeback logic

## Non-Goals

- Updating PROJECT_STATUS.md from external tools (out of scope for this sprint)
- Parsing arbitrary PROJECT_STATUS.md formats beyond the existing grammar
