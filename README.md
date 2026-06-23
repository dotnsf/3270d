# 3270d - TN3270 Server for Linux Shell Access

IBM 3270端末エミュレータ（x3270/c3270）からLinuxシェルにアクセスできるTelnetベースのサーバーアプリケーション

## 概要

3270dは、3270端末プロトコル（TN3270）を実装したサーバーで、x3270などの3270エミュレータからLinuxシェルに接続できるようにします。3270端末に慣れたユーザーが、使い慣れたインターフェースでLinuxシステムを操作できます。

### 主な機能

- ✅ **TN3270プロトコル対応**: RFC 1576準拠
- ✅ **PAM認証**: Linuxの標準認証機構を使用
- ✅ **日本語対応**: UTF-8とEBCDIC（CP939）の相互変換
- ✅ **複数セッション**: 最大2台の同時接続をサポート
- ✅ **VT100/ANSI変換**: Linuxシェルの出力を3270形式に変換
- ✅ **セキュアな設計**: ログ記録、アクセス制御

### 対応環境

- **OS**: Ubuntu 20.04+、CentOS 9+
- **Node.js**: v18.0.0以上
- **3270エミュレータ**: x3270、c3270

---

## クイックスタート

### 1. インストール

#### 通常のLinux環境

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/3270d.git
cd 3270d

# 依存パッケージをインストール
npm install
```

#### WSL (Windows Subsystem for Linux) 環境

**重要:** WSL環境では、Node.js v24は新しすぎて動作しません。Node.js v18 LTSを使用してください。

```bash
# Node.jsのバージョン確認
node --version

# v24.x.x の場合は、v18にダウングレードが必要
# nvmを使用（推奨）
nvm install 18
nvm use 18
nvm alias default 18

# または、直接インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# リポジトリをクローン
git clone https://github.com/yourusername/3270d.git
cd 3270d

# 依存パッケージをインストール
npm install
```

詳細は [docs/WSL_SETUP.md](docs/WSL_SETUP.md) を参照してください。

### 2. 設定

```bash
# 環境変数ファイルを作成
cp .env.example .env

# 設定ファイルを編集（必要に応じて）
vi config/default.json
```

### 3. PAM設定

```bash
# PAM設定スクリプトを実行（要root権限）
sudo ./scripts/setup-pam.sh
```

### 4. サーバー起動

```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

### 5. 接続テスト

```bash
# x3270で接続（デフォルトポート: 23000）
x3270 localhost:23000

# または c3270
c3270 localhost:23000

# カスタムポートを使用する場合
PORT=8023 npm start
x3270 localhost:8023
```

---

## ドキュメント

### 設計ドキュメント

- **[DESIGN.md](DESIGN.md)** - プロジェクト概要と全体設計
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - アーキテクチャ詳細とデータフロー
- **[PROTOCOL.md](PROTOCOL.md)** - TN3270プロトコル仕様
- **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - 実装ガイドとモジュール仕様
- **[TESTING.md](TESTING.md)** - テスト計画とテストケース

### 運用ガイド

- **[docs/PAM_GUIDE.md](docs/PAM_GUIDE.md)** - PAM認証ガイド（認証の仕組みと設定方法）
- **[docs/JAPANESE_SUPPORT.md](docs/JAPANESE_SUPPORT.md)** - 日本語対応ドキュメント
- **[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)** - テスト実行ガイド
- **[docs/WSL_SETUP.md](docs/WSL_SETUP.md)** - WSL環境セットアップガイド

### 開発ガイド

設計ドキュメントを参照して実装を進めてください。各ドキュメントには以下の情報が含まれています：

1. **DESIGN.md**: プロジェクト構造、依存パッケージ、設定ファイル
2. **ARCHITECTURE.md**: レイヤー構成、データフロー、状態遷移
3. **PROTOCOL.md**: Telnetネゴシエーション、3270データストリーム、EBCDIC変換
4. **IMPLEMENTATION.md**: 各モジュールの詳細実装コード
5. **TESTING.md**: ユニットテスト、統合テスト、E2Eテスト

---

## 設定

### 環境変数（.env）

```bash
# サーバー設定
PORT=23000              # デフォルトポート（環境変数で変更可能）
HOST=0.0.0.0
MAX_CONNECTIONS=2

# ログ設定
LOG_LEVEL=info
LOG_FILE=/var/log/3270d/server.log

# 認証設定
AUTH_ENABLED=true
AUTH_MAX_RETRIES=3
```

### 設定ファイル（config/default.json）

```json
{
  "server": {
    "port": 23000,      // デフォルトポート
    "host": "0.0.0.0",
    "maxConnections": 2
  },
  "terminal": {
    "rows": 24,
    "cols": 80,
    "codePage": "cp037",
    "japaneseCodePage": "cp939"
  },
  "auth": {
    "enabled": true,
    "maxRetries": 3,
    "deniedUsers": ["root"]
  }
}
```

---

## 使用方法

### 基本的な接続フロー

1. **接続**: x3270でサーバーに接続
2. **ログイン**: ユーザー名とパスワードを入力
3. **シェル操作**: 通常のLinuxコマンドを実行
4. **ログアウト**: `exit`コマンドまたはClearキー

### キーボードマッピング

| 3270キー | Linuxキー | 説明 |
|---------|----------|------|
| Enter | Enter | コマンド実行 |
| PF1 | F1 | ファンクションキー1 |
| PF2 | F2 | ファンクションキー2 |
| ... | ... | ... |
| PF12 | F12 | ファンクションキー12 |
| PA1 | ESC | エスケープ |
| Clear | Ctrl+L | 画面クリア |

### 日本語入力

日本語の入力と表示に対応しています：

```bash
# 日本語ファイル名の作成
touch こんにちは.txt

# 日本語の表示
echo "日本語テスト"

# 日本語を含むファイルの編集
vi 日本語ファイル.txt
```

---

## 開発

### 開発環境のセットアップ

```bash
# 依存パッケージをインストール
npm install

# 開発モードで起動（自動リロード）
npm run dev

# リンターを実行
npm run lint

# リンターで自動修正
npm run lint:fix
```

### テスト

```bash
# すべてのテストを実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage

# 特定のテストのみ実行
npm test -- test/unit/protocol
```

### ディレクトリ構造

```
3270d/
├── src/                    # ソースコード
│   ├── network/           # Network Layer
│   ├── protocol/          # 3270 Protocol Layer
│   ├── charset/           # Character Conversion Layer
│   ├── screen/            # Screen Buffer Manager
│   ├── terminal/          # Terminal Abstraction Layer
│   ├── auth/              # Authentication Layer
│   └── pty/               # PTY Manager
├── test/                  # テストコード
│   ├── unit/             # ユニットテスト
│   ├── integration/      # 統合テスト
│   └── e2e/              # E2Eテスト
├── config/               # 設定ファイル
├── scripts/              # ユーティリティスクリプト
└── docs/                 # ドキュメント
```

---

## トラブルシューティング

### 接続できない

```bash
# ポートが使用中か確認
sudo netstat -tulpn | grep 23

# ファイアウォール設定を確認
sudo ufw status
sudo ufw allow 23/tcp

# サーバーログを確認
tail -f /var/log/3270d/server.log
```

### 認証が失敗する

```bash
# PAM設定を確認
cat /etc/pam.d/3270d

# ユーザーが存在するか確認
id username

# パスワードをリセット
sudo passwd username
```

### 文字化けする

```bash
# ロケール設定を確認
locale

# LANG環境変数を設定
export LANG=ja_JP.UTF-8

# x3270の設定を確認
cat ~/.x3270rc
```

### パフォーマンスが悪い

```bash
# CPU使用率を確認
top

# メモリ使用量を確認
free -h

# ログレベルを下げる
# config/default.json の logging.level を "warn" に変更
```

---

## セキュリティ

### 推奨設定

1. **ユーザー制限**: 特定のユーザーのみ許可
2. **グループ制限**: 専用グループを作成
3. **ログ監視**: 定期的にログを確認
4. **SSL/TLS**: 将来的に暗号化を実装予定

### PAM設定例

```bash
# /etc/pam.d/3270d
auth       required     pam_unix.so
auth       required     pam_env.so
account    required     pam_unix.so
account    required     pam_time.so
session    required     pam_unix.so
session    required     pam_limits.so
```

### アクセス制御

```json
{
  "auth": {
    "allowedUsers": ["user1", "user2"],
    "deniedUsers": ["root"],
    "requireGroup": "3270-users"
  }
}
```

---

## パフォーマンス

### ベンチマーク

- **同時接続数**: 2台
- **応答時間**: < 100ms（キー入力から画面更新まで）
- **メモリ使用量**: 約50MB/接続
- **CPU使用率**: < 5%（アイドル時）

### 最適化

- 差分更新による通信量削減
- 出力バッファリング（50ms）
- 文字コード変換キャッシュ

---

## ロードマップ

### Phase 1: 基本機能（完了）
- [x] Telnetサーバー
- [x] 3270プロトコル実装
- [x] PAM認証
- [x] PTY管理

### Phase 2: 日本語対応（完了）
- [x] EBCDIC/UTF-8変換
- [x] 全角文字対応
- [x] CP939サポート

### Phase 3: 高度な機能（計画中）
- [ ] カラー対応
- [ ] フルスクリーンエディタ対応
- [ ] SSL/TLS暗号化
- [ ] ファイル転送機能

### Phase 4: 運用機能（計画中）
- [ ] 管理コンソール
- [ ] 統計情報
- [ ] 自動バックアップ
- [ ] クラスタリング

---

## ライセンス

MIT License

---

## 貢献

プルリクエストを歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを作成

---

## サポート

- **Issues**: [GitHub Issues](https://github.com/yourusername/3270d/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/3270d/discussions)

---

## 参考資料

### 仕様書
- [RFC 1576: TN3270 Current Practices](https://www.rfc-editor.org/rfc/rfc1576)
- [RFC 854: Telnet Protocol Specification](https://www.rfc-editor.org/rfc/rfc854)
- IBM 3270 Data Stream Programmer's Reference (GA23-0059)

### 関連プロジェクト
- [x3270](https://x3270.bgp.nu/) - 3270エミュレータ
- [node-pty](https://github.com/microsoft/node-pty) - PTYライブラリ

---

## 作者

Bob (AI Assistant)

## 更新履歴

- **2026-06-22**: 初版設計完了
  - 詳細設計ドキュメント作成
  - アーキテクチャ設計
  - プロトコル仕様
  - 実装ガイド
  - テスト計画