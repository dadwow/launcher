# Git Branching Strategy

This document describes the branching strategy and workflow for the PlusCraft Launcher project.

## 📋 Table of Contents

- [Overview](#overview)
- [Branch Types](#branch-types)
- [Workflow](#workflow)
- [Release Process](#release-process)
- [Examples](#examples)
- [Branch Protection](#branch-protection)

## 🎯 Overview

We use a **modified Git Flow** strategy with the following branches:

```
┌─────────────────────────────────────────────────────────────┐
│                    Branch Hierarchy                          │
└─────────────────────────────────────────────────────────────┘

main (production) ──────────────────────────────────────────>
  │                     │                    │
  │ hotfix/*            │                    │ tag: v1.0.40
  │                     │                    │
  ├─> fix ─────────────>│                    │
  │                     │                    │
  └──────────────────── ← merge ─────────────┘

staging (pre-release) ──────────────────────────────────────>
  │                          │                    │
  │ test & validate          │ builds created     │ merge to main
  │                          │                    │
  └────────────────────────← merge ───────────────┘

develop (integration) ───────────────────────────────────────>
  │              │              │              │
  │ feature/1    │ feature/2    │ fix/1        │
  │              │              │              │
  ├─> develop   ├─> develop   ├─> develop    │
  │              │              │              │
  └────> PR ────┴────> PR ────┴────> PR ─────┘
```

## 🌳 Branch Types

### 1. `main` - Production Branch

**Purpose**: Contains production-ready code
**Protected**: Yes
**Triggers**:
- Tag push (`v*`) → Full release
- Hotfix merges → Critical fixes

**Rules**:
- ✅ Only merge from `staging` or `hotfix/*`
- ✅ All merges require PR + approval
- ✅ Must pass all CI checks
- ✅ Releases created via tags

**CI/CD**:
- Runs full test suite
- Security scanning
- **Does NOT auto-build** (only on tag push)

### 2. `staging` - Pre-Release Branch

**Purpose**: Final testing before production
**Protected**: Yes
**Triggers**:
- Push → Staging builds
- Creates pre-release on GitHub

**Rules**:
- ✅ Only merge from `develop`
- ✅ Must pass all tests
- ✅ Creates staging builds for testing
- ✅ Artifacts retained for 14 days

**CI/CD** (`.github/workflows/staging.yml`):
- Validates all code
- Builds for all platforms
- Creates GitHub pre-release
- Generates test checklist

**When to use**:
- Before major releases
- When multiple features need integrated testing
- QA/UAT testing phase

### 3. `develop` - Integration Branch

**Purpose**: Integration of new features
**Protected**: Yes (recommended)
**Triggers**:
- Push → Development validation
- PR → Full validation

**Rules**:
- ✅ Merge features via PR
- ✅ All CI checks must pass
- ✅ Code review required
- ✅ Up-to-date with main

**CI/CD** (`.github/workflows/develop.yml`):
- Linting and formatting
- Full test suite
- Integration tests
- Build verification

### 4. `feature/*` - Feature Branches

**Purpose**: Develop new features
**Protected**: No
**Naming**: `feature/feature-name`

**Examples**:
```bash
feature/addon-auto-update
feature/dark-mode
feature/discord-integration
```

**Workflow**:
1. Branch from `develop`
2. Develop feature
3. Create PR to `develop`
4. Delete after merge

### 5. `fix/*` - Bug Fix Branches

**Purpose**: Fix non-critical bugs
**Protected**: No
**Naming**: `fix/bug-description`

**Examples**:
```bash
fix/download-progress-bar
fix/settings-not-saving
fix/memory-leak
```

**Workflow**:
1. Branch from `develop`
2. Fix bug + add test
3. Create PR to `develop`
4. Delete after merge

### 6. `hotfix/*` - Critical Fix Branches

**Purpose**: Emergency production fixes
**Protected**: No
**Naming**: `hotfix/critical-issue`

**Examples**:
```bash
hotfix/login-crash
hotfix/data-corruption
hotfix/security-vulnerability
```

**Workflow**:
1. Branch from `main`
2. Fix critical issue
3. Create PR to `main` AND `develop`
4. Tag new version immediately
5. Delete after merge

## 🔄 Workflow

### Standard Feature Development

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/my-awesome-feature

# 3. Develop and commit
git add .
git commit -m "feat: add my awesome feature"

# 4. Push and create PR to develop
git push origin feature/my-awesome-feature
# Create PR: feature/my-awesome-feature → develop

# 5. After merge, delete branch
git branch -d feature/my-awesome-feature
```

### Bug Fix Workflow

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create fix branch
git checkout -b fix/button-not-working

# 3. Fix and test
git add .
git commit -m "fix: resolve button click handler"

# 4. Push and create PR to develop
git push origin fix/button-not-working
# Create PR: fix/button-not-working → develop
```

### Hotfix Workflow (Critical!)

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create hotfix branch
git checkout -b hotfix/critical-crash

# 3. Fix immediately
git add .
git commit -m "hotfix: fix critical crash on startup"

# 4. Create PR to BOTH main and develop
git push origin hotfix/critical-crash
# Create PR: hotfix/critical-crash → main
# Create PR: hotfix/critical-crash → develop

# 5. After merge to main, create tag
git checkout main
git pull
npm version patch
git push --tags

# 6. Ensure merged to develop too
git checkout develop
git pull
```

## 📦 Release Process

### Method 1: Standard Release (Recommended)

```bash
# 1. Merge features to develop
feature/* → develop (via PR)

# 2. When ready for release, merge to staging
git checkout staging
git pull origin staging
git merge develop
git push origin staging

# 3. Staging workflow creates pre-release
# Test the staging build thoroughly!

# 4. If tests pass, merge staging to main
git checkout main
git pull origin main
git merge staging
git push origin main

# 5. Create release tag
npm version minor  # or patch, or major
git push --tags

# 6. Release workflow automatically:
# - Builds all platforms
# - Generates changelog
# - Creates GitHub release
```

### Method 2: Quick Patch Release

```bash
# 1. Fix merged to develop
git checkout develop
# ... merge fix PR ...

# 2. Merge directly to main (if low risk)
git checkout main
git merge develop
git push

# 3. Tag and release
npm version patch
git push --tags
```

### Method 3: Emergency Hotfix

```bash
# 1. Hotfix merged to main
git checkout main
# ... merge hotfix PR ...

# 2. Immediately tag
npm version patch
git push --tags

# 3. Ensure develop is updated
git checkout develop
git merge main
git push
```

## 🎯 Workflow Summary

| Branch | Purpose | Merge From | Merge To | CI/CD |
|--------|---------|------------|----------|-------|
| `main` | Production | `staging`, `hotfix/*` | - | Tests, Release on tag |
| `staging` | Pre-release | `develop` | `main` | Build, Pre-release |
| `develop` | Integration | `feature/*`, `fix/*` | `staging` | Tests, Validation |
| `feature/*` | New features | `develop` | `develop` | PR checks |
| `fix/*` | Bug fixes | `develop` | `develop` | PR checks |
| `hotfix/*` | Critical fixes | `main` | `main`, `develop` | PR checks |

## 🔒 Branch Protection

### Recommended Settings

#### `main` Branch
```yaml
✅ Require pull request reviews (1+ approvals)
✅ Require status checks to pass:
   - validate-develop (if from develop)
   - lint
   - test
   - security
✅ Require branches to be up to date
✅ Require conversation resolution
✅ Restrict who can push (maintainers only)
✅ Require signed commits (optional)
```

#### `staging` Branch
```yaml
✅ Require pull request reviews (1 approval)
✅ Require status checks to pass:
   - validate-develop
   - build-staging
✅ Require branches to be up to date
```

#### `develop` Branch
```yaml
✅ Require pull request reviews (1 approval)
✅ Require status checks to pass:
   - lint
   - test
   - build-check
✅ Require branches to be up to date
```

## 📊 Examples

### Example 1: Adding Two Features

```bash
# Developer A: Feature 1
git checkout develop
git checkout -b feature/addon-manager
# ... work ...
git push origin feature/addon-manager
# PR: feature/addon-manager → develop → ✅ Merged

# Developer B: Feature 2
git checkout develop
git checkout -b feature/settings-ui
# ... work ...
git push origin feature/settings-ui
# PR: feature/settings-ui → develop → ✅ Merged

# Release Manager: Prepare release
git checkout develop
git pull
git checkout staging
git merge develop
git push origin staging
# ✅ Staging builds created

# After testing staging builds:
git checkout main
git merge staging
git push
npm version minor  # 1.0.39 → 1.1.0
git push --tags
# ✅ Release v1.1.0 published
```

### Example 2: Critical Bug in Production

```bash
# 1. Critical bug discovered in production (v1.0.40)
git checkout main
git pull
git checkout -b hotfix/login-crash

# 2. Fix the bug
# ... fix code ...
git commit -m "hotfix: fix login crash on missing credentials"

# 3. Create PRs
git push origin hotfix/login-crash
# PR #1: hotfix/login-crash → main
# PR #2: hotfix/login-crash → develop

# 4. After both PRs merged:
git checkout main
git pull
npm version patch  # 1.0.40 → 1.0.41
git push --tags

# 5. Ensure develop has the fix
git checkout develop
git pull
# ✅ Hotfix v1.0.41 published
```

## 🎨 Visual Workflow

```
Time ──────────────────────────────────────────────────────>

feature/a    ●──●──●──┐
                      ├─●─> develop
feature/b         ●──●┘      │
                              │
develop      ●────────────────●──●──●──┐
                                        │
                                        ├─●─> staging
                                        │      │
staging                                 ●──────●──●──●──┐
                                                         │
                                                         ├─●─> main
main         ●──────────────────────────────────────────●─────●──>
             v1.0.38                                    v1.0.39  v1.0.40
                                                        (tag)    (tag)
```

## 📝 Best Practices

1. **Always branch from the correct source**
   - Features/fixes → from `develop`
   - Hotfixes → from `main`

2. **Keep branches up to date**
   ```bash
   git checkout feature/my-feature
   git fetch origin
   git merge origin/develop
   ```

3. **Use conventional commits**
   ```
   feat: add new feature
   fix: resolve bug
   hotfix: critical production fix
   ```

4. **Delete branches after merge**
   - Keeps repository clean
   - Prevents confusion

5. **Test staging builds thoroughly**
   - Download from GitHub pre-release
   - Test on all platforms
   - Verify all new features

6. **Tag releases properly**
   - Use semantic versioning
   - Create from `main` only
   - Include changelog

## 🆘 Troubleshooting

### "develop is behind main"
```bash
git checkout develop
git merge main
git push origin develop
```

### "Forgot to branch from develop"
```bash
# If on feature branch that branched from wrong place
git checkout feature/my-feature
git rebase develop
```

### "Need to test something from main"
```bash
# Don't create branches from main unless hotfix!
git checkout main
npm start  # Test locally
# Create hotfix branch if fix needed
```

## 📚 Additional Resources

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

**Last Updated**: January 5, 2026
**Maintained by**: AC Launcher Team
