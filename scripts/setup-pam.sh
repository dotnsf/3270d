#!/bin/bash
#
# PAM設定スクリプト
# 3270dサービス用のPAM設定ファイルを作成します
#
# 使用方法:
#   sudo ./scripts/setup-pam.sh
#

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 3270d PAM設定スクリプト ===${NC}"
echo ""

# root権限チェック
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}エラー: このスクリプトはroot権限で実行する必要があります${NC}"
  echo "使用方法: sudo $0"
  exit 1
fi

# PAMディレクトリの確認
PAM_DIR="/etc/pam.d"
if [ ! -d "$PAM_DIR" ]; then
  echo -e "${RED}エラー: PAMディレクトリが見つかりません: $PAM_DIR${NC}"
  exit 1
fi

# PAM設定ファイルのパス
PAM_CONFIG="$PAM_DIR/3270d"

echo "PAM設定ファイルを作成します: $PAM_CONFIG"
echo ""

# 既存の設定ファイルをバックアップ
if [ -f "$PAM_CONFIG" ]; then
  BACKUP="$PAM_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
  echo -e "${YELLOW}既存の設定ファイルをバックアップします: $BACKUP${NC}"
  cp "$PAM_CONFIG" "$BACKUP"
fi

# PAM設定ファイルを作成
cat > "$PAM_CONFIG" << 'EOF'
#%PAM-1.0
# 3270d - TN3270 Server for Linux Shell Access
# PAM configuration file

# 認証 (Authentication)
# システムの標準認証を使用
auth       required     pam_unix.so
auth       required     pam_env.so

# アカウント管理 (Account Management)
# アカウントの有効性をチェック
account    required     pam_unix.so
account    required     pam_permit.so

# パスワード管理 (Password Management)
# パスワード変更は許可しない（読み取り専用）
password   required     pam_deny.so

# セッション管理 (Session Management)
# セッション開始時の環境設定
session    required     pam_unix.so
session    required     pam_limits.so
session    optional     pam_systemd.so
EOF

# パーミッション設定
chmod 644 "$PAM_CONFIG"

echo -e "${GREEN}✓ PAM設定ファイルを作成しました${NC}"
echo ""

# 設定内容を表示
echo "作成された設定内容:"
echo "----------------------------------------"
cat "$PAM_CONFIG"
echo "----------------------------------------"
echo ""

# PAM開発ライブラリのチェック
echo "PAM開発ライブラリの確認..."
if dpkg -l | grep -q libpam0g-dev; then
  echo -e "${GREEN}✓ libpam0g-dev はインストール済みです${NC}"
else
  echo -e "${YELLOW}! libpam0g-dev がインストールされていません${NC}"
  echo ""
  read -p "今すぐインストールしますか? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    apt-get update
    apt-get install -y libpam0g-dev
    echo -e "${GREEN}✓ libpam0g-dev をインストールしました${NC}"
  else
    echo -e "${YELLOW}後で手動でインストールしてください: sudo apt-get install libpam0g-dev${NC}"
  fi
fi

echo ""
echo -e "${GREEN}=== PAM設定完了 ===${NC}"
echo ""
echo "次のステップ:"
echo "1. authenticate-pamモジュールをインストール:"
echo "   cd /path/to/3270d"
echo "   npm install"
echo ""
echo "2. 本番モードでサーバーを起動:"
echo "   NODE_ENV=production npm start"
echo ""
echo "注意事項:"
echo "- PAM認証を使用するには、サーバーを実行するユーザーに適切な権限が必要です"
echo "- 開発環境では NODE_ENV=development で起動すると、PAM認証をスキップできます"
echo ""
