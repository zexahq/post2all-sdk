#!/bin/bash

# Quick local testing script for post2all CLI package

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    post2all CLI: Local Testing Script                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Build
echo "📦 Step 1: Building CLI package..."
pnpm build > /dev/null 2>&1
echo "✓ Build complete"
echo ""

# Step 2: Link
echo "🔗 Step 2: Linking package locally..."
POST2ALL_API_URL=http://127.0.0.1:3000/api/v1 pnpm link --global > /dev/null 2>&1
echo "✓ Package linked globally"
echo ""

# Step 3: Verify
echo "✅ Step 3: Verifying installation..."
if command -v post2all &> /dev/null; then
    echo "✓ post2all command found"
else
    echo "✗ post2all command not found (may need sudo)"
    exit 1
fi
echo ""

# Step 4: Test help
echo "📖 Step 4: Testing help command..."
post2all --help > /dev/null 2>&1
echo "✓ Help command works"
echo ""

# Step 5: Show next steps
echo "════════════════════════════════════════════════════════════"
echo ""
echo "✅ Local testing setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Set your API key:"
echo "     \$ export POST2ALL_API_KEY=your_api_key"
echo ""
echo "  2. (Already using local API at http://127.0.0.1:3000/api/v1)"
echo ""
echo "  3. Test authentication:"
echo "     \$ post2all config whoami"
echo ""
echo "  4. List accounts:"
echo "     \$ post2all accounts"
echo ""
echo "  5. Create a test draft:"
echo "     \$ post2all post create --type text --content 'Hello' --delivery draft"
echo ""
echo "  6. List posts:"
echo "     \$ post2all posts"
echo ""
echo "  7. When done, unlink:"
echo "     \$ pnpm unlink --global"
echo ""
echo "════════════════════════════════════════════════════════════"
