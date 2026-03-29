# Feature: API Server

**Date**: 2026-03-28
**Phase**: implementing
**Roadmap Section**: 1.5

## Summary

Fastify-based REST API that serves board state assembled from parsed markdown files. Wires together the git adapter, parsers, and watcher system. Provides endpoints for board state, card detail, branch management, and health checks.

## Goals

- Fastify server scaffold with TypeScript
- Board state endpoint (full Kanban view)
- Card detail endpoint (spec contents)
- Branch listing and switching
- Health check
- Structured error handling
- CORS for local dev
