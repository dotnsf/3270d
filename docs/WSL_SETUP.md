# WSL (Windows Subsystem for Linux) セットアップガイド

## 概要

このドキュメントでは、WSL環境で3270dを実行するための手順を説明します。

## 重要: Node.jsのバージョンについて

**Node.js v24は新しすぎて、WSLの古いg++コンパイラと互換性がありません。**

### 推奨バージョン

- **Node.js v18.x** (LTS) - 推奨
- **Node.js v20.x** (LTS) - 動作確認済み

### 現在のバージョン確認

```bash
node --version
```

`v24.x.x`と表示される場合は、Node.jsをダウングレードする必要があります。

## Node.jsのダウングレード手順

### 方法1: nvmを使用（推奨）

```bash
# nvmをインストール（未インストールの場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# シェルを再起動
source ~/.bashrc

# Node.js 18 LTSをインストール
nvm install 18

# Node.js 18を使用
nvm use 18

# デフォルトに設定
nvm alias default 18

# バージョン確認
node --version  # v18.x.x と表示されるはず
```

### 方法2: 直接インストール

```bash
# 既存のNode.jsを削除
sudo apt-get remove nodejs
sudo apt-get purge nodejs
sudo apt-get autoremove

# Node.js 18をインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version  # v18.x.x と表示されるはず
```

## 問題と解決策

### ネイティブモジュールのビルドエラー

WSL環境では、`node-pty`や`authenticate-pam`などのネイティブモジュールのビルドに失敗する場合があります。

**エラーメッセージ例:**
```
g++: error: unrecognized command line option '-std=gnu++20'
```

**原因:**
- WSLのg++コンパイラが古く、C++20をサポートしていない
- Node.js v24が新しすぎて、古いコンパイラと互換性がない

**解決策:**

1. **Node.jsをv18にダウングレード**（上記参照）
2. **g++を更新**（オプション）

```bash
# g++のバージョン確認
g++ --version

# g++-10以上が必要
sudo apt-get update
sudo apt-get install -y g++-10

# デフォルトのg++を更新
sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-10 100
```

## セットアップ手順

### 1. 基本的なインストール

```bash
cd 3270d

# 依存パッケージをインストール（PAMモジュールのエラーは無視）
npm install --no-optional

# または、PAMモジュールを含めてインストール（エラーが出ても続行）
npm install
```

### 2. 開発モードでの実行

PAM認証が利用できない場合、開発モードで実行します：

```bash
# 環境変数を設定
export NODE_ENV=development

# サーバーを起動
npm start
```

開発モードでは、PAM認証の代わりにフォールバック認証が使用されます（パスワード検証なし）。

### 3. 環境変数の設定

`.env`ファイルを作成：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```bash
# 開発モード
NODE_ENV=development

# サーバー設定
PORT=23000
HOST=0.0.0.0
MAX_CONNECTIONS=2

# 認証設定（開発モードでは簡易認証）
AUTH_ENABLED=true
AUTH_MAX_RETRIES=3

# ログ設定
LOG_LEVEL=debug
```

## テストの実行

### 基本的なテスト

```bash
# すべてのテストを実行
npm test

# 特定のテストのみ実行
npm test -- test/unit/charset/japanese-handler.test.js

# カバレッジレポート生成
npm run test:coverage
```

### テスト結果の出力

```bash
# テスト結果をファイルに出力
npm run test:report

# 結果を確認
cat test-results/TEST-RESULTS.txt
```

## PAM認証を有効にする（オプション）

本番環境でPAM認証を使用する場合は、以下の手順でg++を更新します：

### Ubuntu 20.04の場合

```bash
# g++のバージョンを確認
g++ --version

# g++-10以上が必要
sudo apt-get update
sudo apt-get install -y g++-10

# デフォルトのg++を更新
sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-10 100

# PAM開発ライブラリをインストール
sudo apt-get install -y libpam0g-dev

# 再度インストール
npm install
```

### Ubuntu 22.04以降の場合

```bash
# 必要なパッケージをインストール
sudo apt-get update
sudo apt-get install -y build-essential libpam0g-dev

# インストール
npm install
```

## トラブルシューティング

### エラー: `node-gyp rebuild` failed

**原因**: ネイティブモジュールのビルドに必要なツールが不足しています。

**解決方法**:
```bash
# ビルドツールをインストール
sudo apt-get install -y build-essential python3

# node-gypを更新
npm install -g node-gyp

# 再度インストール
npm install
```

### エラー: `Cannot find module 'authenticate-pam'`

**原因**: PAMモジュールのインストールに失敗しています。

**解決方法**:
```bash
# 開発モードで実行
export NODE_ENV=development
npm start
```

開発モードでは、PAMモジュールがなくても動作します。

### エラー: `EACCES: permission denied`

**原因**: ポート23000へのアクセス権限がありません。

**解決方法**:
```bash
# 別のポートを使用
PORT=8023 npm start

### エラー: `g++: error: unrecognized command line option '-std=gnu++20'`

**原因**: Node.js v24が新しすぎて、WSLの古いg++コンパイラと互換性がありません。

**解決方法**:
```bash
# Node.jsをv18にダウングレード（推奨）
nvm install 18
nvm use 18
nvm alias default 18

# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

### npm installが非常に遅い

**原因**: Windowsファイルシステム（/mnt/c/）上でnpm installを実行すると非常に遅くなります。

**解決方法**:
```bash
# WSLのネイティブファイルシステムにプロジェクトを移動
cd ~
git clone <repository-url>
cd 3270d
npm install
```

### x3270/c3270で接続できない

**確認事項**:

1. サーバーが起動しているか確認
```bash
ps aux | grep node
```

2. ポートがリッスンしているか確認
```bash
netstat -tuln | grep 23000
```

3. ファイアウォールの確認
```bash
sudo ufw status
```

4. 接続テスト
```bash
telnet localhost 23000
```

## まとめ

WSL環境で3270dを実行する際の重要なポイント：

1. **Node.js v18を使用する**（v24は新しすぎる）
2. **開発モードで実行する**（PAM認証は不要）
3. **WSLのネイティブファイルシステムを使用する**（/mnt/c/は避ける）
4. **カスタムポートを使用する**（23000がブロックされている場合）

これらの手順に従えば、WSL環境でも3270dを問題なく実行できます。
```

### WSLでのPTY動作確認

```bash
# PTYが正しく動作するか確認
node -e "const pty = require('node-pty'); console.log('PTY OK');"
```

## 本番環境への移行

WSLで開発した後、本番環境（ネイティブLinux）に移行する場合：

### 1. コードを本番サーバーにコピー

```bash
# WSLから本番サーバーへ
scp -r 3270d/ user@production-server:/path/to/
```

### 2. 本番サーバーでセットアップ

```bash
# 本番サーバーで実行
cd /path/to/3270d

# 依存パッケージをインストール（PAM含む）
npm install

# 環境変数を設定
cp .env.example .env
vi .env  # NODE_ENV=production に変更

# サーバーを起動
npm start
```

## 開発モードの制限事項

開発モード（`NODE_ENV=development`）では、以下の制限があります：

1. **PAM認証が無効**: パスワード検証が行われません
2. **セキュリティ警告**: 本番環境では使用しないでください
3. **ログレベル**: デバッグログが出力されます

## 推奨環境

### 開発環境（WSL）
- テストとデバッグ
- コード開発
- 機能確認

### 本番環境（ネイティブLinux）
- Ubuntu 20.04以上
- PAM認証有効
- セキュリティ設定完備

## 参考情報

### WSLのバージョン確認

```bash
wsl --version
```

### Node.jsのバージョン確認

```bash
node --version  # v18.0.0以上推奨
npm --version
```

### システム情報

```bash
uname -a
lsb_release -a
```

## よくある質問

### Q: WSLで本番運用できますか？

A: 推奨しません。WSLは開発環境として使用し、本番環境にはネイティブLinuxを使用してください。

### Q: PAM認証なしでテストできますか？

A: はい。開発モードでは、PAM認証なしでテストできます。

### Q: WSLとネイティブLinuxで動作が異なりますか？

A: 基本的な機能は同じですが、PAM認証やPTYの動作に若干の違いがある場合があります。

### Q: g++を更新せずに使用できますか？

A: はい。`npm install --no-optional`でPAMモジュールをスキップし、開発モードで実行してください。

## サポート

問題が解決しない場合は、以下の情報を含めて報告してください：

```bash
# システム情報を収集
cat /etc/os-release
node --version
npm --version
g++ --version
wsl --version

# エラーログ
cat ~/.npm/_logs/*-debug-0.log