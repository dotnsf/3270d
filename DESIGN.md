# TN3270 Server (3270d) - 詳細設計書

## プロジェクト概要

### 目的
IBM 3270端末エミュレータ（x3270/c3270）からLinuxシェルにアクセスできるTelnetベースのサーバーアプリケーション

### スコープ
- **対象ユーザー**: 3270端末に慣れたユーザー
- **同時接続数**: 1-2台
- **プロトコル**: TN3270 (RFC 1576)
- **認証**: ユーザー名+パスワード（PAM）
- **文字コード**: EBCDIC ↔ UTF-8（日本語対応）
- **対象OS**: Ubuntu（優先）、CentOS 9（次点）

### 非機能要件
- **パフォーマンス**: 1-2台の同時接続で応答時間 < 100ms
- **可用性**: 99%以上（開発環境）
- **保守性**: モジュール化された設計、包括的なログ
- **セキュリティ**: PAM認証、将来的にSSL/TLS対応

---

## システムアーキテクチャ

### 全体構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     3270 Client (x3270)                      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Terminal    │  │  Keyboard    │  │  Display     │      │
│  │  Emulator    │  │  Handler     │  │  Renderer    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │ TN3270 Protocol (TCP/IP)
                            │ Port 23
┌───────────────────────────▼─────────────────────────────────┐
│                    3270d Server (Node.js)                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Network Layer (Telnet)                   │   │
│  │  - TCP Socket Management                              │   │
│  │  - Telnet Option Negotiation                          │   │
│  │  - Connection State Management                        │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │           3270 Protocol Layer                         │   │
│  │  - Data Stream Parser                                 │   │
│  │  - Data Stream Generator                              │   │
│  │  - Command Processor                                  │   │
│  │  - AID (Attention Identifier) Handler                 │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │          Character Conversion Layer                   │   │
│  │  - EBCDIC ↔ UTF-8 Converter                          │   │
│  │  - Japanese Character Handler                         │   │
│  │  - Code Page Manager (CP037, CP939)                  │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │            Screen Buffer Manager                      │   │
│  │  - 24x80 Character Buffer                             │   │
│  │  - Field Attribute Management                         │   │
│  │  - Cursor Position Tracking                           │   │
│  │  - Modified Data Tag (MDT) Handling                   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │          Terminal Abstraction Layer                   │   │
│  │  - VT100/ANSI Escape Sequence Parser                  │   │
│  │  - Screen State Synchronization                       │   │
│  │  - Keyboard Mapping (3270 ↔ Linux)                   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │           Authentication Layer                        │   │
│  │  - PAM Integration                                    │   │
│  │  - Session Management                                 │   │
│  │  - User Context Switching                             │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │              PTY Manager                              │   │
│  │  - Pseudo Terminal Allocation                         │   │
│  │  - Process Lifecycle Management                       │   │
│  │  - I/O Multiplexing                                   │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Linux System                            │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   /bin/bash  │  │     PAM      │  │  /etc/passwd │  │
│  │   (Shell)    │  │  (libpam)    │  │  /etc/shadow │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### レイヤー構成

#### Layer 1: Network Layer
- **責務**: TCP接続管理、Telnetプロトコル処理
- **入力**: TCP接続要求、生データ
- **出力**: Telnetネゴシエーション完了、3270データストリーム

#### Layer 2: 3270 Protocol Layer
- **責務**: 3270コマンド/データストリームの解析と生成
- **入力**: 3270データストリーム（バイナリ）
- **出力**: 構造化された3270コマンド

#### Layer 3: Character Conversion Layer
- **責務**: 文字コード変換（EBCDIC ↔ UTF-8）
- **入力**: EBCDICバイト列 or UTF-8文字列
- **出力**: UTF-8文字列 or EBCDICバイト列

#### Layer 4: Screen Buffer Manager
- **責務**: 3270画面状態の管理
- **入力**: 画面更新コマンド
- **出力**: 3270データストリーム

#### Layer 5: Terminal Abstraction Layer
- **責務**: VT100/ANSIと3270の変換
- **入力**: VT100エスケープシーケンス
- **出力**: 3270画面更新コマンド

#### Layer 6: Authentication Layer
- **責務**: ユーザー認証とセッション管理
- **入力**: ユーザー名、パスワード
- **出力**: 認証結果、ユーザーコンテキスト

#### Layer 7: PTY Manager
- **責務**: 疑似端末の管理とシェルプロセス制御
- **入力**: シェルコマンド
- **出力**: シェル出力

---

## ディレクトリ構造

```
3270d/
├── package.json                 # プロジェクト設定
├── package-lock.json
├── .gitignore
├── .env.example                 # 環境変数テンプレート
├── README.md                    # プロジェクト概要
├── DESIGN.md                    # 本ドキュメント
├── ARCHITECTURE.md              # アーキテクチャ詳細
├── PROTOCOL.md                  # 3270プロトコル仕様
├── IMPLEMENTATION.md            # 実装ガイド
├── TESTING.md                   # テスト計画
│
├── src/                         # ソースコード
│   ├── index.js                 # エントリーポイント
│   ├── config.js                # 設定管理
│   ├── logger.js                # ロギング
│   │
│   ├── network/                 # Network Layer
│   │   ├── telnet-server.js    # Telnetサーバー
│   │   ├── telnet-options.js   # Telnetオプション処理
│   │   └── connection.js       # 接続管理
│   │
│   ├── protocol/                # 3270 Protocol Layer
│   │   ├── data-stream.js      # データストリーム処理
│   │   ├── commands.js         # 3270コマンド定義
│   │   ├── parser.js           # データストリームパーサー
│   │   ├── generator.js        # データストリーム生成
│   │   └── aid-handler.js      # AID処理
│   │
│   ├── charset/                 # Character Conversion Layer
│   │   ├── converter.js        # 文字コード変換
│   │   ├── ebcdic.js           # EBCDIC定義
│   │   ├── codepage.js         # コードページ管理
│   │   └── japanese.js         # 日本語処理
│   │
│   ├── screen/                  # Screen Buffer Manager
│   │   ├── buffer.js           # 画面バッファ
│   │   ├── field.js            # フィールド管理
│   │   ├── attribute.js        # 属性管理
│   │   └── cursor.js           # カーソル管理
│   │
│   ├── terminal/                # Terminal Abstraction Layer
│   │   ├── vt100-parser.js     # VT100パーサー
│   │   ├── ansi-parser.js      # ANSIエスケープパーサー
│   │   ├── keyboard-map.js     # キーボードマッピング
│   │   └── screen-sync.js      # 画面同期
│   │
│   ├── auth/                    # Authentication Layer
│   │   ├── authenticator.js    # 認証処理
│   │   ├── pam-auth.js         # PAM統合
│   │   ├── session.js          # セッション管理
│   │   └── user-context.js     # ユーザーコンテキスト
│   │
│   └── pty/                     # PTY Manager
│       ├── pty-manager.js      # PTY管理
│       ├── shell-spawner.js    # シェル起動
│       └── io-multiplexer.js   # I/O多重化
│
├── test/                        # テストコード
│   ├── unit/                    # ユニットテスト
│   │   ├── protocol/
│   │   ├── charset/
│   │   ├── screen/
│   │   └── terminal/
│   ├── integration/             # 統合テスト
│   │   ├── connection-test.js
│   │   ├── auth-test.js
│   │   └── shell-test.js
│   └── e2e/                     # E2Eテスト
│       └── full-session-test.js
│
├── docs/                        # ドキュメント
│   ├── api/                     # API仕様
│   ├── diagrams/                # 図表
│   └── examples/                # サンプルコード
│
├── scripts/                     # ユーティリティスクリプト
│   ├── setup-pam.sh            # PAM設定スクリプト
│   ├── create-user.sh          # ユーザー作成
│   └── test-connection.sh      # 接続テスト
│
└── config/                      # 設定ファイル
    ├── default.json            # デフォルト設定
    ├── development.json        # 開発環境設定
    ├── production.json         # 本番環境設定
    └── pam.d/                  # PAM設定
        └── 3270d               # PAM設定ファイル
```

---

## 依存パッケージ

### package.json

```json
{
  "name": "3270d",
  "version": "1.0.0",
  "description": "TN3270 Server for Linux Shell Access",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  },
  "keywords": ["3270", "tn3270", "telnet", "terminal", "emulator"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "node-pty": "^1.0.0",
    "iconv-lite": "^0.6.3",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.2",
    "eslint": "^8.56.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 設定ファイル

### config/default.json

```json
{
  "server": {
    "port": 23,
    "host": "0.0.0.0",
    "maxConnections": 2,
    "connectionTimeout": 300000,
    "idleTimeout": 600000
  },
  "terminal": {
    "rows": 24,
    "cols": 80,
    "terminalType": "IBM-3279-2-E",
    "codePage": "cp037",
    "japaneseCodePage": "cp939"
  },
  "auth": {
    "enabled": true,
    "maxRetries": 3,
    "allowedUsers": [],
    "deniedUsers": ["root"],
    "requireGroup": null
  },
  "pty": {
    "shell": "/bin/bash",
    "env": {
      "TERM": "xterm-256color",
      "LANG": "ja_JP.UTF-8"
    }
  },
  "logging": {
    "level": "info",
    "file": "/var/log/3270d/server.log",
    "maxSize": "10m",
    "maxFiles": 5
  }
}
```

---

## 次のドキュメント

詳細設計の続きは以下のドキュメントに分割されています：

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - アーキテクチャ詳細とデータフロー
2. **[PROTOCOL.md](PROTOCOL.md)** - 3270プロトコル仕様
3. **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - 実装ガイドとモジュール仕様
4. **[TESTING.md](TESTING.md)** - テスト計画とテストケース

これらのドキュメントを順次作成していきます。
