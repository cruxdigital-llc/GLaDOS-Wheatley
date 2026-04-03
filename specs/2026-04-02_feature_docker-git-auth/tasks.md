# Tasks: Docker Git Auth

## Types & Interface
- [ ] Extend RepoStatus with pushOnWrite, unpushedCommits, gpgWarning
- [ ] Add optional push() method to GitAdapter interface

## Local Adapter — Push Gate
- [ ] Add pushOnWrite flag to LocalGitAdapter constructor
- [ ] Gate _writeViaWorktree: skip fetch+push when pushOnWrite=false, update local refs instead
- [ ] Gate _writeViaMainRepo: skip push when pushOnWrite=false
- [ ] Gate _deleteViaWorktree: skip fetch+push when pushOnWrite=false
- [ ] Gate _deleteViaMainRepo: skip push when pushOnWrite=false
- [ ] Implement push() method for on-demand push
- [ ] Extend getRepoStatus() with unpushedCommits count

## Worktree Manager — Credentials & GPG
- [ ] Accept pushOnWrite option in WorktreeManager constructor
- [ ] Add configureCredentials() method (HTTPS token, SSH detection)
- [ ] Add detectGPGRequirement() method
- [ ] Call both from _doInit() when push is enabled

## API
- [ ] Add POST /api/repo/push endpoint with credential error handling

## Frontend
- [ ] Add pushToOrigin() to client API
- [ ] Update RepoStatusIndicator with unpushed count and Push button

## Docker Compose & Docs
- [ ] Add commented credential/SSH/GPG examples to docker-compose.yml

## Tests
- [ ] Unit tests for pushOnWrite gating
- [ ] Unit tests for push() method
- [ ] Run full test suite in Docker
