#!/bin/bash

# GitHub Repository Setup Script
# This script helps you create a GitHub repository and push your code

set -e

echo "🚀 GitHub Repository Setup for Secrets Portal"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed${NC}"
    echo "Please install Git: https://git-scm.com/downloads"
    exit 1
fi

echo -e "${GREEN}✅ Git is installed${NC}"

# Check if GitHub CLI is installed
if command -v gh &> /dev/null; then
    echo -e "${GREEN}✅ GitHub CLI is installed${NC}"
    HAS_GH_CLI=true
else
    echo -e "${YELLOW}⚠️  GitHub CLI not installed (optional)${NC}"
    HAS_GH_CLI=false
fi

echo ""
echo -e "${BLUE}📝 Repository Configuration${NC}"
echo "================================"
echo ""

read -p "Enter repository name (default: secrets-portal): " REPO_NAME
REPO_NAME=${REPO_NAME:-secrets-portal}

read -p "Make repository private? (y/n, default: y): " IS_PRIVATE
IS_PRIVATE=${IS_PRIVATE:-y}

echo ""
echo -e "${BLUE}🔧 Setting up Git...${NC}"

# Initialize git if not already
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    echo -e "${GREEN}✅ Git initialized${NC}"
else
    echo -e "${GREEN}✅ Git already initialized${NC}"
fi

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "Creating .gitignore..."
    cat > .gitignore <<'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build output
dist/
build/
.next/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Deployment info
amplify-deployment-info.txt
EOF
    echo -e "${GREEN}✅ .gitignore created${NC}"
else
    echo -e "${GREEN}✅ .gitignore already exists${NC}"
fi

# Add all files
echo "Adding files to git..."
git add .

# Commit
echo "Creating initial commit..."
git commit -m "Initial commit: Secrets Portal for AWS Amplify deployment" || echo "Nothing to commit or already committed"

# Rename branch to main if needed
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Renaming branch to main..."
    git branch -M main
fi

echo -e "${GREEN}✅ Local git setup complete${NC}"
echo ""

# GitHub repository creation
if [ "$HAS_GH_CLI" = true ]; then
    echo -e "${BLUE}🌐 Creating GitHub repository with GitHub CLI...${NC}"
    
    # Check if logged in
    if gh auth status &> /dev/null; then
        echo -e "${GREEN}✅ Logged into GitHub${NC}"
        
        # Create repository
        if [ "$IS_PRIVATE" = "y" ]; then
            gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
        else
            gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
        fi
        
        REPO_URL=$(gh repo view --json url -q .url)
        
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}✅ Repository created and code pushed!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${BLUE}📊 Repository Details:${NC}"
        echo "  Name: $REPO_NAME"
        echo "  URL: $REPO_URL"
        echo "  Branch: main"
        echo "  Visibility: $([ "$IS_PRIVATE" = "y" ] && echo "Private" || echo "Public")"
        echo ""
        echo -e "${GREEN}🎉 Success! Your code is now on GitHub!${NC}"
        echo ""
        echo -e "${BLUE}📝 Next Steps:${NC}"
        echo "  1. Run the Amplify deployment script:"
        echo "     ./deploy-amplify.sh"
        echo ""
        echo "  2. When prompted, enter your repository URL:"
        echo "     ${REPO_URL}.git"
        echo ""
        
        # Save info
        cat > github-repo-info.txt <<EOF
GitHub Repository Information
==============================

Repository Name: $REPO_NAME
Repository URL: $REPO_URL
Git URL: ${REPO_URL}.git
Branch: main
Visibility: $([ "$IS_PRIVATE" = "y" ] && echo "Private" || echo "Public")

Created: $(date)

Next Steps:
-----------
1. Run: ./deploy-amplify.sh
2. Enter repository URL when prompted: ${REPO_URL}.git

To update code:
---------------
git add .
git commit -m "Your commit message"
git push origin main
EOF
        
        echo -e "${GREEN}✅ Repository info saved to: github-repo-info.txt${NC}"
        
    else
        echo -e "${RED}❌ Not logged into GitHub CLI${NC}"
        echo "Please run: gh auth login"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  GitHub CLI not available${NC}"
    echo ""
    echo -e "${BLUE}📝 Manual GitHub Setup Required${NC}"
    echo "================================"
    echo ""
    echo "Please follow these steps:"
    echo ""
    echo "1. Go to: https://github.com/new"
    echo ""
    echo "2. Fill in:"
    echo "   - Repository name: $REPO_NAME"
    echo "   - Visibility: $([ "$IS_PRIVATE" = "y" ] && echo "Private" || echo "Public")"
    echo "   - DO NOT initialize with README, .gitignore, or license"
    echo ""
    echo "3. Click 'Create repository'"
    echo ""
    echo "4. Copy the repository URL (looks like: https://github.com/USERNAME/$REPO_NAME.git)"
    echo ""
    read -p "Enter your GitHub repository URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}❌ No URL provided${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
    
    # Add remote
    git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
    
    # Push
    git push -u origin main
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Code pushed to GitHub!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}📊 Repository Details:${NC}"
    echo "  Name: $REPO_NAME"
    echo "  URL: $REPO_URL"
    echo "  Branch: main"
    echo ""
    echo -e "${GREEN}🎉 Success! Your code is now on GitHub!${NC}"
    echo ""
    echo -e "${BLUE}📝 Next Steps:${NC}"
    echo "  1. Run the Amplify deployment script:"
    echo "     ./deploy-amplify.sh"
    echo ""
    echo "  2. When prompted, enter your repository URL:"
    echo "     $REPO_URL"
    echo ""
    
    # Save info
    cat > github-repo-info.txt <<EOF
GitHub Repository Information
==============================

Repository Name: $REPO_NAME
Repository URL: $REPO_URL
Branch: main

Created: $(date)

Next Steps:
-----------
1. Run: ./deploy-amplify.sh
2. Enter repository URL when prompted: $REPO_URL

To update code:
---------------
git add .
git commit -m "Your commit message"
git push origin main
EOF
    
    echo -e "${GREEN}✅ Repository info saved to: github-repo-info.txt${NC}"
fi

echo ""
echo -e "${BLUE}🔗 Useful Git Commands:${NC}"
echo "  View status:        git status"
echo "  View remote:        git remote -v"
echo "  View commits:       git log --oneline"
echo "  Update code:        git add . && git commit -m 'message' && git push"
echo ""
