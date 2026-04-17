#!/bin/bash
# Render build script with diagnostic output
set -e

echo "=== Build Diagnostics ==="
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Memory: $(free -m 2>/dev/null || echo 'N/A')"
echo "Disk: $(df -h . 2>/dev/null || echo 'N/A')"
echo "DATABASE_URL: ${DATABASE_URL:-(not set)}"
echo ""

echo "=== Step 1: npm ci ==="
npm ci 2>&1
echo "npm ci exit code: $?"

echo ""
echo "=== Step 2: npm run build ==="
npm run build 2>&1
echo "npm run build exit code: $?"

echo ""
echo "=== Build Complete ==="
