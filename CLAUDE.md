# CLAUDE.md

## Development Environment

All commands (build, test, lint, run, etc.) must be executed inside a Docker container. Do not run project commands directly on the host machine.

- Use `docker compose` (or `docker run`) for all project operations.
- If a Dockerfile or `docker-compose.yml` exists, use it. If not, create one before running any commands.
- Install dependencies, run tests, and start services exclusively within containers.
