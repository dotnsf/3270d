# テスト実行ガイド

## 概要

このドキュメントでは、Ubuntu上で3270dのテストを実行し、結果をBobに報告する方法を説明します。

## 前提条件

### システム要件
- **OS**: Ubuntu 20.04以上
- **Node.js**: v18.0.0以上
- **npm**: 8.0.0以上

### Node.jsのインストール（未インストールの場合）

```bash
# Node.js 18.xをインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version  # v18.0.0以上
npm --version   # 8.0.0以上
```

## テスト実行手順

### 1. プロジェクトのセットアップ

```bash
# プロジェクトディレクトリに移動
cd /path/to/3270d

# 依存パッケージをインストール
npm install
```

### 2. テストの実行

#### 方法A: シェルスクリプトを使用（推奨）

```bash
# スクリプトに実行権限を付与
chmod +x scripts/run-tests-ubuntu.sh

# テストを実行
./scripts/run-tests-ubuntu.sh
```

このスクリプトは以下を自動的に実行します：
- 依存パッケージの確認
- テストの実行
- 結果の整形
- `test-results/TEST-RESULTS.txt` の生成

#### 方法B: npmコマンドを使用

```bash
# テストを実行して結果をファイルに出力
npm run test:report

# または、カバレッジも含めて実行
npm run test:all
```

### 3. テスト結果の確認

テスト実行後、以下のファイルが生成されます：

```
test-results/
├── TEST-RESULTS.txt      # 📄 このファイルをBobに送信
├── test-report.json      # JSON形式の詳細結果
└── junit.xml             # JUnit形式の結果
```

### 4. 結果をBobに報告

#### ステップ1: 結果ファイルを開く

```bash
# ファイルの内容を表示
cat test-results/TEST-RESULTS.txt

# または、エディタで開く
nano test-results/TEST-RESULTS.txt
```

#### ステップ2: 内容をコピー

ファイルの内容全体をコピーします。

#### ステップ3: Bobに送信

コピーした内容をBobに送信します：

```
以下はUbuntu上でテストを実行した結果です：

[TEST-RESULTS.txtの内容をここに貼り付け]
```

## テスト結果ファイルの見方

### ファイル構造

```
================================================================================
3270d - テスト結果レポート
================================================================================

実行日時: 2024-01-01T12:00:00.000Z
Node.js: v18.0.0
プラットフォーム: linux x64

--------------------------------------------------------------------------------
テストサマリー
--------------------------------------------------------------------------------
総テスト数: 50
成功: 48
失敗: 2
スキップ: 0
実行時間: 5.23秒
結果: ❌ 失敗

--------------------------------------------------------------------------------
テストスイート詳細
--------------------------------------------------------------------------------

1. test/unit/network/telnet-options.test.js
   状態: ✅ 成功
   テスト: 10/10 成功, 0 失敗, 0 スキップ
   実行時間: 0.52秒

2. test/unit/auth/session.test.js
   状態: ❌ 失敗
   テスト: 8/10 成功, 2 失敗, 0 スキップ
   実行時間: 0.31秒

   失敗したテスト:
   - Session should create session with correct properties
     Error: Expected 1000 to be 1001
     ...

--------------------------------------------------------------------------------
失敗したテストの詳細
--------------------------------------------------------------------------------

テスト: Session should create session with correct properties
ファイル: test/unit/auth/session.test.js

エラーメッセージ:
Error: Expected 1000 to be 1001
    at Object.<anonymous> (test/unit/auth/session.test.js:35:23)
    ...

================================================================================
テスト結果レポート終了
================================================================================
```

### 重要なセクション

1. **テストサマリー**: 全体の成功/失敗数
2. **テストスイート詳細**: 各テストファイルの結果
3. **失敗したテストの詳細**: エラーメッセージと場所

## トラブルシューティング

### エラー: `node: command not found`

**原因**: Node.jsがインストールされていません。

**解決方法**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### エラー: `Cannot find module 'jest'`

**原因**: 依存パッケージがインストールされていません。

**解決方法**:
```bash
npm install
```

### エラー: `Permission denied: ./scripts/run-tests-ubuntu.sh`

**原因**: スクリプトに実行権限がありません。

**解決方法**:
```bash
chmod +x scripts/run-tests-ubuntu.sh
```

### テスト結果ファイルが生成されない

**原因**: テストの実行に失敗しています。

**解決方法**:
```bash
# 詳細なログを確認
npm test -- --verbose

# または、個別にテストを実行
npm test -- test/unit/network/telnet-options.test.js
```

## 追加のテストコマンド

### 特定のテストファイルのみ実行

```bash
npm test -- test/unit/auth/session.test.js
```

### カバレッジレポートの生成

```bash
npm run test:coverage

# カバレッジレポートを確認
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
```

### ウォッチモード（開発時）

```bash
npm run test:watch
```

## CI/CD統合

### GitHub Actions

`.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm run test:report
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## よくある質問

### Q: テストはどのくらいの時間がかかりますか？

A: 通常、すべてのテストは5-10秒程度で完了します。

### Q: テストが失敗した場合はどうすればいいですか？

A: `test-results/TEST-RESULTS.txt` の内容をBobに送信してください。Bobが失敗の原因を分析し、修正方法を提案します。

### Q: Windows上でテストを実行できますか？

A: このガイドはUbuntu用ですが、Windows上でも `npm test` コマンドでテストを実行できます。ただし、PAM認証などの一部の機能はLinux専用です。

### Q: テスト結果ファイルはGitにコミットすべきですか？

A: いいえ。`test-results/` ディレクトリは `.gitignore` に含まれており、Gitの管理対象外です。

## 参考資料

- [Jest公式ドキュメント](https://jestjs.io/)
- [Node.js公式サイト](https://nodejs.org/)
- [3270d TESTING.md](../TESTING.md)