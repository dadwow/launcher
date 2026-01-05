# Quick Start: CI/CD Setup

This guide will help you get started with the CI/CD pipeline quickly.

## ⚡ Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install ESLint and Prettier along with other dependencies.

### 2. Verify Setup

```bash
# Run all quality checks
npm run validate
```

### 3. Local Development

```bash
# Start the app
npm start

# Run tests in watch mode
npm run test:watch

# Lint and format before committing
npm run lint:fix
npm run format
```

## 🚀 Making Your First Contribution

### Step 1: Create a Feature Branch

```bash
git checkout -b feature/my-awesome-feature
```

### Step 2: Make Your Changes

Edit files, add features, fix bugs...

### Step 3: Run Quality Checks

```bash
# Lint your code
npm run lint:fix

# Format your code
npm run format

# Run tests
npm test

# Or run everything
npm run validate
```

### Step 4: Commit Your Changes

```bash
git add .
git commit -m "feat: add my awesome feature"
```

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `chore:` for maintenance

### Step 5: Push and Create PR

```bash
git push origin feature/my-awesome-feature
```

Then create a Pull Request on GitHub. The CI/CD pipeline will automatically:
- ✅ Run linting
- ✅ Run tests
- ✅ Check security
- ✅ Validate build
- ✅ Generate summary

## 📦 Creating a Release

### Method 1: Automatic (Recommended)

```bash
# Bump version
npm version patch  # or minor, or major

# Push the tag
git push --tags
```

The CI/CD will automatically build and release!

### Method 2: Manual

1. Go to **Actions** → **Build and Release**
2. Click **Run workflow**
3. Enter version (e.g., `1.0.40`)
4. Click **Run workflow**

## 🔧 Essential Commands

```bash
# Development
npm start              # Run the app
npm run dev           # Run with debugging

# Testing
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint          # Check for linting errors
npm run lint:fix      # Fix linting errors automatically
npm run format        # Format all code
npm run format:check  # Check if code is formatted

# Building
npm run build:linux   # Build for Linux
npm run build:mac     # Build for macOS
npm run build:win     # Build for Windows
npm run build:all     # Build for all platforms

# Validation
npm run validate      # Run all checks (lint + format + test)
```

## 📋 PR Checklist

Before creating a PR, ensure:
- [ ] Code is formatted: `npm run format`
- [ ] Linting passes: `npm run lint`
- [ ] Tests pass: `npm test`
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

## 🎯 Common Workflows

### Fixing a Bug

```bash
# 1. Create branch
git checkout -b fix/button-not-working

# 2. Fix the bug and add test
# ... edit files ...

# 3. Validate
npm run validate

# 4. Commit
git commit -am "fix: resolve button click issue"

# 5. Push and create PR
git push origin fix/button-not-working
```

### Adding a Feature

```bash
# 1. Create branch
git checkout -b feature/dark-mode

# 2. Implement feature with tests
# ... edit files ...

# 3. Validate
npm run validate

# 4. Commit
git commit -am "feat: add dark mode support"

# 5. Push and create PR
git push origin feature/dark-mode
```

### Updating Documentation

```bash
# 1. Create branch
git checkout -b docs/update-readme

# 2. Update docs
# ... edit files ...

# 3. Commit
git commit -am "docs: update installation instructions"

# 4. Push and create PR
git push origin docs/update-readme
```

## 🆘 Getting Help

- Check the [full CI/CD documentation](CI_CD_PIPELINE.md)
- Read the [Contributing Guide](../../CONTRIBUTING.md)
- Open an [issue](https://github.com/dadwow/launcher/issues)

---

**Happy coding!** 🎉
