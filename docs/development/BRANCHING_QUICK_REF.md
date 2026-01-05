# 🌳 Git Branching Quick Reference

Quick reference for the PlusCraft Launcher branching strategy.

## Branch Overview

| Branch | Purpose | Branch From | Merge To | Auto-Build |
|--------|---------|-------------|----------|------------|
| `main` | Production | - | - | On tag push |
| `staging` | Pre-release testing | `develop` | `main` | ✅ Yes (pre-release) |
| `develop` | Integration | - | `staging` | ❌ No |
| `feature/*` | New features | `develop` | `develop` | ❌ No |
| `fix/*` | Bug fixes | `develop` | `develop` | ❌ No |
| `hotfix/*` | Critical fixes | `main` | `main` + `develop` | ❌ No |

## Common Commands

### Start New Feature
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# ... work ...
git push origin feature/my-feature
# Create PR: feature/my-feature → develop
```

### Fix a Bug
```bash
git checkout develop
git pull origin develop
git checkout -b fix/bug-description
# ... fix ...
git push origin fix/bug-description
# Create PR: fix/bug-description → develop
```

### Prepare Release
```bash
# 1. Merge develop to staging
git checkout staging
git pull origin staging
git merge develop
git push origin staging

# ✅ Staging workflow creates pre-release builds
# 🧪 Test the staging builds!

# 2. After testing, merge to main
git checkout main
git pull origin main
git merge staging
git push origin main

# 3. Tag the release
npm version patch  # or minor, or major
git push --tags

# ✅ Release workflow creates production release
```

### Emergency Hotfix
```bash
# 1. Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-issue

# 2. Fix immediately
# ... fix ...
git push origin hotfix/critical-issue

# 3. Create PRs to BOTH branches
# PR #1: hotfix/critical-issue → main
# PR #2: hotfix/critical-issue → develop

# 4. After merge to main, tag immediately
git checkout main
git pull
npm version patch
git push --tags
```

## Workflow Diagram

```
feature/x ──┐
            ├──> develop ──> staging ──> main ──> v1.0.40 (tag)
fix/y ──────┘                                 │
                                              │
hotfix/z ─────────────────────────────────────┴──> v1.0.41 (tag)
                                              │
                                              └──> develop
```

## CI/CD Triggers

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `develop.yml` | Push/PR to `develop` | Validate development |
| `staging.yml` | Push to `staging` | Build pre-releases |
| `release.yml` | Tag `v*` | Build production release |
| `pr-checks.yml` | PR to any protected branch | Validate PR |
| `lint.yml` | Push to any branch | Code quality |
| `test.yml` | Push to any branch | Run tests |
| `security.yml` | Push + weekly | Security scans |

## Conventional Commits

```bash
feat: add new feature
fix: resolve bug
hotfix: critical production fix
docs: update documentation
style: formatting changes
refactor: code restructuring
perf: performance improvement
test: add/update tests
chore: maintenance tasks
```

## Quick Decision Tree

**Adding a new feature?**
→ `feature/*` from `develop`

**Fixing a bug?**
→ `fix/*` from `develop`

**Ready to test features together?**
→ Merge `develop` to `staging`

**Staging tests passed?**
→ Merge `staging` to `main` + tag

**Production is broken RIGHT NOW?**
→ `hotfix/*` from `main` → merge to both `main` and `develop`

## Testing Staging Builds

1. Push to `staging` branch
2. Wait for workflow to complete (~10-15 min)
3. Go to Releases → Find "🚧 Staging Build"
4. Download for your platform
5. Test thoroughly
6. If good → merge to `main` + tag
7. If bad → fix in `develop` and retry

## Version Numbering

```
v1.2.3
  │ │ │
  │ │ └─> PATCH (bug fixes)
  │ └───> MINOR (new features)
  └─────> MAJOR (breaking changes)
```

```bash
npm version patch  # 1.0.39 → 1.0.40
npm version minor  # 1.0.39 → 1.1.0
npm version major  # 1.0.39 → 2.0.0
```

## Branch Lifespans

- `main`: Permanent
- `staging`: Permanent
- `develop`: Permanent
- `feature/*`: Delete after merge
- `fix/*`: Delete after merge
- `hotfix/*`: Delete after merge

## Do's and Don'ts

### ✅ DO
- Branch from correct source
- Use conventional commits
- Test locally before pushing
- Keep PRs focused and small
- Delete branches after merge
- Test staging builds thoroughly

### ❌ DON'T
- Commit directly to `main`, `staging`, or `develop`
- Branch features from `main`
- Push without running tests
- Merge without PR review
- Skip staging for major releases
- Force push to protected branches

## Getting Help

- **Full Documentation**: `docs/development/BRANCHING_STRATEGY.md`
- **CI/CD Guide**: `docs/development/CI_CD_PIPELINE.md`
- **Quick Start**: `docs/development/QUICK_START.md`

---

**Keep this handy!** Bookmark or print for quick reference.
