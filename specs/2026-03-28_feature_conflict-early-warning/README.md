# Feature: Conflict Early Warning

**Phase**: 5.3
**Status**: Implementing

## Overview

Cross-branch file overlap detection that identifies when two branches are editing the same files. Surfaces warnings on affected cards and suggests resolution order.

## Components

- `conflict-detector.ts` — Cross-branch file overlap analysis
- Warning indicators on affected cards
- Resolution suggestions based on branch age/progress
