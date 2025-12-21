#!/bin/bash

echo "🚀 Starting Redis Setup..."

# --- Step 1: Check Redis installation ---
echo -e "\n📋 Step 1: Checking Redis installation..."
if command -v redis-cli &> /dev/null; then
    echo -e "✅ Redis is installed"
else
    echo -e "⚠️  Redis is not installed. Installing Redis..."
    if brew install redis; then
        echo -e "✅ Redis installed successfully"
    else
        echo -e "❌ Failed to install Redis. Please install it manually: brew install redis"
        exit 1
    fi
fi

# --- Step 2: Check if Redis is running ---
echo -e "\n📋 Step 2: Checking if Redis is running..."
if redis-cli ping &> /dev/null; then
    echo -e "✅ Redis is already running"
else
    echo -e "⚠️  Redis is not running. Starting Redis..."
    if brew services start redis &> /dev/null; then
        echo -e "✅ Redis started via Homebrew"
        sleep 3 # Give it some time to start
    else
        echo -e "❌ Could not start Redis automatically"
        echo "Please start Redis manually:"
        echo "  brew services start redis"
        echo "  OR"
        echo "  redis-server"
        exit 1
    fi
fi

# --- Step 3: Verify Redis connection ---
echo -e "\n📋 Step 3: Verifying Redis connection..."
if redis-cli ping | grep -q "PONG"; then
    echo -e "✅ Redis is accessible and ready!"
    echo -e "   Response: $(redis-cli ping)"
else
    echo -e "❌ Redis connection test failed. Please check Redis logs."
    exit 1
fi

echo -e "\n🎉 Redis setup complete!"
echo "Redis is now running and ready for BullMQ background jobs."





