# Merge Queue Configuration Guide

## What is a Merge Queue?

A merge queue is a GitHub feature that ensures multiple PRs can be safely merged without breaking each other. It tests PRs together before merging them to the target branch.

## When to Use Merge Queues

### ✅ Good For:
- High-traffic repositories with many contributors
- Projects with complex integration points
- Teams that merge multiple PRs daily
- When CI/CD takes a long time to run
- Critical projects where main must never break

### ❌ Not Necessary For:
- Small teams with few concurrent PRs
- Solo developers
- Repositories with infrequent updates
- Very fast CI pipelines (< 1 minute)
- **Your current project** (unless it grows significantly)

## How to Enable Merge Queue

### Step 1: Branch Protection Requirements

First, ensure your branch protection is set up:

1. Go to **Settings** → **Branches**
2. Edit branch protection rule for `main`
3. Enable:
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Require pull request reviews

### Step 2: Enable Merge Queue

1. In the same branch protection rule
2. Scroll to **"Require merge queue"**
3. Check the box
4. Configure settings:

```yaml
Merge method: Squash and merge (recommended)
Build concurrency: 5 (test up to 5 PRs at once)
Minimum PRs to merge: 1
Maximum PRs to merge: 5
Status check timeout: 60 minutes
```

### Step 3: Required Status Checks

Select which checks must pass:
- ✅ lint
- ✅ test (all Node versions)
- ✅ security
- ✅ build-test

## Configuration Options

### Basic Configuration

```yaml
# Simplest setup
Merge Queue: Enabled
Build Concurrency: 2
Merge Method: Squash
```

### Recommended for Your Project

```yaml
# If you enable it in the future
Merge Queue: Enabled
Build Concurrency: 3
Minimum PRs to merge: 1
Maximum PRs to merge: 5
Status Check Timeout: 30 minutes
Only merge non-failing PRs: Yes
Merge Method: Squash and merge
```

### Advanced Configuration

```yaml
# For large teams
Merge Queue: Enabled
Build Concurrency: 10
Minimum PRs to merge: 2
Maximum PRs to merge: 10
Status Check Timeout: 60 minutes
Only merge non-failing PRs: Yes
Require linear history: Yes
```

## How It Works in Practice

### Example 1: Three PRs

```bash
# Timeline
10:00 AM - PR #1 (feature/dark-mode) approved
10:05 AM - PR #2 (fix/button-crash) approved  
10:10 AM - PR #3 (feat/settings) approved

# Without Merge Queue
10:00 AM - PR #1 tests → merge
10:05 AM - PR #2 tests → merge
10:10 AM - PR #3 tests → merge
10:11 AM - ❌ Main broken! PR #2 + PR #3 conflict

# With Merge Queue
10:00 AM - All PRs added to queue
10:00 AM - PR #1 tested alone → ✅
10:05 AM - PR #1 merged
10:05 AM - PR #2 tested with PR #1 → ✅
10:10 AM - PR #2 merged
10:10 AM - PR #3 tested with PR #1 + PR #2 → ✅
10:15 AM - PR #3 merged
Result: ✅ Main always works!
```

### Example 2: Conflicting PRs

```bash
# PR #1: Changes button.js
# PR #2: Also changes button.js
# PR #3: Changes menu.js (unrelated)

Queue: [PR #1, PR #2, PR #3]

1. Test PR #1 → ✅ Pass → Merge
2. Test PR #2 with PR #1 → ❌ Conflict!
   → Remove PR #2 from queue
   → Notify author to rebase
3. Test PR #3 with PR #1 → ✅ Pass → Merge

Result: PR #2 author fixes conflicts, re-enters queue
```

## GitHub Actions Workflow Integration

### Add Merge Queue Trigger

Update your workflows to test merge queue builds:

```yaml
# .github/workflows/test.yml
on:
  push:
    branches: [ main, develop, staging ]
  pull_request:
    branches: [ main, develop, staging ]
  merge_group:  # ← Add this for merge queue
```

### Example Full Configuration

```yaml
name: Merge Queue Tests

on:
  merge_group:
    types: [checks_requested]

jobs:
  test-merge-queue:
    name: Test Merge Queue Build
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout merge group
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.merge_group.head_sha }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run all tests
        run: npm run validate
```

## Cost Considerations

### GitHub Actions Minutes

Merge queues run additional CI builds:
- Each PR in queue runs full CI
- More builds = more GitHub Actions minutes

**Example:**
- 3 PRs merged sequentially: 3 CI runs
- 3 PRs in merge queue: 3-6 CI runs (depending on conflicts)

### Free Tier:
- **Public repos**: Unlimited minutes ✅
- **Private repos**: 2,000 minutes/month

**Your project (public)**: ✅ No cost!

## Alternatives to Merge Queue

If merge queue seems overkill, consider these simpler options:

### 1. **Required Status Checks + Up-to-Date Branches**
```yaml
Branch Protection:
✅ Require status checks
✅ Require branches to be up to date
```
This forces authors to rebase before merge (what you have now).

### 2. **Auto-Merge Bot (Kodiak, Mergify)**
```yaml
# .github/mergify.yml
pull_request_rules:
  - name: Automatic merge
    conditions:
      - status-success=test
      - status-success=lint
      - approved-reviews-by>=1
    actions:
      merge:
        method: squash
```

### 3. **Manual Merge with Good Communication**
- Use Slack/Discord for coordination
- Merge PRs one at a time
- Suitable for small teams

## Decision Matrix

| Team Size | PRs/Day | CI Time | Recommendation |
|-----------|---------|---------|----------------|
| 1-2 | 0-3 | < 5 min | ❌ Not needed |
| 3-5 | 3-10 | 5-15 min | ⚠️ Optional |
| 5-10 | 10-30 | 10-30 min | ✅ Recommended |
| 10+ | 30+ | 30+ min | ✅ Essential |

**Your project**: 1-2 developers → ❌ Not needed yet

## When to Enable for Your Project

Consider enabling when:
- ✅ Team grows to 3+ active contributors
- ✅ Merging 5+ PRs per day
- ✅ Main branch breaks due to PR conflicts
- ✅ Multiple developers work on same files
- ✅ CI/CD takes > 10 minutes

## Current Recommendation

**For your project: DON'T enable merge queue yet**

Why?
- Small team (1-2 developers)
- Infrequent merges
- Fast CI pipeline
- Branch protection is sufficient

**What you have now is perfect:**
- Branch protection with required checks ✅
- PR reviews required ✅
- Status checks must pass ✅
- Branches must be up to date ✅

This is the right level of protection for your team size.

## If You Decide to Enable Later

### Quick Setup Steps

1. **GitHub Settings**:
   ```
   Settings → Branches → main → Edit
   ✅ Require merge queue
   Build concurrency: 3
   ```

2. **Update Workflows**:
   ```yaml
   on:
     merge_group:  # Add to test.yml, lint.yml, etc.
   ```

3. **Test It**:
   - Create 2-3 test PRs
   - Add them to queue
   - Verify they merge correctly

## Resources

- [GitHub Docs: Merge Queues](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [GitHub Blog: Merge Queue](https://github.blog/2023-02-08-merge-queue-available-for-all-public-repositories/)
- [Best Practices](https://github.blog/2023-07-05-merge-queue-best-practices/)

## Summary

**Merge Queue** = Advanced feature for busy repositories

**Your current setup** = Perfect for small teams

**When to reconsider**: Team grows or main keeps breaking

---

**Bottom line**: You don't need it now, but it's great to know about for the future! 🚀
