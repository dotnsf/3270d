#!/bin/bash
# 3270d Setup Script

set -e

echo "========================================="
echo "3270d - TN3270 Server Setup"
echo "========================================="
echo ""

# Node.js繝舌・繧ｸ繝ｧ繝ｳ繝√ぉ繝・け
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
if [ "$NODE_VERSION" = "not installed" ]; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js v18.0.0 or higher"
    exit 1
fi

echo "Node.js version: $NODE_VERSION"
echo ""

# 萓晏ｭ倥ヱ繝・こ繝ｼ繧ｸ縺ｮ繧､繝ｳ繧ｹ繝医・繝ｫ
echo "Installing dependencies..."
npm install
echo ""

# 繝ｭ繧ｰ繝・ぅ繝ｬ繧ｯ繝医Μ縺ｮ菴懈・
echo "Creating log directory..."
LOG_DIR="/var/log/3270d"
if [ ! -d "$LOG_DIR" ]; then
    sudo mkdir -p "$LOG_DIR"
    sudo chown $USER:$USER "$LOG_DIR"
    echo "Log directory created: $LOG_DIR"
else
    echo "Log directory already exists: $LOG_DIR"
fi
echo ""

# 迺ｰ蠅・､画焚繝輔ぃ繧､繝ｫ縺ｮ菴懈・
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo ".env file created"
else
    echo ".env file already exists"
fi
echo ""

# PAM險ｭ螳夲ｼ医が繝励す繝ｧ繝ｳ・・
echo "PAM configuration (optional)..."
echo "To enable PAM authentication, run:"
echo "  sudo ./scripts/setup-pam.sh"
echo ""

echo "========================================="
echo "Setup completed successfully!"
echo "========================================="
echo ""
echo "To start the server:"
echo "  npm start          # Production mode"
echo "  npm run dev        # Development mode"
echo ""
echo "To run tests:"
echo "  npm test"
echo ""
echo "Default port: 23 (requires root or CAP_NET_BIND_SERVICE)"
echo "To use a different port, edit .env file"
echo ""

