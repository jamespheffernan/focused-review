#!/bin/bash

# Test script to verify Electron MCP setup
# This script tests if remote debugging is accessible

echo "🧪 Testing Electron MCP Setup"
echo "================================"
echo ""

# Check if port 9222 is accessible
echo "1. Checking if remote debugging port (9222) is accessible..."
if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
    echo "   ✅ Port 9222 is accessible"
    echo ""
    echo "   Version info:"
    curl -s http://localhost:9222/json/version | python3 -m json.tool 2>/dev/null || curl -s http://localhost:9222/json/version
    echo ""
else
    echo "   ❌ Port 9222 is not accessible"
    echo "   Make sure the Electron app is running with remote debugging enabled"
    echo "   Start it with: npm run electron:dev"
    exit 1
fi

# List available targets
echo "2. Listing available debugging targets..."
TARGETS=$(curl -s http://localhost:9222/json/list 2>/dev/null)
if [ $? -eq 0 ] && [ ! -z "$TARGETS" ]; then
    echo "   ✅ Found debugging targets:"
    echo "$TARGETS" | python3 -m json.tool 2>/dev/null || echo "$TARGETS"
    echo ""
    
    # Count targets
    TARGET_COUNT=$(echo "$TARGETS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "unknown")
    echo "   Found $TARGET_COUNT target(s)"
else
    echo "   ⚠️  No targets found or error accessing targets"
    echo ""
fi

echo ""
echo "✅ Remote debugging is working correctly!"
echo ""
echo "Next steps:"
echo "1. Start the MCP server: cd dev-tools/electron-mcp && npm run start"
echo "2. Connect your MCP client to the server"
echo "3. Use MCP resources to control the Electron app"

