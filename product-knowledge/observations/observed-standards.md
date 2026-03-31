# Observed Standards

*This file is populated automatically by the `pattern-observer` module during normal workflow execution.*
*Items here are reviewed and promoted (or discarded) during `/glados/recombobulate`.*

---

<!-- Add observations below this line -->

## 2026-03-31 — Auth Paradigm Implementation

- **Module-level caching for expensive async lookups**: `middleware.ts` caches the git identity result at module scope to avoid repeated `git config` calls. Same pattern as `generatedSecret` in `config.ts`. Consider formalizing this as a standard for startup-resolved values.
- **Try/catch guards on browser APIs**: `localStorage.getItem/setItem/removeItem` can throw in private browsing or restrictive security contexts. All auth-related localStorage access is wrapped in try/catch. This should be a standard for all client-side storage access.
- **OAuth scope minimalism vs functionality**: Adding `repo` scope to GitHub OAuth is a security/functionality trade-off. The collaborator API on private repos requires it, but it grants broader access than strictly needed. Document this decision for future reference.
