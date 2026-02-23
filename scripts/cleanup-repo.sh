#!/bin/bash

# Repository Cleanup Script
# Removes tracked files that should be ignored

echo "🧹 Starting repository cleanup..."

# Remove sdk/node_modules from git tracking (but keep locally)
if [ -d "sdk/node_modules" ]; then
  echo "📦 Removing sdk/node_modules from git tracking..."
  git rm -r --cached sdk/node_modules
fi

# Remove database files from git tracking
echo "🗄️  Removing database files from git tracking..."
git rm --cached fourcast.db 2>/dev/null || true
git rm --cached fourcast.db-shm 2>/dev/null || true
git rm --cached fourcast.db-wal 2>/dev/null || true

# Remove .DS_Store files
echo "🍎 Removing .DS_Store files from git tracking..."
find . -name .DS_Store -print0 | xargs -0 git rm --cached 2>/dev/null || true

# Remove IDE config directories
echo "💻 Removing IDE config directories from git tracking..."
git rm -r --cached .qoder 2>/dev/null || true
git rm -r --cached .qodo 2>/dev/null || true
git rm -r --cached .trae 2>/dev/null || true
git rm -r --cached .zencoder 2>/dev/null || true
git rm -r --cached .zenflow 2>/dev/null || true

# Remove build artifacts
echo "🏗️  Removing build artifacts from git tracking..."
git rm --cached tsconfig.tsbuildinfo 2>/dev/null || true
git rm --cached next-env.d.ts 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit changes: git commit -m 'chore: cleanup gitignore and remove tracked files'"
echo "3. Push changes: git push"
echo ""
echo "Note: Files are removed from git tracking but remain on your local filesystem."
