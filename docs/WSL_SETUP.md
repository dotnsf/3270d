# WSL (Windows Subsystem for Linux) セットアップガイド

## 概要

このドキュメントでは、WSL環境で3270dを実行するための手順を説明します。

## 問題と解決策

### PAM認証モジュールのビルドエラー

WSL環境では、`authenticate-pam`パッケージのビルドに失敗する場合があります。これは、WSLのg++コンパイラが古く、C++20をサポートしていないためです。

**エラーメッセージ例:**
```
g++: error: unrecognized command line option '-std=gnu++20'
```

**解決策:**

3270dは、PAM認証をオプショナル依存関係として扱うように設計されています。PAMモジュールがインストールできない場合でも、開発モードで動作します。

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