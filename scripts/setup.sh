#!/bin/bash
# 3270d Setup Script

set -e

echo "========================================="
echo "3270d - TN3270 Server Setup"
echo "========================================="
echo ""

# Node.jsバージョンチェック
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
if [ "$NODE_VERSION" = "not installed" ]; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js v18.0.0 or higher"
    exit 1
fi

echo "Node.js version: $NODE_VERSION"
echo ""

# 依存パッケージのインストール
echo "Installing dependencies..."
npm install
echo ""

# ログディレクトリの作成
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

# 環境変数ファイルの作成
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo ".env file created"
else
    echo ".env file already exists"
fi
echo ""

# PAM設定（オプション）
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

# Made with Bob
