# 🚀 Merge Queue Setup Instructions

This guide will help you enable and configure the merge queue feature for your repository.

## ✅ Prerequisites Completed

Your workflows are now ready for merge queue! The following workflows have been updated:
- ✅ `test.yml` - Triggers on merge_group
- ✅ `lint.yml` - Triggers on merge_group  
- ✅ `security.yml` - Triggers on merge_group
- ✅ `pr-checks.yml` - Triggers on merge_group

## 🔧 GitHub Settings Configuration

Follow these steps to enable the merge queue on GitHub:

### Step 1: Navigate to Branch Protection

1. Go to your repository: `https://github.com/dadwow/launcher`
2. Click **Settings** (top menu)
3. Click **Branches** (left sidebar)
4. Find the branch protection rule for `main`
   - If it doesn't exist, click **Add rule** and enter `main` as branch name

### Step 2: Configure Required Status Checks

In the branch protection settings for `main`:

1. ✅ **Require a pull request before merging**
   - Required approvals: `1`
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners (optional)

2. ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   
   **Select these status checks** (search for them):
   - `lint` (Code Quality)
   - `test (18.x)` (Tests on Node 18)
   - `test (20.x)` (Tests on Node 20)
   - `security-audit` (Security Checks)
   - `build-check` (Build Verification)

3. ✅ **Require conversation resolution before merging**

4. ✅ **Require linear history** (optional but recommended)

### Step 3: Enable Merge Queue

Still in the branch protection settings:

1. Scroll down to **"Require merge queue"**
2. ✅ Check the box to enable

3. **Configure merge queue settings**:

```
Method for merging entries: Squash and merge

Queue settings:
├─ Build concurrency: 3
│  (Number of PRs to test simultaneously)
│
├─ Minimum entries to merge: 1
│  (Don't wait for more PRs)
│
├─ Maximum entries to merge: 5
│  (Batch up to 5 PRs together)
│
├─ Merge timeout: 60 minutes
│  (How long to wait for checks)
│
└─ Only merge non-failing entries: Yes
   (Skip PRs that fail tests)
```

### Step 4: Restrict Push Access (Recommended)

1. ✅ **Restrict who can push to matching branches**
   - Add yourself and any maintainers
   - Prevents direct pushes to main

2. ✅ **Allow force pushes**: ❌ (disabled)

3. ✅ **Allow deletions**: ❌ (disabled)

### Step 5: Save Settings

Click **Save changes** at the bottom

## 🎯 Recommended Settings Summary

Here's the complete recommended configuration:

```yaml
Branch: main

Pull Request Requirements:
✅ Require pull request reviews (1 approval)
✅ Dismiss stale reviews on new commits
✅ Require review from code owners (optional)

Status Checks:
✅ Require status checks to pass
✅ Require branches to be up to date
   Required checks:
   - lint
   - test (18.x)
   - test (20.x)
   - security-audit
   - build-check

Merge Queue:
✅ Require merge queue
   Method: Squash and merge
   Build concurrency: 3
   Min entries: 1
   Max entries: 5
   Timeout: 60 minutes
   Only merge non-failing: Yes

Additional Rules:
✅ Require conversation resolution
✅ Require linear history
✅ Restrict who can push
❌ Allow force pushes
❌ Allow deletions
```

## 📊 How It Works After Setup

### Normal PR Workflow

```bash
# 1. Create PR
git checkout -b feature/my-feature
git push origin feature/my-feature
# Create PR on GitHub

# 2. Get approval
# PR passes all checks
# PR gets 1+ approval

# 3. Click "Merge when ready"
# PR enters merge queue automatically

# 4. GitHub tests it
# Tests run with other queued PRs
# If passes: auto-merges
# If fails: removed from queue
```

### Visual Example

```
┌─────────────────────────────────────────────┐
│  PR #1: "Add dark mode"                     │
│  Status: ✅ Approved, ✅ All checks passed  │
│  Action: Click "Merge when ready"           │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│           Merge Queue: main                  │
│  ┌──────────────────────────────────────┐   │
│  │ Position 1: PR #1 (your PR)          │   │
│  │ Status: Testing...                   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Testing checks:                             │
│  ✅ lint                                     │
│  ✅ test (18.x)                              │
│  ✅ test (20.x)                              │
│  ⏳ security-audit (running...)             │
│  ⏳ build-check (running...)                │
└─────────────────────────────────────────────┘
               │
               ▼ (2-3 minutes later)
┌─────────────────────────────────────────────┐
│  All checks passed! ✅                       │
│  Merging to main...                          │
└──────────────┬──────────────────────────────┘
               │
               ▼
        Merged to main! 🎉
```

## 🧪 Testing the Setup

After enabling, test it:

### Test 1: Single PR

```bash
# 1. Create test branch
git checkout -b test/merge-queue
echo "test" >> README.md
git commit -am "test: verify merge queue works"
git push origin test/merge-queue

# 2. Create PR on GitHub
# 3. Get approval
# 4. Click "Merge when ready"
# 5. Watch it go through the queue
```

### Test 2: Multiple PRs

```bash
# Create 2-3 test PRs at the same time
# Add them all to the queue
# Watch them merge one by one
```

## 📋 For Other Branches

You can also enable merge queue for `develop` and `staging`:

### Develop Branch Settings

```yaml
Branch: develop

Merge Queue:
✅ Require merge queue
   Build concurrency: 5 (allow more parallelism)
   Min entries: 1
   Max entries: 10
   Timeout: 30 minutes
```

### Staging Branch Settings

```yaml
Branch: staging

Merge Queue:
✅ Require merge queue
   Build concurrency: 3
   Min entries: 1
   Max entries: 5
   Timeout: 45 minutes
```

## 🎨 Using the Merge Queue

### As a Contributor

1. Create your PR as normal
2. Wait for reviews and checks
3. Once approved, click **"Merge when ready"** (not "Merge")
4. PR automatically enters the queue
5. Wait for GitHub to merge it
6. Get notification when merged

### As a Maintainer

1. Review PRs as normal
2. Approve when ready
3. Contributors can merge their own PRs
4. Queue handles the rest automatically
5. Monitor queue status in "Commits" section

### Merge Queue UI

After enabling, you'll see:
- **"Merge when ready"** button (replaces regular merge)
- **Queue position** indicator
- **Estimated time** to merge
- **Queue status** in branch view

## ⚙️ Advanced Configuration

### Customize Merge Methods

You can allow multiple merge methods:

```
Merge Queue Method: Squash and merge

Also allow for PRs:
✅ Merge commit
✅ Squash merge
✅ Rebase merge
```

### Set Up Auto-Merge

Contributors can enable auto-merge:

```bash
# On PR page
1. Click "Enable auto-merge"
2. Select "Squash and merge"
3. PR will auto-merge when ready
```

### Configure Timeouts

```yaml
# For fast CI (<5 min)
Merge timeout: 15 minutes

# For medium CI (5-15 min)  
Merge timeout: 30 minutes

# For slow CI (15-30 min)
Merge timeout: 60 minutes
```

## 🐛 Troubleshooting

### Issue: PR Not Entering Queue

**Cause**: Required checks not selected
**Fix**: Add all required checks in branch protection

### Issue: Queue Taking Too Long

**Cause**: CI is slow
**Fix**: 
- Increase timeout
- Optimize CI pipeline
- Increase build concurrency

### Issue: PRs Failing in Queue

**Cause**: Integration conflicts
**Fix**:
- Author needs to rebase on main
- Fix conflicts
- Re-enter queue

### Issue: Can't Find Status Checks

**Cause**: Checks haven't run yet
**Fix**:
- Make a test PR first
- Wait for checks to complete
- Then they'll appear in the list

## 📊 Monitoring

### View Queue Status

1. Go to repository
2. Click on **Code** tab
3. Look for "Merge queue for main" section
4. See all PRs in queue

### Check Individual PR

1. Go to PR page
2. Scroll to bottom
3. See queue position and status
4. View check results

## 🎯 Best Practices

1. **Start with main only** - Enable for production first
2. **Monitor initially** - Watch first few merges
3. **Adjust concurrency** - Based on CI speed
4. **Communicate** - Tell team about new process
5. **Document** - Link to this guide in README

## 📚 Additional Resources

- [GitHub Docs: Merge Queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [GitHub Blog: Merge Queue](https://github.blog/2023-02-08-merge-queue-available-for-all-public-repositories/)

## ✅ Checklist

Before you start:
- [x] Workflows updated with `merge_group` trigger
- [ ] Branch protection configured for `main`
- [ ] Required status checks selected
- [ ] Merge queue enabled with recommended settings
- [ ] Team notified about new process
- [ ] Test PR created and merged successfully

## 🎉 You're Ready!

Once you complete the GitHub settings above, your merge queue will be active and ready to use!

**Remember**: Click "Merge when ready" instead of "Merge" to use the queue.

---

**Questions?** See `docs/development/MERGE_QUEUE_GUIDE.md` for more details.
