# ログイン画面文字化け問題の修正

## 問題の概要

c3270クライアントでログイン画面に接続すると、大量の文字化けが表示される問題が発生していました。

### 症状
- 赤枠内に白・青・緑で大量の文字化けが表示
- 「Username:」「Password:」は正しく表示
- 文字化け部分は3270データストリームの制御コード（Orders、SBA、SFなど）がそのまま表示されている

### 原因分析

1. **Telnetバイナリモードのネゴシエーション順序の問題**
   - RFC 1576では、サーバーとクライアント双方向のバイナリモードを確立する必要がある
   - 現在の実装では、両方のネゴシエーションを同時に送信していた
   - クライアントの応答を待たずに次のネゴシエーションを送信していた

2. **双方向バイナリモードの確認不足**
   - クライアント→サーバー（WILL BINARY）
   - サーバー→クライアント（WILL BINARY）
   - 両方が確立されていることを確認していなかった

3. **IAC（0xFF）エスケープ処理の欠如**
   - 3270データストリーム内にIAC（0xFF）が含まれる場合、エスケープが必要
   - IAC IAC（0xFF 0xFF）として送信する必要がある

## 修正内容

### 1. telnet-options.js の修正

#### バイナリモードのネゴシエーション順序を修正

```javascript
// 修正前
requestBinaryMode(socket) {
  socket.write(Buffer.from([IAC, WILL, BINARY]));
  socket.write(Buffer.from([IAC, DO, BINARY]));
}

// 修正後
requestBinaryMode(socket) {
  // まずサーバーがWILL BINARYを送信
  socket.write(Buffer.from([IAC, WILL, BINARY]));
  
  // 少し待ってからDO BINARYを送信（クライアントの応答を待つ）
  setTimeout(() => {
    socket.write(Buffer.from([IAC, DO, BINARY]));
  }, 50);
}
```

#### 双方向バイナリモードの追跡

```javascript
// 修正前
this.binaryMode = false;

// 修正後
this.binaryModeClient = false; // クライアント側のバイナリモード
this.binaryModeServer = false; // サーバー側のバイナリモード
```

#### ネゴシエーション完了条件の修正

```javascript
// 修正前
checkNegotiationComplete() {
  if (this.terminalType && this.binaryMode && this.eor) {
    this.negotiationComplete = true;
  }
}

// 修正後
checkNegotiationComplete() {
  // 双方向のバイナリモードが確立されていることを確認
  if (this.terminalType && this.binaryModeClient && this.binaryModeServer && this.eor) {
    this.negotiationComplete = true;
    logger.info('TN3270 negotiation complete: Terminal=' + this.terminalType + 
                ', Binary(C->S)=' + this.binaryModeClient + 
                ', Binary(S->C)=' + this.binaryModeServer + 
                ', EOR=' + this.eor);
  }
}
```

#### オプション処理の修正

```javascript
// WILL BINARY（クライアント側のバイナリモード）
} else if (option === BINARY) {
  this.binaryModeClient = true;
  logger.info('Client binary mode enabled');
  this.checkNegotiationComplete();
  return { response: Buffer.from([IAC, DO, BINARY]) };
}

// DO BINARY（サーバー側のバイナリモード）
if (option === BINARY) {
  this.binaryModeServer = true;
  logger.info('Server binary mode enabled');
  this.checkNegotiationComplete();
  return { response: Buffer.from([IAC, WILL, BINARY]) };
}
```

### 2. generator.js の修正

#### IAC エスケープ処理の追加

```javascript
/**
 * IAC（0xFF）をエスケープ
 * TN3270データストリーム内のIACは2回送信する必要がある
 * @param {Array} stream - データストリーム配列
 * @returns {Buffer} - エスケープ済みバッファ
 */
escapeIAC(stream) {
  const escaped = [];
  for (let i = 0; i < stream.length; i++) {
    const byte = stream[i];
    escaped.push(byte);
    // IAC（0xFF）の場合、もう一度追加（ただしEORの直前のIACは除く）
    if (byte === this.IAC && i < stream.length - 1 && stream[i + 1] !== this.EOR) {
      escaped.push(this.IAC);
    }
  }
  return Buffer.from(escaped);
}
```

#### すべての生成メソッドで escapeIAC を使用

```javascript
// 修正前
return Buffer.from(stream);

// 修正後
return this.escapeIAC(stream);
```

対象メソッド：
- `generateEraseWrite()`
- `generateWrite()`
- `generateLoginScreen()`
- `generateWelcomeScreen()`
- `generateErrorScreen()`

## テスト方法

1. サーバーを起動
```bash
cd 3270d
npm start
```

2. c3270クライアントで接続
```bash
c3270 localhost:23000
```

3. 確認事項
   - ログイン画面が正しく表示される
   - 文字化けが表示されない
   - 「Username:」「Password:」フィールドが正しく表示される
   - ログに「TN3270 negotiation complete」が表示される
   - ログに「Client binary mode enabled」と「Server binary mode enabled」が表示される

## 期待される結果

- ログイン画面が正しく表示される
- 3270データストリームの制御コードが文字として表示されない
- フィールドが正しく配置される
- カーソルがユーザー名フィールドに配置される

## 技術的な詳細

### TN3270プロトコルのバイナリモード

RFC 1576によると、TN3270では以下の順序でネゴシエーションを行う必要があります：

1. サーバーが`WILL BINARY`を送信
2. クライアントが`DO BINARY`で応答
3. サーバーが`DO BINARY`を送信
4. クライアントが`WILL BINARY`で応答

これにより、双方向のバイナリモードが確立されます。

### IAC エスケープ

Telnetプロトコルでは、IAC（0xFF）は特殊な制御文字です。データストリーム内にIACが含まれる場合、それをエスケープする必要があります：

- データ内のIAC（0xFF）→ IAC IAC（0xFF 0xFF）として送信
- ただし、EORの直前のIACはエスケープしない（`IAC EOR`は制御シーケンス）

## 参考資料

- RFC 1576: TN3270 Current Practices
- RFC 854: Telnet Protocol Specification
- IBM 3270 Data Stream Programmer's Reference