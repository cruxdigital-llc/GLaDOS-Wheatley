# Feature: GLaDOS Workflow Integration (3.3)

## Summary

Connects the Wheatley board to GLaDOS workflows. When a card transitions to
certain phases, a webhook is fired to trigger the corresponding GLaDOS action
(plan-feature, spec-feature). The board shows a spinner on cards that have an
active workflow in progress.

## Goals

- Webhook fired on transition to planning (triggers /glados/plan-feature)
- Webhook fired on transition to speccing (triggers /glados/spec-feature)
- Configurable webhook URL via environment variable GLADOS_WEBHOOK_URL
- In-memory workflow status tracking per card
- Frontend polls for workflow status and shows "GLaDOS Running..." on active cards

## Non-Goals

- Persisting workflow state across server restarts
- Authentication of webhook payloads
- Retry logic for failed webhook calls
