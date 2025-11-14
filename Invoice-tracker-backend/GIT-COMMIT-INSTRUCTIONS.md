# Git Commit Instructions

## Overview

Your backend folder has been reorganized with:
- ✅ New complete EC2 deployment scripts
- ✅ Comprehensive deployment documentation
- ✅ Backend folder cleanup (80+ files moved to Archive/)

This needs to be committed to a new branch: `feature/complete-ec2-deployment`

---

## Step-by-Step Instructions

### Step 1: Verify Your Environment

Before starting, verify git is accessible from your terminal. Open a terminal and run:

```bash
git --version
```

If this fails, you may need to:
- Install Git from https://git-scm.com/download/win
- Restart your terminal after installation
- Or use GitHub Desktop's built-in terminal

### Step 2: Navigate to Project Root

```bash
cd "C:\Users\dwils\Claude-Projects\Invoice Tracker"
```

### Step 3: Check Current Status

```bash
git status
```

You should see many deleted and moved files. This is expected.

### Step 4: Create New Branch

```bash
git checkout -b feature/complete-ec2-deployment
```

If you get an error, try:
```bash
git branch feature/complete-ec2-deployment
git checkout feature/complete-ec2-deployment
```

### Step 5: Stage All Changes

```bash
git add -A
```

Or if that doesn't work:
```bash
git add .
```

### Step 6: Verify Changes Staged

```bash
git status
```

You should see files listed under "Changes to be committed:"

### Step 7: Commit Changes

Run this command (keeping the entire text as-is):

```bash
git commit -m "feat: reorganize backend folder and add complete EC2 deployment

## Folder Reorganization
- Move 80+ debug/test/utility scripts to Archive/ folder
- Keep only essential production files in root directory
- Improve project clarity and onboarding

## Deployment Improvements (Version 2.0)
- Add complete PostgreSQL schema with all 7 tables
- Add all 24 invoice columns with correct snake_case naming
- Add 17+ performance indexes and triggers
- Add comprehensive deployment documentation
- Add quick reference guide

## Files Moved to Archive/
Debug Scripts (15):
- check-*.js, debug-*.js
- analyze-query-patterns.js
- show-current-schema.js

Test Scripts (25):
- test-*.js (all test files)

Utility Scripts (20):
- fix-*.js, create-*.js, cleanup-*.js
- remove-*.js, reparse-*.js, reclassify-*.js
- recreate-*.js, export-*.js, add-*.js
- run-*.js

Legacy Setup Scripts (8):
- *.bat files (BACKUP-DATABASE.bat, START-*.bat, STOP-*.bat)
- *.ps1 files (STOP-ALL-SERVERS.ps1)
- start-invoice-tracker-postgres.bat
- stop-invoice-tracker-postgres.bat

Documentation (5):
- CADDY-*.md (Caddy setup guides)
- DEPLOYMENT-GUIDE.md (old guide)
- QUICK-DEPLOY.md

Data & Results:
- *.json files (invoice-type-changes.json, etc.)
- *.log files
- *.sql files (old schema exports)
- test-results.txt

Deprecated:
- invoices.db.DEPRECATED_SQLITE_DO_NOT_USE

## Files Retained in Root
Production Code:
- server-postgres.js
- db-postgres.js
- routes/
- middleware/
- utils/
- tests/

Configuration:
- package.json
- .env, .env.example
- .gitignore

Documentation:
- README.md
- 00-START-HERE.md
- DEPLOYMENT-COMPLETE-SCHEMA.md
- DEPLOYMENT-QUICK-REFERENCE.md
- REORGANIZATION-GUIDE.md

Storage:
- attachments/
- backups/
- invoice_pdfs/
- uploads/
- migrations/
- scripts/

## Summary
- Root files reduced from 100+ to ~20 essential files
- All 80+ utility/debug files preserved in Archive/
- Clean, professional project structure
- Ready for production deployment to AWS EC2"
```

### Step 8: Verify Commit

```bash
git log --oneline -3
```

You should see your new commit at the top.

### Step 9: Push to Remote

```bash
git push -u origin feature/complete-ec2-deployment
```

If this is your first push on this branch, use:
```bash
git push --set-upstream origin feature/complete-ec2-deployment
```

### Step 10: Create Pull Request

Go to GitHub and:
1. Navigate to https://github.com/dwilsoning/invoice-tracker
2. You should see a prompt to create a Pull Request
3. Click "Compare & Pull Request"
4. Add description (copy from commit message)
5. Click "Create Pull Request"

---

## Troubleshooting

### "git is not recognized"

**Solution 1: Use GitHub Desktop Terminal**
- Open GitHub Desktop
- Go to Repository > Open in Command Prompt
- Run commands from there

**Solution 2: Add Git to PATH**
- Git is usually at: `C:\Program Files\Git\bin\git.exe`
- Add this directory to your system PATH
- Restart terminal

**Solution 3: Use Full Path**
```bash
"C:\Program Files\Git\bin\git.exe" --version
"C:\Program Files\Git\bin\git.exe" status
"C:\Program Files\Git\bin\git.exe" add -A
```

### "fatal: not a git repository"

**Solution:**
Make sure you're in the correct directory:
```bash
cd "C:\Users\dwils\Claude-Projects\Invoice Tracker"
git status
```

### "Your branch is ahead of 'main'"

This is normal! You're on a new branch with changes ready to push.

### "Please tell me who you are"

Run these commands with your GitHub credentials:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## If Something Goes Wrong

### Undo Everything (Start Over)

```bash
# Go back to main branch
git checkout main

# Delete the new branch
git branch -D feature/complete-ec2-deployment

# Restore original files from Archive
# (Manual process - copy files back from Archive/)
```

### Check What's Being Committed

Before running the commit command:
```bash
git diff --cached --name-status
```

This shows all files being committed.

---

## What Gets Committed

### Moved (`.gitignore` may exclude these):
- 80+ files in Archive/ folder

### New Files:
- DEPLOYMENT-COMPLETE-SCHEMA.md
- DEPLOYMENT-QUICK-REFERENCE.md
- 00-START-HERE.md (updated)
- REORGANIZATION-GUIDE.md
- This file (optional)

### Modified:
- 00-START-HERE.md (added reorganization note)

---

## After Commit

Once successfully pushed:

1. ✅ Changes are on branch `feature/complete-ec2-deployment`
2. ✅ Ready to create Pull Request
3. ✅ After review, can merge to `main`
4. ✅ Ready for deployment to production

---

## Quick Command Reference

```bash
# Check status
git status

# Create branch
git checkout -b feature/complete-ec2-deployment

# Stage changes
git add -A

# Verify what's staged
git status

# Commit (use message from Step 7)
git commit -m "feat: reorganize backend folder..."

# View commits
git log --oneline

# Push to remote
git push -u origin feature/complete-ec2-deployment

# View branches
git branch -a

# Switch branches
git checkout main
git checkout feature/complete-ec2-deployment
```

---

## Contact & Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Verify git is installed: `git --version`
3. Check you're in correct directory: `pwd` or `Get-Location`
4. Review git status: `git status`

---

**Status**: ✅ Ready to Commit  
**Branch**: feature/complete-ec2-deployment  
**Date**: November 12, 2025
