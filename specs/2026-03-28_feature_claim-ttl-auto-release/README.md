# Feature: Claim TTL & Auto-Release

**Phase**: 5.2
**Status**: Implementing

## Overview

Configurable time-to-live for claims with automatic staleness detection and auto-release. Claims with no associated commit activity within the TTL window are flagged and eventually released.

## Components

- `claim-ttl.ts` — TTL configuration, staleness detection, auto-release logic
- TTL configuration via `WHEATLEY_CLAIM_TTL_HOURS` env var (default: 24)
- Grace period warning before auto-release
- Integration with ClaimService for automated release commits
