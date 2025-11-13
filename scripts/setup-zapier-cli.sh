#!/bin/bash
#
# Zapier CLI Setup Script
# This script helps initialize a Zapier app using the Zapier Platform CLI
# as an alternative to the Platform UI approach
#
# Usage: ./scripts/setup-zapier-cli.sh [app-name]
#
# Prerequisites:
# - Node.js 18+ installed
# - npm or pnpm
# - Zapier account (will prompt for login)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="${1:-triggers-api}"
APP_DIR="zapier-$APP_NAME"
BASE_URL="${BASE_URL:-https://triggers-api.yourdomain.workers.dev}"

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    print_error "$1 is not installed"
    return 1
  fi
  print_success "$1 is installed"
  return 0
}

# Welcome
print_header "Zapier CLI Setup Script"
echo "This script will help you create a Zapier app using the Platform CLI"
echo "App Name: $APP_NAME"
echo "Directory: $APP_DIR"
echo ""

# Step 1: Check prerequisites
print_header "Step 1: Checking Prerequisites"

if ! check_command "node"; then
  print_error "Node.js is required. Install from https://nodejs.org"
  exit 1
fi

if ! check_command "npm"; then
  print_error "npm is required. Install Node.js from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  print_error "Node.js 18+ required. Current version: $(node -v)"
  exit 1
fi
print_success "Node.js version is compatible: $(node -v)"

# Step 2: Install Zapier CLI
print_header "Step 2: Installing Zapier CLI"

if ! command -v zapier &> /dev/null; then
  print_info "Installing zapier-platform-cli globally..."
  npm install -g zapier-platform-cli
  print_success "Zapier CLI installed"
else
  ZAPIER_VERSION=$(zapier --version | grep 'zapier-platform-cli' | cut -d'/' -f2)
  print_success "Zapier CLI already installed (v$ZAPIER_VERSION)"
fi

# Step 3: Login to Zapier
print_header "Step 3: Zapier Authentication"

print_info "Checking Zapier authentication..."
if zapier whoami &> /dev/null; then
  ZAPIER_USER=$(zapier whoami)
  print_success "Already logged in as: $ZAPIER_USER"
else
  print_info "Opening browser for Zapier login..."
  zapier login
  print_success "Logged in to Zapier"
fi

# Step 4: Initialize app
print_header "Step 4: Creating Zapier App"

if [ -d "$APP_DIR" ]; then
  print_warning "Directory $APP_DIR already exists"
  read -p "Do you want to remove it and start fresh? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$APP_DIR"
    print_success "Removed existing directory"
  else
    print_error "Aborted. Please choose a different app name."
    exit 1
  fi
fi

print_info "Initializing app from rest-hooks template..."
zapier init "$APP_DIR" --template=rest-hooks

cd "$APP_DIR"
print_success "App initialized in $APP_DIR"

# Step 5: Configure app
print_header "Step 5: Configuring App"

print_info "Updating package.json..."

# Update package.json with app details
cat > package.json <<EOF
{
  "name": "$APP_NAME",
  "version": "1.0.0",
  "description": "Real-time event notifications from TriggersAPI",
  "main": "index.js",
  "scripts": {
    "test": "zapier test",
    "validate": "zapier validate",
    "push": "zapier push",
    "promote": "zapier promote 1.0.0"
  },
  "zapier": {
    "title": "TriggersAPI",
    "description": "Real-time event notifications from TriggersAPI",
    "category": "Developer Tools",
    "platformVersion": "16.0.0"
  },
  "dependencies": {
    "zapier-platform-core": "16.0.0"
  },
  "devDependencies": {
    "zapier-platform-cli": "16.0.0"
  }
}
EOF

print_success "package.json updated"

# Install dependencies
print_info "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Step 6: Configure authentication
print_header "Step 6: Configuring Authentication"

print_info "Creating authentication config..."

cat > authentication.js <<'EOF'
// Authentication configuration for API Key (Bearer Token)
const testAuth = async (z, bundle) => {
  // Test authentication by calling /inbox endpoint
  const response = await z.request({
    method: 'GET',
    url: `${process.env.BASE_URL}/inbox`,
  });

  // If request succeeds (200 OK), authentication is valid
  if (response.status !== 200) {
    throw new Error('Authentication failed. Please check your API key.');
  }

  return response.data;
};

const addAuthToHeader = (request, z, bundle) => {
  // Add Bearer token to all requests
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      type: 'string',
      required: true,
      helpText: 'Enter your TriggersAPI Bearer token. You can find this in your TriggersAPI dashboard.',
      inputFormat: 'password',
    },
  ],
  test: testAuth,
  connectionLabel: (z, bundle) => {
    // Show last 4 characters of API key
    const apiKey = bundle.authData.api_key || '';
    const lastFour = apiKey.slice(-4);
    return `TriggersAPI (...${lastFour})`;
  },
  beforeRequest: [addAuthToHeader],
};
EOF

print_success "authentication.js created"

# Step 7: Configure REST Hook trigger
print_header "Step 7: Configuring REST Hook Trigger"

print_info "Creating trigger config..."

mkdir -p triggers

cat > triggers/event.js <<'EOF'
// REST Hook trigger for TriggersAPI events

// Subscribe to webhook
const subscribeHook = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: `${process.env.BASE_URL}/zapier/hook`,
    body: {
      url: bundle.targetUrl,
    },
  });

  return response.data;
};

// Unsubscribe from webhook
const unsubscribeHook = async (z, bundle) => {
  const response = await z.request({
    method: 'DELETE',
    url: `${process.env.BASE_URL}/zapier/hook`,
    body: {
      url: bundle.targetUrl,
    },
  });

  return response.data;
};

// Get sample events (for testing)
const getRecentEvents = async (z, bundle) => {
  const response = await z.request({
    method: 'GET',
    url: `${process.env.BASE_URL}/zapier/hook/sample`,
  });

  return response.data;
};

module.exports = {
  key: 'event',
  noun: 'Event',
  display: {
    label: 'Event Received',
    description: 'Triggers when a new event is received by TriggersAPI',
    important: true,
  },
  operation: {
    type: 'hook',

    // Webhook lifecycle methods
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getRecentEvents,
    performList: getRecentEvents,

    // Sample data for testing
    sample: {
      id: 'evt_12345abcde',
      event_id: 'evt_12345abcde',
      event_type: 'test_event',
      timestamp: '2025-11-12T14:30:00.000Z',
      payload: {
        message: 'Sample test event from TriggersAPI',
        source: 'zapier',
        test: true,
        user_id: 'user_sample_123',
      },
      metadata: {
        correlation_id: 'corr_abc123',
        source_ip: '192.0.2.1',
        user_agent: 'Zapier/1.0',
      },
      created_at: '2025-11-12T14:30:00.500Z',
    },

    // Output fields schema
    outputFields: [
      { key: 'id', label: 'Event ID', type: 'string', required: true },
      { key: 'event_id', label: 'Event ID (Alias)', type: 'string' },
      { key: 'event_type', label: 'Event Type', type: 'string' },
      { key: 'timestamp', label: 'Timestamp', type: 'string' },
      { key: 'payload', label: 'Payload', type: 'object' },
      { key: 'payload__event_type', label: 'Payload Event Type', type: 'string' },
      { key: 'payload__message', label: 'Payload Message', type: 'string' },
      { key: 'payload__user_id', label: 'Payload User ID', type: 'string' },
      { key: 'metadata', label: 'Metadata', type: 'object' },
      { key: 'metadata__correlation_id', label: 'Correlation ID', type: 'string' },
      { key: 'metadata__source_ip', label: 'Source IP', type: 'string' },
      { key: 'metadata__user_agent', label: 'User Agent', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'string' },
    ],
  },
};
EOF

print_success "triggers/event.js created"

# Step 8: Create main index.js
print_header "Step 8: Creating Main Index"

print_info "Creating index.js..."

cat > index.js <<'EOF'
const authentication = require('./authentication');
const eventTrigger = require('./triggers/event');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('./package.json').zapier.platformVersion,

  authentication: authentication,

  beforeRequest: authentication.beforeRequest,

  triggers: {
    [eventTrigger.key]: eventTrigger,
  },

  // No actions or searches for now
  actions: {},
  searches: {},
};
EOF

print_success "index.js created"

# Step 9: Create environment file
print_header "Step 9: Creating Environment File"

print_info "Creating .env file..."

cat > .env <<EOF
# TriggersAPI Configuration
BASE_URL=$BASE_URL

# For local testing, use ngrok or Cloudflare Tunnel:
# BASE_URL=https://abc123.ngrok-free.app

# For deployed Worker:
# BASE_URL=https://triggers-api.yourdomain.workers.dev
EOF

print_success ".env created"

cat > .env.example <<EOF
# TriggersAPI Configuration
BASE_URL=https://triggers-api.yourdomain.workers.dev
EOF

print_success ".env.example created"

# Step 10: Create README
print_header "Step 10: Creating Documentation"

print_info "Creating README..."

cat > README.md <<'EOF'
# TriggersAPI Zapier Integration

This is the Zapier Platform CLI app for TriggersAPI. It provides a REST Hook trigger that delivers real-time event notifications to Zapier workflows.

## Development

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your TriggersAPI BASE_URL
```

### Testing Locally

```bash
# Start local dev server
zapier dev

# In another terminal, test authentication
curl -X POST http://localhost:3000/test/triggers/event/perform \
  -H "Content-Type: application/json" \
  -d '{"authData": {"api_key": "sk_test_your_key"}}'
```

### Deployment

```bash
# Validate app
npm run validate

# Push to Zapier
npm run push

# Promote version
npm run promote
```

## Documentation

- [Zapier App Setup Guide](../docs/ZAPIER_APP_SETUP.md)
- [REST Hook Protocol](../docs/zapier-handshake-protocol.md)
- [Testing Guide](../docs/zapier-testing-guide.md)
EOF

print_success "README.md created"

# Step 11: Validate and test
print_header "Step 11: Validating App"

print_info "Running validation..."
if zapier validate; then
  print_success "App validation passed"
else
  print_warning "App validation failed. Review errors above."
fi

# Step 12: Final instructions
print_header "Setup Complete!"

echo ""
print_success "Zapier app created successfully!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Configure environment:"
echo "     cd $APP_DIR"
echo "     nano .env  # Set your BASE_URL"
echo ""
echo "  2. Test locally:"
echo "     zapier dev"
echo ""
echo "  3. Push to Zapier:"
echo "     zapier push"
echo ""
echo "  4. Test in Zapier Editor:"
echo "     - Go to https://zapier.com/app/editor"
echo "     - Create new Zap"
echo "     - Search for 'TriggersAPI'"
echo "     - Configure trigger"
echo ""
echo "  5. Promote to production:"
echo "     zapier promote 1.0.0"
echo ""
print_info "For more information, see README.md"
echo ""
print_info "Documentation: https://platform.zapier.com/docs"
echo ""
