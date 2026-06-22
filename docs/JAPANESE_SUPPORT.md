# 日本語対応ドキュメント

## 概要

3270dは、3270端末での日本語表示を完全にサポートしています。
DBCS（Double Byte Character Set）を使用して、ひらがな、カタカナ、漢字を適切に表示できます。

## サポートされる文字セット

### 1. ひらがな
- Unicode範囲: U+3040 - U+309F
- 例: あいうえお、かきくけこ

### 2. カタカナ
- Unicode範囲: U+30A0 - U+30FF
- 例: アイウエオ、カキクケコ

### 3. 漢字
- Unicode範囲: U+4E00 - U+9FFF（CJK統合漢字）
- 例: 漢字、日本語

### 4. その他のCJK文字
- CJK記号と句読点: U+3000 - U+303F
- 全角英数字: U+FF00 - U+FFEF

## 文字幅の処理

### DBCS（全角文字）
- 表示幅: 2カラム
- 対象: ひらがな、カタカナ、漢字、全角記号

### SBCS（半角文字）
- 表示幅: 1カラム
- 対象: ASCII文字（英数字、記号）

## コードページ

### デフォルト設定
- ASCII/EBCDIC: CP037（US）
- 日本語: CP939（日本語拡張）

### 設定方法

`config/default.json`:
```json
{
  "terminal": {
    "codePage": "cp037",
    "japaneseCodePage": "cp939"
  }
}
```

環境変数:
```bash
TERMINAL_CODE_PAGE=cp037
TERMINAL_JAPANESE_CODE_PAGE=cp939
```

## 文字列処理

### 1. 表示幅の計算

```javascript
const japaneseHandler = require('./src/charset/japanese-handler');

// 表示幅を取得
const width = japaneseHandler.getDisplayWidth('Hello世界');
// => 9 (Hello=5 + 世界=4)
```

### 2. 文字列の切り詰め

```javascript
// 指定幅で切り詰め（全角文字の途中で切れない）
const result = japaneseHandler.truncate('こんにちは世界', 10);
// => { text: 'こんにちは', width: 10 }
```

### 3. 文字列の折り返し

```javascript
// 指定幅で折り返し
const lines = japaneseHandler.wrapText('こんにちは世界', 8);
// => ['こんにち', 'は世界']
```

### 4. パディング

```javascript
// 左寄せ
japaneseHandler.pad('こんにちは', 20, 'left');
// => 'こんにちは          '

// 右寄せ
japaneseHandler.pad('こんにちは', 20, 'right');
// => '          こんにちは'

// 中央寄せ
japaneseHandler.pad('こんにちは', 20, 'center');
// => '     こんにちは     '
```

## 画面バッファでの日本語処理

### 全角文字の書き込み

```javascript
const buffer = new ScreenBuffer(24, 80);

// 全角文字を書き込み（自動的に2カラム占有）
buffer.writeString(0, 0, 'こんにちは');

// 行末での自動折り返し
buffer.writeString(0, 78, 'こんにちは');
// => 'こん'が0行目、'にちは'が1行目に表示
```

### DBCS マーカー

全角文字の2バイト目には特殊なマーカーが設定されます：

```javascript
// 'あ'を書き込むと：
// buffer[row][col].char = 'あ'
// buffer[row][col+1].char = ''  // 2バイト目マーカー
// buffer[row][col+1].isDBCS = true
```

## 文字コード変換

### UTF-8 → EBCDIC

```javascript
const converter = new CharsetConverter();

// 日本語を含む文字列を変換
const ebcdic = converter.utf8ToEbcdic('こんにちは');
// => 自動的にCP939を使用
```

### EBCDIC → UTF-8

```javascript
// EBCDICバイト列を変換
const utf8 = converter.ebcdicToUtf8(ebcdic);
// => 'こんにちは'
```

### 自動コードページ選択

変換時に日本語文字が含まれているかを自動検出し、
適切なコードページを選択します：

```javascript
// ASCII文字のみ → CP037
converter.utf8ToEbcdic('Hello');

// 日本語を含む → CP939
converter.utf8ToEbcdic('Hello世界');
```

## ロケール設定

### 環境変数

ユーザーセッションには自動的に日本語ロケールが設定されます：

```bash
LANG=ja_JP.UTF-8
LC_ALL=ja_JP.UTF-8
```

### PTY設定

```javascript
const userContext = new UserContext(session);
const ptyOptions = userContext.getPtyOptions();
// => {
//   env: {
//     LANG: 'ja_JP.UTF-8',
//     LC_ALL: 'ja_JP.UTF-8',
//     ...
//   }
// }
```

## 端末タイプ

### 3270端末の日本語対応

推奨端末タイプ：
- IBM-3279-2-E（拡張カラー、DBCS対応）
- IBM-3278-2-E（モノクロ、DBCS対応）

設定方法：
```bash
# x3270の場合
x3270 -model 3279-2-E hostname:port

# c3270の場合
c3270 -model 3279-2-E hostname:port
```

## トラブルシューティング

### 文字化けが発生する場合

1. **コードページの確認**
   ```bash
   # 設定ファイルを確認
   cat config/default.json
   ```

2. **ロケールの確認**
   ```bash
   # セッション内で確認
   echo $LANG
   echo $LC_ALL
   ```

3. **端末タイプの確認**
   ```bash
   # 3270端末で確認
   echo $TERM
   # => IBM-3279-2-E
   ```

### 全角文字が正しく表示されない場合

1. **端末の設定を確認**
   - DBCS対応モデルを使用しているか
   - フォントが日本語をサポートしているか

2. **文字幅の確認**
   ```javascript
   // デバッグ用
   const stats = japaneseHandler.getTextStats('問題の文字列');
   console.log(stats);
   ```

### 行末での文字切れ

全角文字が行末に収まらない場合、自動的に次の行に折り返されます。
これは仕様通りの動作です。

## パフォーマンス最適化

### キャッシング

文字コード変換結果はLRUキャッシュに保存されます：

```javascript
const converter = new CharsetConverter();

// キャッシュ統計を取得
const stats = converter.getCacheStats();
console.log(stats);
// => { size: 150, maxSize: 1000, usage: '15.00%' }

// キャッシュをクリア
converter.clearCache();
```

### 文字幅計算の最適化

文字幅の判定は高速化されており、
Unicode範囲チェックのみで判定します。

## ベストプラクティス

### 1. 文字列の長さチェック

```javascript
// ❌ 間違い: 文字数でチェック
if (text.length > 80) { ... }

// ✅ 正しい: 表示幅でチェック
if (japaneseHandler.getDisplayWidth(text) > 80) { ... }
```

### 2. 文字列の切り詰め

```javascript
// ❌ 間違い: substring()を使用
const truncated = text.substring(0, 80);

// ✅ 正しい: truncate()を使用
const truncated = japaneseHandler.truncate(text, 80).text;
```

### 3. 文字境界の確認

```javascript
// 文字境界が有効かチェック
if (japaneseHandler.isValidBoundary(text, position)) {
  // 安全に分割可能
}
```

## API リファレンス

### JapaneseHandler

#### メソッド

- `isDBCS(char)` - 全角文字かどうかを判定
- `getCharWidth(char)` - 文字幅を取得（1または2）
- `getDisplayWidth(text)` - 表示幅を計算
- `truncate(text, maxWidth)` - 指定幅で切り詰め
- `pad(text, width, align)` - パディング
- `wrapText(text, width)` - 折り返し
- `splitAt(text, position)` - 指定位置で分割
- `isValidBoundary(text, position)` - 文字境界の検証
- `containsJapanese(text)` - 日本語文字の検出
- `getCharType(char)` - 文字種別の取得
- `getTextStats(text)` - テキスト統計の取得

詳細は `src/charset/japanese-handler.js` を参照してください。

## 参考資料

- [IBM 3270 Data Stream Programmer's Reference](https://www.ibm.com/docs/en/zos)
- [EBCDIC Code Pages](https://en.wikipedia.org/wiki/EBCDIC)
- [Unicode CJK Characters](https://www.unicode.org/charts/PDF/U4E00.pdf)