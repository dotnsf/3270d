# TN3270 ASCII/EBCDIC エンコーディング問題の修正

## 問題の概要

ログイン画面に大量の文字化け（`Sn°Sn°Sn°`など）が表示される問題が発生していました。

### 根本原因

**TN3270プロトコルでは、テキストデータをEBCDICではなくASCIIで送信するのが一般的**です。

当初の実装では、すべてのテキストをEBCDICに変換していましたが、これが文字化けの原因でした。

## TN3270プロトコルにおける文字エンコーディング

### 標準的な実装

多くのTN3270実装（c3270、x3270など）では：

1. **制御コード**: バイナリ値（Commands、Orders、WCCなど）
2. **テキストデータ**: ASCII（EBCDICではない）
3. **フィールド属性**: バイナリ値

### EBCDIC vs ASCII

- **EBCDIC**: IBM メインフレームの文字コード（歴史的）
- **ASCII**: 現代のTN3270実装で一般的
- **理由**: TCP/IPネットワークではASCIIが標準

## 修正内容

### 1. generator.js - テキスト送信をASCIIに変更

#### 修正前
```javascript
writeText(stream, text) {
  // UTF-8からEBCDICに変換
  const ebcdic = this.converter.utf8ToEbcdic(text);
  for (let i = 0; i < ebcdic.length; i++) {
    stream.push(ebcdic[i]);
  }
}
```

#### 修正後
```javascript
writeText(stream, text) {
  // UTF-8からASCIIに変換（ASCIIはUTF-8と互換性がある）
  const ascii = Buffer.from(text, 'utf8');
  for (let i = 0; i < ascii.length; i++) {
    stream.push(ascii[i]);
  }
}
```

### 2. parser.js - テキスト受信をASCIIとして解釈

#### 修正前
```javascript
if (fieldData.length > 0) {
  const dataBuffer = Buffer.from(fieldData);
  fields.push({
    address: addr,
    position: BufferAddress.toRowCol(addr),
    data: dataBuffer,
    value: this.converter.ebcdicToUtf8(dataBuffer)
  });
}
```

#### 修正後
```javascript
if (fieldData.length > 0) {
  const dataBuffer = Buffer.from(fieldData);
  fields.push({
    address: addr,
    position: BufferAddress.toRowCol(addr),
    data: dataBuffer,
    // TN3270ではASCIIで送信されることが多い
    value: dataBuffer.toString('utf8')
  });
}
```

## 影響範囲

### 変更されたファイル
1. `src/protocol/generator.js` - `writeText()` メソッド
2. `src/protocol/parser.js` - フィールドデータの解析

### 変更されなかったファイル
- `src/charset/converter.js` - EBCDIC変換機能は将来の拡張のために保持
- `src/integration/terminal-handler.js` - EBCDIC変換を使用していない
- その他のモジュール

## テスト方法

1. サーバーを再起動
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
   - 「TN3270 Login」タイトルが表示される
   - 「Username:」「Password:」フィールドが正しく表示される
   - 文字化け（`Sn°Sn°Sn°`など）が表示されない
   - 入力フィールドにカーソルが配置される

## 期待される結果

```
================================ TN3270 Login ================================

          Username: [                    ]

          Password: [                    ]

          Press Enter to login




==============================================================================
TN3270 Server v1.0
```

## 技術的な背景

### なぜASCIIなのか？

1. **互換性**: TCP/IPネットワークではASCIIが標準
2. **実装の簡素化**: 変換処理が不要
3. **デバッグの容易さ**: ASCIIは人間が読める
4. **パフォーマンス**: 変換オーバーヘッドがない

### EBCDICが必要な場合

以下の場合はEBCDICが必要になる可能性があります：

1. **実際のIBMメインフレームとの通信**
2. **レガシーアプリケーションとの互換性**
3. **特定のTN3270Eオプション**

現在の実装では、将来の拡張のためにEBCDIC変換機能を保持していますが、デフォルトではASCIIを使用します。

## 設定オプション（将来の拡張）

将来的に、設定ファイルでエンコーディングを選択できるようにする予定：

```json
{
  "terminal": {
    "encoding": "ascii",  // または "ebcdic"
    "codePage": "cp037"   // EBCDICの場合のコードページ
  }
}
```

## 参考資料

- RFC 1576: TN3270 Current Practices
- RFC 2355: TN3270 Enhancements
- IBM 3270 Data Stream Programmer's Reference
- c3270/x3270 ソースコード

## まとめ

この修正により、TN3270プロトコルの標準的な実装に準拠し、c3270クライアントとの互換性が向上しました。テキストデータをASCIIで送受信することで、文字化けの問題が解決されます。