# Wheatley

A lightweight, local-first project board that uses a GLaDOS-managed codebase's markdown files as its database.

No external services. No syncing. No separate state. **The repo is the board.**

## What It Does

Wheatley renders a Kanban board directly from your repo's markdown artifacts:

- **ROADMAP.md** → unclaimed items
- **specs/** directories → in-flight features and their current phase
- **PROJECT_STATUS.md** → active tasks
- **claims.md** → who's working on what

Columns map to GLaDOS workflow phases: **Unclaimed → Planning → Speccing → Implementing → Verifying → Done**

Task claiming is atomic — claims are git commits, and git itself resolves contention.

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

## Development

All commands run inside Docker (see [CLAUDE.md](CLAUDE.md)):

```bash
docker compose up --build    # Start dev server
docker compose run app npm test   # Run tests
```

## License

Apache 2.0 — see [LICENSE](LICENSE).
