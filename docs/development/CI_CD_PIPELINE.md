# CI/CD Pipeline Documentation

This document describes the complete CI/CD (Continuous Integration/Continuous Deployment) pipeline for the PlusCraft Launcher.

## 📋 Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
- [GitHub Actions](#github-actions)
- [Release Process](#release-process)
- [Quality Gates](#quality-gates)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Our CI/CD pipeline ensures code quality, security, and automated releases through multiple workflows:

```
┌─────────────────────────────────────────────────────────────┐
│                         Push to Branch                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├──> Code Quality (lint.yml)
                       │    ├─ ESLint check
                       │    ├─ Prettier check
                       │    └─ Dependency audit
                       │
                       ├──> Tests (test.yml)
                       │    ├─ Unit tests (Node 18, 20)
                       │    ├─ Coverage report
                       │    └─ Upload to Codecov
                       │
                       └──> Security (security.yml)
                            ├─ NPM audit
                            ├─ CodeQL analysis
                            ├─ Secret scanning
                            └─ Dependency review
┌─────────────────────────────────────────────────────────────┐
│                     Pull Request Created                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       └──> PR Checks (pr-checks.yml)
                            ├─ Code quality
                            ├─ Tests (all versions)
                            ├─ Security checks
                            ├─ Build test
                            └─ PR summary
┌─────────────────────────────────────────────────────────────┐
│                       Tag Push (v*)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       └──> Release (release.yml)
                            ├─ Build (Windows, macOS, Linux)
                            ├─ Generate changelog
                            ├─ Create GitHub release
                            └─ Upload artifacts
```

## 🔄 Workflows

### 1. Code Quality Workflow (`lint.yml`)

**Triggers:**
- Push to `main`, `develop`, `staging`, `feature/**`, `fix/**` branches
- Pull requests to `main`, `develop`, or `staging`

**Jobs:**
- **lint**: Runs ESLint on all JavaScript files
- **format-check**: Validates code formatting with Prettier
- **dependency-audit**: Checks for vulnerable dependencies
- **quality-gate**: Ensures all checks pass

**Location:** `.github/workflows/lint.yml`

### 2. Test Workflow (`test.yml`)

**Triggers:**
- Push to `main`, `develop`, `staging`, `feature/**`, `fix/**` branches
- Pull requests to `main`, `develop`, or `staging`

**Jobs:**
- **test**: Runs Jest tests on Node 18 and 20
- **test-status**: Validates test results

**Features:**
- Matrix testing across Node versions
- Code coverage generation
- Codecov integration
- Test result archiving

**Location:** `.github/workflows/test.yml`

### 3. Security Workflow (`security.yml`)

**Triggers:**
- Push to `main`, `develop`, or `staging`
- Pull requests to `main`, `develop`, or `staging`
- Weekly schedule (Mondays at 9am UTC)

**Jobs:**
- **security-audit**: NPM vulnerability scanning
- **dependency-review**: Reviews dependencies in PRs
- **codeql-analysis**: GitHub CodeQL security analysis
- **secret-scanning**: Scans for leaked secrets
- **security-summary**: Aggregates results

**Location:** `.github/workflows/security.yml`

### 4. PR Checks Workflow (`pr-checks.yml`)

**Triggers:**
- Pull request opened/updated/reopened to `main`, `develop`, or `staging`
- Pull request marked ready for review

**Jobs:**
- **info**: Displays PR information
- **lint**: Code quality checks
- **test**: Full test suite
- **security**: Security validation
- **build-test**: Validates builds work
- **pr-summary**: Generates summary report

**Features:**
- Concurrency control (cancels previous runs)
- Comprehensive quality gates
- Visual summary in PR
- Prevents merging with failures

**Location:** `.github/workflows/pr-checks.yml`

### 5. Develop Workflow (`develop.yml`) **NEW**

**Triggers:**
- Push to `develop` branch
- Pull requests to `develop`

**Jobs:**
- **validate-develop**: Linting, formatting, tests with coverage
- **integration-test**: Multi-platform testing
- **build-check**: Verify builds work
- **develop-summary**: Status summary

**Features:**
- Validates integration of features
- Tests on Linux, macOS, Windows
- Build verification
- Coverage reporting

**Location:** `.github/workflows/develop.yml`

### 6. Staging Workflow (`staging.yml`) **NEW**

**Triggers:**
- Push to `staging` branch
- Pull requests to `staging`
- Manual workflow dispatch

**Jobs:**
- **validate**: Full validation suite
- **build-staging**: Multi-platform builds
- **create-pre-release**: GitHub pre-release with artifacts
- **staging-summary**: Build summary

**Features:**
- Creates downloadable pre-release builds
- Artifacts retained for 14 days
- Testing checklist in release notes
- Pre-release tagged with commit SHA

**Location:** `.github/workflows/staging.yml`

### 7. Release Workflow (`release.yml`)

**Triggers:**
- Tag push matching `v*` (e.g., `v1.0.40`)
- Manual workflow dispatch with version input

**Jobs:**
- **check-release**: Validates release conditions
- **build**: Multi-platform builds (Windows, macOS, Linux)
- **release**: Creates GitHub release with artifacts

**Features:**
- Semantic versioning support
- Cross-platform building
- Automated changelog generation
- Artifact bundling and upload

**Location:** `.github/workflows/release.yml`

## 🚀 GitHub Actions

### Node.js Setup

All workflows use consistent Node.js setup:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

### Dependency Installation

We use `npm ci` for reproducible builds:

```yaml
- name: Install dependencies
  run: npm ci
```

### Artifact Management

Build artifacts are preserved for 5-30 days:

```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: dist/
    retention-days: 5
```

## 📦 Release Process

### Automated Release (Recommended)

1. **Update version** in `package.json`:
   ```bash
   npm version patch  # 1.0.39 → 1.0.40
   # or
   npm version minor  # 1.0.39 → 1.1.0
   # or
   npm version major  # 1.0.39 → 2.0.0
   ```

2. **Push the tag**:
   ```bash
   git push --tags
   ```

3. **Pipeline automatically**:
   - Validates the tag
   - Builds for all platforms
   - Generates changelog
   - Creates GitHub release
   - Uploads artifacts

### Manual Release

1. Go to **Actions** → **Build and Release**
2. Click **Run workflow**
3. Enter the version (e.g., `1.0.40`)
4. Click **Run workflow**

### Release Artifacts

Each release includes:
- **Windows**: `.exe` installer, `latest.yml`, `.blockmap`
- **macOS**: `.dmg`, `.zip`, `latest-mac.yml`, `.blockmap`
- **Linux**: `.AppImage`, `.deb`, `.tar.gz`, `latest-linux.yml`

### Changelog Generation

Changelog is automatically categorized by commit prefix:

- `feat:` → 🚀 Features
- `fix:` → 🐛 Bug Fixes
- `docs:` → 📚 Documentation
- `chore:/refactor:/perf:` → 🔧 Maintenance

## ✅ Quality Gates

### Pre-Merge Requirements

All PRs must pass:
1. ✅ ESLint (no errors)
2. ✅ Prettier formatting
3. ✅ All tests passing
4. ✅ Code coverage maintained
5. ✅ Security audit (no high/critical)
6. ✅ Build test successful

### Branch Protection Rules

Recommended settings for `main` branch:

```yaml
Require pull request reviews: ✅
Require status checks to pass: ✅
  - lint
  - test
  - security
  - build-test
Require branches to be up to date: ✅
Require conversation resolution: ✅
```

## 🔒 Security

### Automated Scanning

- **NPM Audit**: Scans dependencies weekly
- **CodeQL**: Analyzes code for vulnerabilities
- **Secret Scanning**: Detects leaked credentials
- **Dependency Review**: Blocks risky dependencies in PRs

### Security Thresholds

- **NPM Audit**: Fails on `high` or `critical`
- **Dependency Review**: Fails on `moderate` or higher
- **License Blocking**: Blocks GPL-3.0, AGPL-3.0

### Dependabot

Automated dependency updates configured in `.github/dependabot.yml`:

- **Schedule**: Weekly (Mondays at 9am)
- **Groups**: Production, Development, Electron, Testing
- **Auto-labels**: `dependencies`, `automated`

## 🛠️ Local Development

### Running Quality Checks Locally

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Run tests
npm test

# Run all validations
npm run validate
```

### Pre-commit Checks

Install git hooks to run checks before commits:

```bash
# Add to .git/hooks/pre-commit
#!/bin/sh
npm run lint && npm run format:check
```

## 🐛 Troubleshooting

### Common Issues

#### 1. ESLint Failures

**Error**: `ESLint found errors`

**Solution**:
```bash
npm run lint:fix
git add .
git commit --amend
```

#### 2. Formatting Issues

**Error**: `Prettier check failed`

**Solution**:
```bash
npm run format
git add .
git commit --amend
```

#### 3. Test Failures

**Error**: `Tests failed`

**Solution**:
```bash
# Run tests locally
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode to debug
npm run test:watch
```

#### 4. Build Failures

**Error**: `electron-builder failed`

**Solution**:
```bash
# Check .env file exists
cat .env

# Try building locally
npm run build:linux  # or :win or :mac

# Check build configuration
cat package.json | grep -A 50 '"build"'
```

#### 5. Release Tag Issues

**Error**: `Release workflow didn't trigger`

**Solution**:
```bash
# Ensure tag format is correct (v*)
git tag -d v1.0.40  # Delete local tag
git push origin :refs/tags/v1.0.40  # Delete remote tag
npm version patch  # Create proper version
git push --tags  # Push new tag
```

### Workflow Logs

View detailed logs:
1. Go to **Actions** tab
2. Click on failed workflow
3. Click on failed job
4. Expand failed step

### Re-running Workflows

If a workflow fails due to transient issues:
1. Go to **Actions** tab
2. Click on failed workflow
3. Click **Re-run all jobs**

## 📊 Metrics and Monitoring

### Coverage Reports

- **Location**: `coverage/lcov-report/index.html`
- **Threshold**: 70% minimum
- **Uploaded to**: Codecov

### Build Artifacts

- **Retention**: 5-30 days
- **Size**: ~50-200MB per platform
- **Storage**: GitHub Actions artifacts

### Workflow Duration

Typical durations:
- **Lint**: ~30 seconds
- **Test**: ~1-2 minutes
- **Security**: ~2-3 minutes
- **PR Checks**: ~3-5 minutes
- **Release**: ~10-15 minutes

## 🔄 Maintenance

### Regular Tasks

1. **Weekly**: Review Dependabot PRs
2. **Monthly**: Update workflows to latest actions
3. **Quarterly**: Review and update security policies
4. **As needed**: Update Node.js versions in matrix

### Updating Actions

```yaml
# Keep actions up to date
actions/checkout@v4  # ← Always use latest major version
actions/setup-node@v4
actions/upload-artifact@v4
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Electron Builder Documentation](https://www.electron.build/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [CodeQL Documentation](https://codeql.github.com/docs/)

---

**Last Updated**: January 2026
**Maintained by**: AC Launcher Team
