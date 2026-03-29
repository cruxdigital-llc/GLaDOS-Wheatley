# Feature: Notification Hooks

**Phase**: 5.4
**Status**: Implementing

## Overview

Configurable outbound webhook system for Wheatley events (claims, releases, transitions, conflicts). Includes a Slack-formatted webhook preset and persistent event log.

## Components

- `notification-service.ts` — Webhook dispatch with configurable endpoints
- Slack formatter — Pre-built message formatter for Slack
- Event log — Persistent append-only event log for audit trail
