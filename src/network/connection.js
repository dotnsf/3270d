/**
 * Connection
 * 個別の接続を管理
 */
const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('../logger');
const TelnetOptions = require('./telnet-options');
const TerminalHandler = require('../integration/terminal-handler');

class Connection extends EventEmitter {
  constructor(socket) {
    super();

    this.id = crypto.randomUUID();
    this.socket = socket;
    this.state = 'connecting';
    this.terminalType = null;
    this.options = new TelnetOptions();
    this.remoteAddress = socket.remoteAddress;
    this.remotePort = socket.remotePort;
    this.terminalHandler = null;

    this.setupSocket();
  }

  /**
   * ソケットのセットアップ
   */
  setupSocket() {
    this.socket.on('data', (data) => {
      this.handleData(data);
    });

    this.socket.on('close', () => {
      this.state = 'closed';
      logger.info(`Connection closed: ${this.id}`);
      this.emit('close');
    });

    this.socket.on('error', (error) => {
      logger.error(`Connection ${this.id} error:`, error);
      this.emit('error', error);
    });

    this.socket.on('timeout', () => {
      logger.warn(`Connection ${this.id} timeout`);
      this.close();
    });
  }

  /**
   * データ受信処理
   */
  handleData(data) {
    if (this.state === 'connecting' || this.state === 'negotiating') {
      // Telnetネゴシエーション中
      this.options.process(data, (response) => {
        if (response) {
          this.socket.write(response);
        }
      });

      if (this.options.isNegotiationComplete()) {
        this.terminalType = this.options.getTerminalType();
        this.state = 'negotiated';
        logger.info(`Negotiation complete for ${this.id}: ${this.terminalType}`);
        this.emit('negotiated', this.terminalType);
      }
    } else if (this.state === 'negotiated') {
      // ネゴシエーション完了後、ready状態になるまでデータを無視
      logger.debug(`Ignoring data in negotiated state for ${this.id}`);
    } else if (this.state === 'ready' || this.state === 'authenticated') {
      // Telnetコマンド（IAC）をチェック
      if (data.length > 0 && data[0] === 0xFF) {
        // Telnetネゴシエーションまたはサブネゴシエーション
        logger.debug(`Received Telnet command in ready state for ${this.id}, processing`);
        this.options.process(data, (response) => {
          if (response) {
            this.socket.write(response);
          }
        });
      } else {
        // 3270データストリーム - ターミナルハンドラーにデータを渡す
        if (this.terminalHandler) {
          this.terminalHandler.handleData(data).then((response) => {
            if (response) {
              this.write(response);
            }
          }).catch((error) => {
            logger.error(`Error handling terminal data for ${this.id}:`, error);
          });
        }
      }
    } else {
      // 通常のデータ
      this.emit('data', data);
    }
  }

  /**
   * Telnetネゴシエーションを開始
   */
  async negotiate() {
    this.state = 'negotiating';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Negotiation timeout'));
      }, 30000);

      this.once('negotiated', (terminalType) => {
        clearTimeout(timeout);
        resolve(terminalType);
      });

      this.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Terminal Typeをリクエスト
      this.options.requestTerminalType(this.socket);

      // Binary Modeをリクエスト
      this.options.requestBinaryMode(this.socket);

      // EORをリクエスト
      this.options.requestEOR(this.socket);
    });
  }

  /**
   * ターミナルセッションを開始
   */
  async startTerminal() {
    if (this.state !== 'negotiated') {
      throw new Error('Cannot start terminal before negotiation is complete');
    }

    logger.info(`Starting terminal session for ${this.id}`);
    
    // ターミナルハンドラーを作成
    this.terminalHandler = new TerminalHandler(this);
    
    // ターミナルセッションを開始
    const initialScreen = await this.terminalHandler.start();
    
    this.state = 'ready';
    
    // 初期画面を送信
    this.write(initialScreen);
    
    logger.info(`Terminal session started for ${this.id}`);
  }

  /**
   * データ送信
   */
  send(data) {
    if (this.state !== 'closed') {
      this.socket.write(data);
    }
  }

  /**
   * データ書き込み（sendのエイリアス）
   */
  write(data) {
    this.send(data);
  }

  /**
   * 接続をクローズ
   */
  close() {
    if (this.state !== 'closed') {
      logger.info(`Closing connection ${this.id}`);
      
      // ターミナルハンドラーをクリーンアップ
      if (this.terminalHandler) {
        this.terminalHandler.cleanup();
        this.terminalHandler = null;
      }
      
      this.socket.end();
      this.state = 'closed';
    }
  }

  /**
   * 接続状態を取得
   */
  getState() {
    return this.state;
  }

  /**
   * 状態を設定
   */
  setState(state) {
    this.state = state;
  }

  /**
   * リモートアドレスを取得
   */
  getRemoteAddress() {
    return this.remoteAddress;
  }

  /**
   * リモートポートを取得
   */
  getRemotePort() {
    return this.remotePort;
  }

  /**
   * 端末タイプを取得
   */
  getTerminalType() {
    return this.terminalType;
  }
}

module.exports = Connection;

// Made with Bob
