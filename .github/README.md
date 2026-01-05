# GitHub Configuration

This directory contains GitHub-specific configurations for the PlusCraft Launcher project.

## 📁 Directory Structure

```
.github/
├── workflows/           # GitHub Actions CI/CD pipelines
│   ├── lint.yml        # Code quality checks
│   ├── test.yml        # Test execution
│   ├── security.yml    # Security scanning
│   ├── pr-checks.yml   # Pull request validation
│   └── release.yml     # Build and release automation
├── ISSUE_TEMPLATE/     # Issue templates
│   ├── bug_report.md
│   ├── feature_request.md
│   └── documentation.md
├── PULL_REQUEST_TEMPLATE.md  # PR template
└── dependabot.yml      # Dependency update automation
```

## 🔄 Workflows

### [lint.yml](workflows/lint.yml)
**Purpose**: Code quality and formatting validation

**Triggers**: Push and PR to main/develop
- ESLint checks
- Prettier formatting
- Dependency audit

### [test.yml](workflows/test.yml)
**Purpose**: Test execution and coverage

**Triggers**: Push and PR to main/develop
- Jest tests on Node 18 and 20
- Coverage reports
- Codecov integration

### [security.yml](workflows/security.yml)
**Purpose**: Security vulnerability scanning

**Triggers**: Push, PR, and weekly schedule
- NPM security audit
- CodeQL analysis
- Secret scanning
- Dependency review

### [pr-checks.yml](workflows/pr-checks.yml)
**Purpose**: Comprehensive PR validation

**Triggers**: PR events
- All quality checks
- Multi-version testing
- Build verification
- Automated summary

### [release.yml](workflows/release.yml)
**Purpose**: Automated releases

**Triggers**: Version tags (v*)
- Multi-platform builds
- Changelog generation
- GitHub release creation
- Artifact publishing

## 📝 Templates

### [PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md)
Standard template for pull requests with:
- Description sections
- Type of change checklist
- Testing checklist
- Platform testing
- Additional context

### Issue Templates

#### [bug_report.md](ISSUE_TEMPLATE/bug_report.md)
For reporting bugs with:
- Bug description
- Reproduction steps
- Expected vs actual behavior
- Environment details
- Error logs

#### [feature_request.md](ISSUE_TEMPLATE/feature_request.md)
For suggesting features with:
- Feature description
- Problem statement
- Proposed solution
- Use cases
- Priority level

#### [documentation.md](ISSUE_TEMPLATE/documentation.md)
For documentation issues with:
- Issue location
- Current vs suggested content
- Type of documentation issue

## 🤖 Dependabot

### [dependabot.yml](dependabot.yml)
Automated dependency updates:
- **Schedule**: Weekly (Mondays, 9am UTC)
- **Ecosystems**: npm, GitHub Actions
- **Grouping**: Production, Development, Electron, Testing
- **Auto-labels**: dependencies, automated

## 🔒 Security

Security features enabled:
- ✅ NPM audit (high/critical threshold)
- ✅ CodeQL analysis
- ✅ Secret scanning (TruffleHog)
- ✅ Dependency review
- ✅ Weekly automated scans

## 📊 Status Badges

Add these to your README:

```markdown
![Tests](https://github.com/dadwow/launcher/workflows/Run%20Tests/badge.svg)
![Lint](https://github.com/dadwow/launcher/workflows/Code%20Quality/badge.svg)
![Security](https://github.com/dadwow/launcher/workflows/Security%20Scan/badge.svg)
```

## 🚀 Quick Links

- [CI/CD Pipeline Documentation](../docs/development/CI_CD_PIPELINE.md)
- [Quick Start Guide](../docs/development/QUICK_START.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

**Maintained by**: AC Launcher Team
