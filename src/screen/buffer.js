/**
 * 3270 Screen Buffer
 * 3270画面バッファの管理
 */
const logger = require('../logger');
const japaneseHandler = require('../charset/japanese-handler');

class ScreenBuffer {
  /**
   * @param {number} rows - 行数（デフォルト: 24）
   * @param {number} cols - 列数（デフォルト: 80）
   */
  constructor(rows = 24, cols = 80) {
    this.rows = rows;
    this.cols = cols;
    this.buffer = this.createEmptyBuffer();
    this.cursor = { row: 0, col: 0 };
    this.fields = [];
    this.modified = false;
    this.japaneseHandler = japaneseHandler;
  }

  /**
   * 空のバッファを作成
   */
  createEmptyBuffer() {
    const buffer = [];
    for (let row = 0; row < this.rows; row++) {
      buffer[row] = [];
      for (let col = 0; col < this.cols; col++) {
        buffer[row][col] = {
          char: ' ',
          attr: this.getDefaultAttribute(),
          modified: false,
          isField: false,
          fieldAttr: null
        };
      }
    }
    return buffer;
  }

  /**
   * デフォルト属性
   */
  getDefaultAttribute() {
    return {
      fg: 'green',
      bg: 'black',
      bold: false,
      underline: false,
      reverse: false,
      blink: false
    };
  }

  /**
   * セルを取得
   * @param {number} row - 行
   * @param {number} col - 列
   * @returns {Object|null}
   */
  getCell(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.buffer[row][col];
    }
    return null;
  }

  /**
   * 文字を書き込み
   * @param {number} row - 行
   * @param {number} col - 列
   * @param {string} char - 文字
   * @param {Object} attr - 属性（オプション）
   */
  writeChar(row, col, char, attr = null) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.buffer[row][col].char = char;
      if (attr) {
        this.buffer[row][col].attr = { ...attr };
      }
      this.buffer[row][col].modified = true;
      this.modified = true;
    }
  }

  /**
   * 文字列を書き込み
   *
   * 全角文字を考慮して書き込みます。
   * 全角文字は2カラム分を占有します。
   *
   * @param {number} row - 行
   * @param {number} col - 列
   * @param {string} text - 文字列
   * @param {Object} attr - 属性（オプション）
   */
  writeString(row, col, text, attr = null) {
    let currentCol = col;
    
    for (const char of text) {
      // 改行処理
      if (char === '\n') {
        row++;
        currentCol = 0;
        if (row >= this.rows) break;
        continue;
      }
      
      // タブ処理（8カラム単位）
      if (char === '\t') {
        const nextTab = Math.floor((currentCol + 8) / 8) * 8;
        currentCol = Math.min(nextTab, this.cols);
        continue;
      }
      
      // 文字幅を取得
      const charWidth = this.japaneseHandler.getCharWidth(char);
      
      // 行末チェック
      if (currentCol + charWidth > this.cols) {
        // 全角文字が行末に収まらない場合は次の行へ
        row++;
        currentCol = 0;
        if (row >= this.rows) break;
      }
      
      // 文字を書き込み
      this.writeChar(row, currentCol, char, attr);
      
      // 全角文字の場合は2カラム目にマーカーを設定
      if (charWidth === 2) {
        if (currentCol + 1 < this.cols) {
          this.buffer[row][currentCol + 1].char = '';  // 2バイト目マーカー
          this.buffer[row][currentCol + 1].isDBCS = true;
          this.buffer[row][currentCol + 1].modified = true;
        }
      }
      
      currentCol += charWidth;
    }
  }

  /**
   * フィールドを定義
   * @param {number} row - 行
   * @param {number} col - 列
   * @param {number} length - 長さ
   * @param {Object} attr - フィールド属性
   */
  defineField(row, col, length, attr) {
    const field = {
      row,
      col,
      length,
      attr: { ...attr }
    };

    this.fields.push(field);

    // フィールドマーカーを設定
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.buffer[row][col].isField = true;
      this.buffer[row][col].fieldAttr = { ...attr };
    }
  }

  /**
   * 画面をクリア
   */
  clear() {
    this.buffer = this.createEmptyBuffer();
    this.cursor = { row: 0, col: 0 };
    this.fields = [];
    this.modified = true;
  }

  /**
   * 行をクリア
   * @param {number} row - 行
   */
  clearLine(row) {
    if (row >= 0 && row < this.rows) {
      for (let col = 0; col < this.cols; col++) {
        this.buffer[row][col] = {
          char: ' ',
          attr: this.getDefaultAttribute(),
          modified: true,
          isField: false,
          fieldAttr: null
        };
      }
      this.modified = true;
    }
  }

  /**
   * カーソル位置を設定
   * @param {number} row - 行
   * @param {number} col - 列
   */
  setCursor(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.cursor = { row, col };
    }
  }

  /**
   * カーソル位置を取得
   * @returns {Object} - {row, col}
   */
  getCursor() {
    return { ...this.cursor };
  }

  /**
   * カーソルを移動
   * @param {number} deltaRow - 行の移動量
   * @param {number} deltaCol - 列の移動量
   */
  moveCursor(deltaRow, deltaCol) {
    let newRow = this.cursor.row + deltaRow;
    let newCol = this.cursor.col + deltaCol;

    // 範囲チェック
    if (newRow < 0) newRow = 0;
    if (newRow >= this.rows) newRow = this.rows - 1;
    if (newCol < 0) newCol = 0;
    if (newCol >= this.cols) newCol = this.cols - 1;

    this.cursor = { row: newRow, col: newCol };
  }

  /**
   * 変更された領域を取得
   * @returns {Array<Object>} - 変更リスト
   */
  getModifiedRegions() {
    const regions = [];

    for (let row = 0; row < this.rows; row++) {
      let startCol = -1;
      let endCol = -1;

      for (let col = 0; col < this.cols; col++) {
        if (this.buffer[row][col].modified) {
          if (startCol === -1) {
            startCol = col;
          }
          endCol = col;
        } else if (startCol !== -1) {
          regions.push({
            row,
            startCol,
            endCol,
            data: this.buffer[row].slice(startCol, endCol + 1)
          });
          startCol = -1;
          endCol = -1;
        }
      }

      if (startCol !== -1) {
        regions.push({
          row,
          startCol,
          endCol,
          data: this.buffer[row].slice(startCol, endCol + 1)
        });
      }
    }

    return regions;
  }

  /**
   * 変更フラグをクリア
   */
  clearModified() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.buffer[row][col].modified = false;
      }
    }
    this.modified = false;
  }

  /**
   * バッファの内容を取得
   * @returns {Array<Array<Object>>} - 2次元配列
   */
  getContent() {
    return this.buffer.map(row => row.map(cell => ({ ...cell })));
  }

  /**
   * 行の内容を取得
   * @param {number} row - 行
   * @returns {string}
   */
  getLineText(row) {
    if (row >= 0 && row < this.rows) {
      return this.buffer[row].map(cell => cell.char).join('');
    }
    return '';
  }

  /**
   * 画面全体のテキストを取得
   * @returns {string}
   */
  getText() {
    return this.buffer.map(row =>
      row.map(cell => cell.char).join('')
    ).join('\n');
  }

  /**
   * スクロールアップ
   * @param {number} lines - スクロール行数
   */
  scrollUp(lines = 1) {
    for (let i = 0; i < lines; i++) {
      // 最初の行を削除
      this.buffer.shift();

      // 最後に空行を追加
      const newRow = [];
      for (let col = 0; col < this.cols; col++) {
        newRow[col] = {
          char: ' ',
          attr: this.getDefaultAttribute(),
          modified: true,
          isField: false,
          fieldAttr: null
        };
      }
      this.buffer.push(newRow);
    }
    this.modified = true;
  }

  /**
   * スクロールダウン
   * @param {number} lines - スクロール行数
   */
  scrollDown(lines = 1) {
    for (let i = 0; i < lines; i++) {
      // 最後の行を削除
      this.buffer.pop();

      // 最初に空行を追加
      const newRow = [];
      for (let col = 0; col < this.cols; col++) {
        newRow[col] = {
          char: ' ',
          attr: this.getDefaultAttribute(),
          modified: true,
          isField: false,
          fieldAttr: null
        };
      }
      this.buffer.unshift(newRow);
    }
    this.modified = true;
  }

  /**
   * バッファが変更されたか
   * @returns {boolean}
   */
  isModified() {
    return this.modified;
  }

  /**
   * バッファのサイズを変更
   * @param {number} rows - 新しい行数
   * @param {number} cols - 新しい列数
   */
  resize(rows, cols) {
    if (rows === this.rows && cols === this.cols) {
      return;
    }

    logger.info(`Resizing screen buffer from ${this.rows}x${this.cols} to ${rows}x${cols}`);

    const oldBuffer = this.buffer;
    this.rows = rows;
    this.cols = cols;
    this.buffer = this.createEmptyBuffer();

    // 既存の内容をコピー
    const copyRows = Math.min(oldBuffer.length, rows);
    for (let row = 0; row < copyRows; row++) {
      const copyCols = Math.min(oldBuffer[row].length, cols);
      for (let col = 0; col < copyCols; col++) {
        this.buffer[row][col] = { ...oldBuffer[row][col] };
      }
    }

    // カーソル位置を調整
    if (this.cursor.row >= rows) {
      this.cursor.row = rows - 1;
    }
    if (this.cursor.col >= cols) {
      this.cursor.col = cols - 1;
    }

    this.modified = true;
  }

  /**
   * デバッグ情報を出力
   */
  debug() {
    logger.debug('=== Screen Buffer Debug ===');
    logger.debug(`Size: ${this.rows}x${this.cols}`);
    logger.debug(`Cursor: (${this.cursor.row}, ${this.cursor.col})`);
    logger.debug(`Modified: ${this.modified}`);
    logger.debug(`Fields: ${this.fields.length}`);
    logger.debug('Content:');
    for (let row = 0; row < this.rows; row++) {
      const line = this.getLineText(row);
      if (line.trim().length > 0) {
        logger.debug(`  ${row}: ${line}`);
      }
    }
  }
}

module.exports = ScreenBuffer;
