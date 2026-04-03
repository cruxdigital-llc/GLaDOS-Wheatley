# CLAUDE.md

## Development Environment

Wheatley runs **natively on the host** for local development. This gives the server
access to the developer's git credentials, SSH keys, GPG agent, and Claude CLI —
all of which are needed for the full feature set (push, signed commits, GLaDOS workflows).

### Running locally

```bash
npm install              # first time only
npm run dev              # starts server (port 3000) + frontend (port 5173)
```

The `dev` script starts both Fastify and Vite concurrently. Vite proxies `/api` to the server.

Optional environment variables:
- `WHEATLEY_REPO_PATH` — repo to watch (defaults to cwd)
- `WHEATLEY_GLADOS_CMD=claude` — enables GLaDOS workflow buttons
- `WHEATLEY_PUSH_ON_WRITE=true` — auto-push on every write (default: commit-only)

### Testing

Tests **may** run in Docker for reproducibility, or natively:

```bash
npm test                              # native
docker compose run --rm test          # Docker (CI-style)
```

### When to use Docker

- **CI / automated testing**: `docker compose run --rm test`
- **Cloud / remote deployment**: Build the production image and deploy with API tokens
- **Never for local dev**: The container can't access host credentials
