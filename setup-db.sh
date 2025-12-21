#!/bin/bash

# Database Setup Script for Ayurlahi Backend
# This script sets up PostgreSQL database for development

set -e

echo "🚀 Starting Database Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if PostgreSQL is installed
echo "📋 Step 1: Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed.${NC}"
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql@14"
    echo "  Linux: sudo apt-get install postgresql"
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL is installed${NC}"
echo ""

# Step 2: Check if PostgreSQL is running
echo "📋 Step 2: Checking if PostgreSQL is running..."
if pg_isready -q; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL is not running${NC}"
    echo "Starting PostgreSQL..."
    
    # Try to start PostgreSQL (macOS with Homebrew)
    if command -v brew &> /dev/null; then
        echo "Attempting to start PostgreSQL via Homebrew..."
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
            echo -e "${RED}❌ Could not start PostgreSQL automatically${NC}"
            echo "Please start PostgreSQL manually:"
            echo "  brew services start postgresql@14"
            echo "  OR"
            echo "  brew services start postgresql"
            exit 1
        }
        echo "Waiting for PostgreSQL to start..."
        sleep 3
    else
        echo -e "${RED}❌ Please start PostgreSQL manually${NC}"
        echo "  macOS: brew services start postgresql@14"
        echo "  Linux: sudo systemctl start postgresql"
        exit 1
    fi
    
    if pg_isready -q; then
        echo -e "${GREEN}✅ PostgreSQL is now running${NC}"
    else
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
fi
echo ""

# Step 3: Create PostgreSQL user
echo "📋 Step 3: Setting up PostgreSQL user..."
if psql -U postgres -c "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL user 'postgres' exists and is accessible${NC}"
else
    echo "Creating PostgreSQL user 'postgres'..."
    if createuser -s postgres 2>/dev/null; then
        echo -e "${GREEN}✅ Created PostgreSQL user 'postgres'${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not create 'postgres' user automatically${NC}"
        echo "Trying with current user: $(whoami)"
        USERNAME=$(whoami)
        echo "You can use your username in .env: DB_USERNAME=$USERNAME"
    fi
fi
echo ""

# Step 4: Create database
echo "📋 Step 4: Creating database 'ayurlahi'..."
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw ayurlahi 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Database 'ayurlahi' already exists${NC}"
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        dropdb -U postgres ayurlahi 2>/dev/null || dropdb ayurlahi 2>/dev/null
        echo "Creating new database..."
        createdb -U postgres ayurlahi 2>/dev/null || createdb ayurlahi 2>/dev/null
        echo -e "${GREEN}✅ Database 'ayurlahi' created${NC}"
    else
        echo -e "${GREEN}✅ Using existing database 'ayurlahi'${NC}"
    fi
else
    if createdb -U postgres ayurlahi 2>/dev/null || createdb ayurlahi 2>/dev/null; then
        echo -e "${GREEN}✅ Database 'ayurlahi' created${NC}"
    else
        echo -e "${RED}❌ Failed to create database${NC}"
        echo "Trying with current user..."
        createdb ayurlahi || {
            echo -e "${RED}❌ Could not create database${NC}"
            echo "Please create it manually:"
            echo "  createdb ayurlahi"
            exit 1
        }
        echo -e "${GREEN}✅ Database 'ayurlahi' created${NC}"
    fi
fi
echo ""

# Step 5: Verify connection
echo "📋 Step 5: Verifying database connection..."
if psql -U postgres -d ayurlahi -c "SELECT version();" &> /dev/null || psql -d ayurlahi -c "SELECT version();" &> /dev/null; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify connection with 'postgres' user${NC}"
    echo "Trying with current user..."
    if psql -d ayurlahi -c "SELECT version();" &> /dev/null; then
        echo -e "${GREEN}✅ Database connection successful with user '$(whoami)'${NC}"
        echo "Update your .env: DB_USERNAME=$(whoami)"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        exit 1
    fi
fi
echo ""

# Step 6: Check .env file
echo "📋 Step 6: Checking .env file..."
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    if grep -q "DB_NAME=ayurlahi" .env; then
        echo -e "${GREEN}✅ Database name is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Please add DB_NAME=ayurlahi to your .env file${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    if [ -f .env.example ]; then
        echo "Copying .env.example to .env..."
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file from .env.example${NC}"
        echo "Please update .env with your database credentials"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        echo "Please create .env file manually"
    fi
fi
echo ""

echo -e "${GREEN}🎉 Database setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update .env file with your database credentials"
echo "2. Start your application: npm run start:dev"
echo "3. TypeORM will automatically create all tables"
echo ""





