# Git Hooks Configuration

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) for automated code quality checks before commits.

## What Are Git Hooks?

Git hooks are scripts that run automatically at certain points in the Git workflow. This project uses a **pre-commit hook** that runs before each commit to ensure code quality.

## How It Works

When you run `git commit`:

1. **Pre-commit hook triggers** automatically
2. **lint-staged runs** on staged files only
3. **ESLint** checks JavaScript files for errors
4. **Prettier** formats all files
5. If everything passes → **commit succeeds** ✅
6. If there are errors → **commit is blocked** ❌

### Visual Flow

```
git add file.js
     ↓
git commit -m "message"
     ↓
┌─────────────────────────┐
│   Pre-commit Hook       │
│   (Husky)               │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│   lint-staged           │
│   (Only staged files)   │
└──────────┬──────────────┘
           ↓
    ┌──────┴──────┐
    ↓             ↓
┌────────┐   ┌─────────┐
│ ESLint │   │Prettier │
│  --fix │   │ --write │
└────┬───┘   └────┬────┘
     ↓            ↓
     └─────┬──────┘
           ↓
     All Pass? ✅
           ↓
    Commit Success!
```

## What Gets Checked

### JavaScript Files (*.js)
```bash
- ESLint --fix (auto-fixes issues)
- Prettier --write (auto-formats)
```

### Other Files (*.json, *.css, *.html, *.md)
```bash
- Prettier --write (auto-formats)
```

### Important: Only Staged Files!

lint-staged **only runs on files you've staged** with `git add`. This means:
- ✅ Fast - doesn't check entire codebase
- ✅ Efficient - only checks what you're committing
- ✅ Focused - doesn't block you for unrelated files

## Configuration

### package.json

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.js": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,html,md}": [
      "prettier --write"
    ]
  }
}
```

### .husky/pre-commit

```bash
npx lint-staged
```

## Usage Examples

### Normal Commit (Everything Passes)

```bash
$ git add src/main.js
$ git commit -m "feat: add new feature"

✔ Preparing lint-staged...
✔ Running tasks for staged files...
✔ Applying modifications from tasks...
✔ Cleaning up temporary files...

[feature/new-feature abc123] feat: add new feature
 1 file changed, 10 insertions(+)
```

### Commit with Auto-Fixes

```bash
$ git add src/main.js
$ git commit -m "feat: add new feature"

✔ Preparing lint-staged...
⚠ Running tasks for staged files...
  ⚠ src/main.js
    ✔ eslint --fix
    ✔ prettier --write
✔ Applying modifications from tasks...
✔ Cleaning up temporary files...

[feature/new-feature abc123] feat: add new feature
 1 file changed, 10 insertions(+), 8 deletions(-)
```

**Note**: Files were auto-fixed and auto-staged!

### Commit with Errors (Blocked)

```bash
$ git add src/main.js
$ git commit -m "feat: add new feature"

✔ Preparing lint-staged...
✖ Running tasks for staged files...
  ✖ src/main.js
    ✖ eslint --fix
      Error: 'someVar' is not defined (no-undef)

✖ lint-staged failed
```

**Fix the errors and try again!**

## Benefits

### 1. Automatic Code Formatting ✨
- No more "please format your code" PR comments
- Consistent style across the entire codebase
- Auto-fixed before commit

### 2. Catch Errors Early 🐛
- Linting errors caught before commit
- Prevents pushing broken code
- Saves CI/CD time

### 3. Fast & Efficient ⚡
- Only checks staged files
- Runs in seconds
- Doesn't slow down your workflow

### 4. No Manual Steps 🚀
- Happens automatically
- Can't forget to run linting
- Integrated into Git workflow

## Manual Override (When Needed)

Sometimes you might need to commit without running hooks (e.g., WIP commits):

```bash
# Skip pre-commit hook
git commit -m "wip: work in progress" --no-verify

# Or use the short flag
git commit -m "wip: work in progress" -n
```

**⚠️ Warning**: Use sparingly! CI will still check everything.

## Troubleshooting

### Issue: Hook Not Running

**Symptom**: Commits go through without any checks

**Fix**:
```bash
# Reinstall Husky
npm run prepare

# Or manually
npx husky install
```

### Issue: Hook Fails Immediately

**Symptom**: Error about husky not found

**Fix**:
```bash
# Make sure dependencies are installed
npm install
```

### Issue: Can't Commit Anything

**Symptom**: Every commit fails

**Fix**:
```bash
# Check what's failing
git commit -m "test"

# If necessary, skip hooks temporarily
git commit -m "test" --no-verify

# Then fix the underlying issues
npm run lint:fix
npm run format
```

### Issue: Slow Commits

**Symptom**: Takes too long to commit

**Cause**: Probably checking too many files

**Fix**: lint-staged only checks staged files, so this should be fast. If slow:
```bash
# Check what's staged
git status

# Only stage what you need
git reset
git add specific-file.js
```

## Disabling Hooks (Not Recommended)

If you absolutely need to disable hooks:

### Temporarily (One Commit)
```bash
git commit -m "message" --no-verify
```

### Permanently (Not Recommended)
```bash
# Remove the .husky directory
rm -rf .husky

# Remove from package.json
# Delete the "prepare" script
```

**⚠️ Warning**: Disabling hooks removes automatic quality checks. CI will still enforce them!

## CI/CD Integration

Even with git hooks, CI/CD still runs full checks:

```
Local (Pre-commit)      CI/CD (GitHub Actions)
─────────────────       ──────────────────────
✅ Staged files only    ✅ All files
✅ Fast (~5 seconds)    ✅ Comprehensive (~3 min)
✅ Auto-fix enabled     ✅ No auto-fix
⚠️ Can be skipped       ✅ Cannot be skipped
```

Git hooks are the **first line of defense**, CI/CD is the **safety net**.

## Best Practices

### ✅ Do's

- ✅ Let hooks auto-fix when possible
- ✅ Commit small, focused changes
- ✅ Run `npm run validate` before pushing
- ✅ Fix linting errors immediately

### ❌ Don'ts

- ❌ Don't use `--no-verify` habitually
- ❌ Don't commit without testing
- ❌ Don't stage everything with `git add .` blindly
- ❌ Don't disable hooks permanently

## Updating Hook Configuration

### Add New File Types

Edit `package.json`:

```json
"lint-staged": {
  "*.js": ["eslint --fix", "prettier --write"],
  "*.{json,css,html,md}": ["prettier --write"],
  "*.ts": ["eslint --fix", "prettier --write"]  // Add TypeScript
}
```

### Add New Hooks

Create new hook files:

```bash
# Pre-push hook (runs before git push)
echo '#!/bin/sh
npm test' > .husky/pre-push
chmod +x .husky/pre-push
```

### Modify Existing Hooks

Edit `.husky/pre-commit`:

```bash
#!/bin/sh

# Run lint-staged
npx lint-staged

# Also run tests on staged files
# npm test
```

## Migration from Old Setup

If you had the problematic `prepare` script:

### Old (❌ Bad)
```json
"scripts": {
  "prepare": "npm run validate",
  "validate": "npm run lint && npm run format:check && npm test"
}
```

**Problem**: Runs full validation on every `npm install` - slow and blocks installation!

### New (✅ Good)
```json
"scripts": {
  "prepare": "husky",
  "validate": "npm run lint && npm run format:check && npm test"
}
"lint-staged": {
  "*.js": ["eslint --fix", "prettier --write"],
  "*.{json,css,html,md}": ["prettier --write"]
}
```

**Benefits**: 
- Fast - only checks staged files
- Smart - only runs on commit, not install
- Auto-fix - fixes issues automatically

## Additional Resources

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)

## Summary

- 🎯 **Pre-commit hook** runs automatically before each commit
- ⚡ **lint-staged** only checks files you're committing
- 🔧 **ESLint** auto-fixes JavaScript issues
- ✨ **Prettier** auto-formats all files
- 🚀 **Fast** - takes only seconds
- ✅ **Safe** - CI still validates everything

**Result**: Cleaner commits, fewer PR comments, better code quality! 🎉

---

**Questions?** See the main documentation or open an issue.
