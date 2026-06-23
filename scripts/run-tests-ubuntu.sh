#!/bin/bash
################################################################################
# Ubuntu上でテストを実行するスクリプト
#
# このスクリプトは以下を実行します：
# 1. 依存パッケージのインストール確認
# 2. テストの実行
# 3. テスト結果の整形
# 4. 結果ファイルの生成
#
# 使用方法:
#   chmod +x scripts/run-tests-ubuntu.sh
#   ./scripts/run-tests-ubuntu.sh
#
# 出力ファイル:
#   test-results/TEST-RESULTS.txt - このファイルをBobに送信してください
################################################################################

set -e  # エラーで停止

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ヘッダー
echo "================================================================================"
echo "3270d - Ubuntu テスト実行スクリプト"
echo "================================================================================"
echo ""

# 現在のディレクトリを確認
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_info "プロジェクトディレクトリ: $PROJECT_DIR"
cd "$PROJECT_DIR"

# Node.jsのバージョン確認
log_info "Node.jsバージョンを確認しています..."
if ! command -v node &> /dev/null; then
    log_error "Node.jsがインストールされていません"
    log_info "以下のコマンドでインストールしてください:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
log_success "Node.js $NODE_VERSION"

# npmのバージョン確認
NPM_VERSION=$(npm --version)
log_success "npm $NPM_VERSION"

# 依存パッケージのインストール確認
log_info "依存パッケージを確認しています..."
if [ ! -d "node_modules" ]; then
    log_warning "node_modulesが見つかりません。依存パッケージをインストールします..."
    npm install
    log_success "依存パッケージのインストールが完了しました"
else
    log_success "依存パッケージは既にインストールされています"
fi

# test-resultsディレクトリを作成
log_info "test-resultsディレクトリを作成しています..."
mkdir -p test-results

# 古いテスト結果を削除
if [ -f "test-results/TEST-RESULTS.txt" ]; then
    log_info "古いテスト結果を削除しています..."
    rm -f test-results/TEST-RESULTS.txt
    rm -f test-results/test-report.json
    rm -f test-results/junit.xml
fi

# テストを実行
echo ""
log_info "テストを実行しています..."
echo "--------------------------------------------------------------------------------"

# テスト実行（エラーでも続行）
set +e
npm run test:report
TEST_EXIT_CODE=$?
set -e

echo "--------------------------------------------------------------------------------"
echo ""

# 結果を確認
if [ -f "test-results/TEST-RESULTS.txt" ]; then
    log_success "テスト結果ファイルが生成されました"
    echo ""
    
    # 結果ファイルの内容を表示
    log_info "テスト結果:"
    echo "================================================================================"
    cat test-results/TEST-RESULTS.txt
    echo "================================================================================"
    echo ""
    
    # ファイルパスを表示
    log_info "テスト結果ファイル:"
    echo "  $(pwd)/test-results/TEST-RESULTS.txt"
    echo ""
    
    # 次のステップを表示
    log_info "次のステップ:"
    echo "  1. test-results/TEST-RESULTS.txt の内容をコピーしてください"
    echo "  2. Bobに送信して、テスト結果を確認してもらってください"
    echo ""
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        log_success "すべてのテストが成功しました！"
        exit 0
    else
        log_warning "一部のテストが失敗しました。詳細は TEST-RESULTS.txt を確認してください。"
        exit 1
    fi
else
    log_error "テスト結果ファイルの生成に失敗しました"
    exit 1
fi

# Made with Bob
