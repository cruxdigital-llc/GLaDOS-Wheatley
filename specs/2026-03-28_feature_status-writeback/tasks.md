# Tasks: Status Writeback (3.4)

## Implementation Tasks

- [x] **3.4.1 Update PROJECT_STATUS.md on phase transitions**: Extend TransitionService.executeTransition to read, transform, and write PROJECT_STATUS.md
- [x] **3.4.2 Update spec directory contents to reflect new phase**: Spec directory creation on planning entry confirmed via getTransitionActions (already in 3.1); writeback extends this to PROJECT_STATUS.md
- [x] **3.4.3 Commit message conventions for phase transitions**: Confirmed — all writeback commits use `transition: <itemId> <from>→<to>` format (machine-parseable audit trail)
- [x] **buildStatusWriteback pure function**: Create src/server/api/status-writeback.ts with pure transformation logic
- [x] **Tests for status writeback**: Create src/server/api/__tests__/status-writeback.test.ts covering active-focus move, done marking, and missing item insertion
