# Wheatley

A lightweight, local-first project board that uses a GLaDOS-managed codebase's markdown files as its database.

No external services. No syncing. No separate state. **The repo is the board.**

## What It Does

Wheatley renders a Kanban board directly from your repo's markdown artifacts:

- **ROADMAP.md** → unclaimed items
- **specs/** directories → in-flight features and their current phase
- **PROJECT_STATUS.md** → active tasks
- **claims.md** → who's working on what
- **SPEC_LOG.md** → historical record of archived specs

Columns map to GLaDOS workflow phases: **Unclaimed → Planning → Speccing → Implementing → Verifying → Done**

Task claiming is atomic — claims are git commits, and git itself resolves contention.

### Key Capabilities
- **Card management**: Create, rename, delete, and archive cards
- **Phase transitions**: Drag-and-drop between columns with automatic spec file creation
- **Archive**: Done cards can be archived — spec directory is removed, and a summary entry is logged to `SPEC_LOG.md` with an AI-generated summary and commit hash
- **Bulk operations**: Move, assign, set priority, delete, or archive multiple cards at once
- **GLaDOS workflows**: Trigger Plan/Spec/Implement/Verify workflows directly from the board
- **Multi-branch**: View and manage work across branches with conflict detection
- **Search**: Full-text search across card titles, spec contents, and comments
- **Metadata**: Priority (P0-P3), due dates, labels, and relationships between cards
- **Real-time sync**: SSE-based live updates when the repo changes

## Modes

| Mode | Description |
|---|---|
| **Sidecar** | Docker container with your repo volume-mounted. Reads/writes via the filesystem. |
| **Cloud** | Standalone service connecting to GitHub/GitLab via API. Deploy anywhere. |

Both modes use the same Docker image. Set `WHEATLEY_MODE=local` or `WHEATLEY_MODE=remote`.

## Quick Start

### Sidecar (local repo)

```bash
docker compose up
```

Then open [http://localhost:3000](http://localhost:3000).

### Cloud (remote repo)

```bash
docker run -e WHEATLEY_MODE=remote \
  -e GITHUB_TOKEN=<your-pat> \
  -e WHEATLEY_REPO=owner/repo \
  -p 3000:3000 \
  wheatley
```

## Project Structure

```
├── product-knowledge/     # GLaDOS product artifacts (mission, roadmap, tech stack)
├── specs/                 # Feature specs and session traces
├── src/
│   ├── client/            # React frontend
│   └── server/            # Fastify backend
├── Dockerfile
├── docker-compose.yml
└── CLAUDE.md              # Development environment rules
```

## API

All endpoints are served under `/api/`. Key routes:

### Board & Cards
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/board` | Full board state (columns, cards, claims) |
| GET | `/api/board/cards/:id` | Card detail with spec file contents |
| POST | `/api/cards` | Create a new card |
| PUT | `/api/cards/:id/title` | Rename a card |
| DELETE | `/api/cards/:id` | Delete a card (removes from ROADMAP.md only) |
| POST | `/api/cards/:id/archive` | Archive a done card (log to SPEC_LOG.md, delete spec dir, remove from roadmap) |

### Claims & Transitions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/claims/:id/claim` | Claim a card |
| POST | `/api/claims/:id/release` | Release a claim |
| POST | `/api/transitions` | Execute a phase transition |

### Bulk Operations
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/bulk/move` | Move multiple cards to a phase |
| POST | `/api/bulk/assign` | Assign multiple cards |
| POST | `/api/bulk/delete` | Delete multiple cards |
| POST | `/api/bulk/archive` | Archive multiple done cards |
| POST | `/api/bulk/metadata` | Update metadata on multiple cards |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/search` | Full-text search |
| GET | `/api/branches` | List branches |
| POST | `/api/workflows/start` | Trigger a GLaDOS workflow |
| GET | `/api/sync/events` | SSE stream for real-time updates |

## Development

All commands run inside Docker (see [CLAUDE.md](CLAUDE.md)):

```bash
docker compose up --build    # Start dev server
docker compose run app npm test   # Run tests
```

## License

Apache 2.0 — see [LICENSE](LICENSE).
