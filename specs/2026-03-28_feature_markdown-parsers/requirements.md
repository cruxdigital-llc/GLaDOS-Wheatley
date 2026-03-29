# Requirements: Markdown Parsers

## Goal
Implement parsers that extract structured data from all GLaDOS artifacts following the parsing grammar standard.

## Success Criteria
1. `parseRoadmap(content)` returns `ParsedRoadmap` with all phases, sections, and items
2. `parseSpecDirectories(dirs)` returns `SpecEntry[]` with phase detection
3. `parseProjectStatus(content)` returns `ParsedProjectStatus` with active and backlog tasks
4. `parseClaims(content)` returns `ParsedClaims` with entries and active claims map
5. `assembleBoardState(roadmap, specs, status, claims)` returns unified board model
6. All parsers handle malformed input gracefully (return partial results with warnings, don't throw)
7. Unit tests for each parser with known-good and edge-case inputs
8. All tests pass via Docker

## Non-Goals
- File I/O (parsers accept string content, not file paths)
- Git operations (that's feature 1.3)
