# PAM認証ガイド

## PAMとは？

**PAM (Pluggable Authentication Modules)** は、Linuxシステムで使用される認証フレームワークです。

### 主な特徴

1. **統一された認証インターフェース**
   - アプリケーションは直接パスワードファイルを読む必要がない
   - システム管理者が認証方法を一元管理できる

2. **柔軟な認証方式**
   - ローカルユーザー認証（/etc/passwd, /etc/shadow）
   - LDAP認証
   - Kerberos認証
   - 二要素認証
   - など、様々な認証方式をサポート

3. **セキュリティ**
   - パスワードハッシュへの直接アクセスを防ぐ
   - 認証ポリシーを一箇所で管理
   - 監査ログの統一

## 3270dでのPAM使用

3270dは、3270エミュレータからLinuxシェルにアクセスする際の認証にPAMを使用します。

### 認証フロー

```
1. ユーザーが3270エミュレータから接続
   ↓
2. 3270dがユーザー名とパスワードを要求
   ↓
3. ユーザーが認証情報を入力
   ↓
4. 3270dがPAMを通じて認証
   ↓
5. PAMがシステムの認証機構（/etc/shadowなど）をチェック
   ↓
6. 認証成功 → シェルセッション開始
   認証失敗 → エラーメッセージ表示
```

### PAM設定ファイル

3270d用のPAM設定ファイル: `/etc/pam.d/3270d`

```pam
#%PAM-1.0
# 3270d - TN3270 Server for Linux Shell Access

# 認証 (Authentication)
auth       required     pam_unix.so
auth       required     pam_env.so

# アカウント管理 (Account Management)
account    required     pam_unix.so
account    required     pam_permit.so

# パスワード管理 (Password Management)
password   required     pam_deny.so

# セッション管理 (Session Management)
session    required     pam_unix.so
session    required     pam_limits.so
session    optional     pam_systemd.so
```

### 各モジュールの説明

#### 認証 (auth)

- **pam_unix.so**: 標準のUnix認証（/etc/shadowを使用）
- **pam_env.so**: 環境変数の設定

#### アカウント管理 (account)

- **pam_unix.so**: アカウントの有効性チェック（期限切れ、ロックなど）
- **pam_permit.so**: アカウント管理を許可

#### パスワード管理 (password)

- **pam_deny.so**: パスワード変更を拒否（3270dはパスワード変更機能を提供しない）

#### セッション管理 (session)

- **pam_unix.so**: セッション開始/終了の記録
- **pam_limits.so**: リソース制限の適用
- **pam_systemd.so**: systemdセッション管理（オプション）

## セットアップ手順

### 1. PAM設定ファイルの作成

```bash
# root権限で実行
sudo ./scripts/setup-pam.sh
```

このスクリプトは以下を実行します：
- `/etc/pam.d/3270d` ファイルの作成
- 既存ファイルのバックアップ（存在する場合）
- PAM開発ライブラリのチェックとインストール

### 2. PAM開発ライブラリのインストール

```bash
# Ubuntu/Debian
sudo apt-get install libpam0g-dev

# CentOS/RHEL
sudo yum install pam-devel
```

### 3. authenticate-pamモジュールのインストール

```bash
cd /path/to/3270d
npm install
```

**注意**: WSL環境では、Node.js v18を使用してください（v24は新しすぎる）。

### 4. サーバーの起動

```bash
# 本番モード（PAM認証有効）
NODE_ENV=production npm start

# 開発モード（PAM認証スキップ）
NODE_ENV=development npm start
```

## トラブルシューティング

### エラー: authenticate-pamのビルドに失敗

**原因**: PAM開発ライブラリがインストールされていない、またはコンパイラが古い

**解決方法**:

```bash
# PAM開発ライブラリをインストール
sudo apt-get install libpam0g-dev

# Node.jsをv18にダウングレード（WSLの場合）
nvm install 18
nvm use 18

# 再インストール
rm -rf node_modules package-lock.json
npm install
```

### エラー: PAM authentication failed

**原因**: 
- ユーザー名またはパスワードが間違っている
- アカウントがロックされている
- PAM設定ファイルが正しくない

**確認方法**:

```bash
# PAM設定ファイルの確認
cat /etc/pam.d/3270d

# ユーザーアカウントの確認
id username

# アカウントのロック状態を確認
sudo passwd -S username
```

### エラー: Permission denied

**原因**: 3270dを実行するユーザーにPAMへのアクセス権限がない

**解決方法**:

PAM認証を使用するには、通常root権限が必要です。ただし、セキュリティ上の理由から、以下の方法を推奨します：

1. **開発環境**: `NODE_ENV=development` で起動（PAM認証スキップ）
2. **本番環境**: systemdサービスとして実行し、適切な権限を設定

## 開発モード vs 本番モード

### 開発モード（NODE_ENV=development）

- PAM認証をスキップ
- ユーザー名のみで認証（パスワード不要）
- ローカル開発に適している
- セキュリティリスクがあるため、本番環境では使用しない

```bash
NODE_ENV=development npm start
```

### 本番モード（NODE_ENV=production）

- PAM認証を使用
- システムの標準認証機構を利用
- セキュアな認証
- 本番環境で使用

```bash
NODE_ENV=production npm start
```

## セキュリティ考慮事項

### 1. 最小権限の原則

3270dは必要最小限の権限で実行してください。

### 2. ログ監視

PAM認証の失敗は `/var/log/auth.log` に記録されます。

```bash
# 認証ログの確認
sudo tail -f /var/log/auth.log | grep 3270d
```

### 3. アカウントロックアウト

連続した認証失敗に対してアカウントをロックする設定を推奨します。

```bash
# /etc/pam.d/3270d に追加
auth required pam_tally2.so deny=5 unlock_time=600
```

### 4. 二要素認証

より高いセキュリティが必要な場合は、Google Authenticatorなどの二要素認証を追加できます。

```bash
# Google Authenticatorのインストール
sudo apt-get install libpam-google-authenticator

# /etc/pam.d/3270d に追加
auth required pam_google_authenticator.so
```

## まとめ

PAMを使用することで、3270dは：

1. **セキュアな認証**: システムの標準認証機構を利用
2. **柔軟性**: 様々な認証方式に対応可能
3. **管理の容易さ**: 認証ポリシーを一元管理
4. **監査**: 認証ログの統一的な記録

開発環境では `NODE_ENV=development` で簡易認証を使用し、本番環境では `NODE_ENV=production` でPAM認証を使用することを推奨します。