# GitHub Repository Setup Guide

Complete step-by-step guide to create a GitHub repository and push your Secrets Portal code.

---

## 🎯 Step 1: Create GitHub Repository

### Option A: Using GitHub Website (Easiest)

1. Go to **https://github.com**
2. Click the **"+"** icon in top right
3. Click **"New repository"**
4. Fill in:
   - **Repository name**: `secrets-portal` (or any name you prefer)
   - **Description**: `AWS Secrets Manager Portal`
   - **Visibility**: Choose **Private** (recommended) or Public
   - **DO NOT** check "Initialize with README" (we already have code)
   - **DO NOT** add .gitignore or license (we'll add our own)
5. Click **"Create repository"**
6. **Copy the repository URL** shown (looks like: `https://github.com/YOUR_USERNAME/secrets-portal.git`)

### Option B: Using GitHub CLI

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Or download from: https://cli.github.com/

# Login to GitHub
gh auth login

# Create repository
gh repo create secrets-portal --private --source=. --remote=origin

# This creates the repo and sets up the remote automatically!
```

---

## 🎯 Step 2: Prepare Your Local Code

### Create .gitignore file

```bash
cat > .gitignore <<'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build output
dist/
build/
.next/
out/

# Environment variables (NEVER commit these!)
.env
.env.local
.env.development
.env.production
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
.DS_Store?
._*
.Spotlight-V100
.Trashes

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Testing
coverage/
.nyc_output/

# Temporary files
*.tmp
*.temp
.cache/

# AWS
.aws-sam/
samconfig.toml

# Deployment info (contains sensitive data)
amplify-deployment-info.txt
EOF
```

### Verify amplify.yml exists

```bash
# Check if amplify.yml exists
ls -la amplify.yml

# If it doesn't exist, it should have been created earlier
# The file should be in your project root
```

---

## 🎯 Step 3: Initialize Git and Push to GitHub

### If you used GitHub Website (Option A):

```bash
# 1. Initialize git (if not already initialized)
git init

# 2. Add all files
git add .

# 3. Check what will be committed (optional but recommended)
git status

# 4. Commit
git commit -m "Initial commit: Secrets Portal for AWS Amplify deployment"

# 5. Rename branch to main (if needed)
git branch -M main

# 6. Add GitHub as remote (replace with YOUR repository URL)
git remote add origin https://github.com/YOUR_USERNAME/secrets-portal.git

# 7. Push to GitHub
git push -u origin main
```

### If you used GitHub CLI (Option B):

```bash
# Git is already initialized and remote is set up!
# Just add, commit, and push:

git add .
git commit -m "Initial commit: Secrets Portal for AWS Amplify deployment"
git push -u origin main
```

---

## 🎯 Step 4: Verify Upload

### Check on GitHub Website

1. Go to your repository: `https://github.com/YOUR_USERNAME/secrets-portal`
2. You should see:
   - ✅ `amplify.yml` file
   - ✅ `packages/` folder
   - ✅ `.gitignore` file
   - ✅ Other project files

### Check from Command Line

```bash
# View your remote repository
git remote -v

# Should show:
# origin  https://github.com/YOUR_USERNAME/secrets-portal.git (fetch)
# origin  https://github.com/YOUR_USERNAME/secrets-portal.git (push)

# Check current branch
git branch

# Should show:
# * main
```

---

## 🎯 Step 5: Get Repository URL for Amplify

Your repository URL will be one of these formats:

**HTTPS** (recommended for Amplify):
```
https://github.com/YOUR_USERNAME/secrets-portal.git
```

**SSH** (if you prefer):
```
git@github.com:YOUR_USERNAME/secrets-portal.git
```

**Copy this URL** - you'll need it for the Amplify deployment script!

---

## ✅ Verification Checklist

Before proceeding to Amplify deployment:

- [ ] GitHub repository created
- [ ] `.gitignore` file created (excludes node_modules, .env)
- [ ] `amplify.yml` exists in root directory
- [ ] Code pushed to GitHub successfully
- [ ] Can see files on GitHub website
- [ ] Repository URL copied

---

## 🚀 Next Step: Deploy to Amplify

Now that your code is on GitHub, run the deployment script:

```bash
# Make script executable
chmod +x deploy-amplify.sh

# Run deployment
./deploy-amplify.sh
```

When prompted, enter your GitHub repository URL:
```
https://github.com/YOUR_USERNAME/secrets-portal.git
```

---

## 🔄 Future Updates

After initial setup, updating is easy:

```bash
# Make changes to your code
# ...

# Add changes
git add .

# Commit
git commit -m "Description of changes"

# Push to GitHub
git push origin main

# Amplify automatically detects and deploys! 🎉
```

---

## 🆘 Troubleshooting

### Issue: "fatal: not a git repository"

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit"
```

### Issue: "remote origin already exists"

```bash
# Remove existing remote
git remote remove origin

# Add correct remote
git remote add origin https://github.com/YOUR_USERNAME/secrets-portal.git
```

### Issue: "Permission denied (publickey)"

You're using SSH but don't have SSH keys set up. Either:

**Option 1**: Use HTTPS instead
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/secrets-portal.git
```

**Option 2**: Set up SSH keys
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: https://github.com/settings/keys
```

### Issue: "failed to push some refs"

```bash
# Pull first (if repo has files)
git pull origin main --allow-unrelated-histories

# Then push
git push origin main
```

### Issue: Files not showing on GitHub

```bash
# Check what was committed
git log --oneline

# Check what's in the commit
git show HEAD

# If files are missing, add them
git add .
git commit -m "Add missing files"
git push origin main
```

---

## 📝 Important Notes

### What Gets Pushed to GitHub:

✅ Source code (packages/frontend, packages/backend)
✅ Configuration files (amplify.yml, package.json)
✅ Documentation files (.md files)
✅ Build configurations (vite.config.ts, tsconfig.json)

### What Does NOT Get Pushed:

❌ `node_modules/` - Too large, installed during build
❌ `.env` files - Contains secrets
❌ `dist/` or `build/` - Build output
❌ AWS credentials - Security risk
❌ `amplify-deployment-info.txt` - Contains sensitive deployment info

---

## 🎉 Success!

Once you see your code on GitHub, you're ready to deploy to Amplify!

**Your repository URL**:
```
https://github.com/YOUR_USERNAME/secrets-portal.git
```

**Next command**:
```bash
./deploy-amplify.sh
```

The script will connect to your GitHub repo and deploy automatically! 🚀

