/**
 * Telnet Options Handler
 * Telnetオプションのネゴシエーション処理
 */
const logger = require('../logger');

// Telnetコマンド
const IAC = 255;   // Interpret As Command
const WILL = 251;  // Will
const WONT = 252;  // Won't
const DO = 253;    // Do
const DONT = 254;  // Don't
const SB = 250;    // Subnegotiation Begin
const SE = 240;    // Subnegotiation End

// Telnetオプション
const BINARY = 0;           // Binary Transmission
const ECHO = 1;             // Echo
const SGA = 3;              // Suppress Go Ahead
const TERMINAL_TYPE = 24;   // Terminal Type
const EOR = 25;             // End of Record

class TelnetOptions {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.terminalType = null;
    this.binaryMode = false;
    this.eor = false;
    this.negotiationComplete = false;
  }

  /**
   * データを処理
   */
  process(data, callback) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length > 0) {
      const result = this.parseCommand();

      if (result === null) {
        // 不完全なコマンド
        break;
      }

      if (result.response) {
        callback(result.response);
      }
    }
  }

  /**
   * コマンドをパース
   */
  parseCommand() {
    if (this.buffer.length < 2) {
      return null;
    }

    if (this.buffer[0] !== IAC) {
      // IAC以外のデータは無視
      this.buffer = this.buffer.slice(1);
      return { response: null };
    }

    const command = this.buffer[1];

    if (command === SB) {
      // Subnegotiation
      return this.parseSubnegotiation();
    } else if (command === WILL || command === WONT || command === DO || command === DONT) {
      if (this.buffer.length < 3) {
        return null;
      }

      const option = this.buffer[2];
      this.buffer = this.buffer.slice(3);

      return this.handleOption(command, option);
    } else {
      // その他のコマンド
      this.buffer = this.buffer.slice(2);
      return { response: null };
    }
  }

  /**
   * Subnegotiationをパース
   */
  parseSubnegotiation() {
    // IAC SE を探す
    let endIndex = -1;
    for (let i = 2; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === IAC && this.buffer[i + 1] === SE) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return null;
    }

    const option = this.buffer[2];
    const data = this.buffer.slice(3, endIndex);
    this.buffer = this.buffer.slice(endIndex + 2);

    return this.handleSubnegotiation(option, data);
  }

  /**
   * オプションを処理
   */
  handleOption(command, option) {
    logger.debug(`Telnet: ${this.commandName(command)} ${this.optionName(option)}`);

    if (command === WILL) {
      if (option === TERMINAL_TYPE) {
        // Terminal Typeを受け入れる
        return { response: Buffer.from([IAC, DO, TERMINAL_TYPE]) };
      } else if (option === BINARY) {
        this.binaryMode = true;
        this.checkNegotiationComplete();
        return { response: Buffer.from([IAC, DO, BINARY]) };
      } else if (option === EOR) {
        this.eor = true;
        this.checkNegotiationComplete();
        return { response: Buffer.from([IAC, DO, EOR]) };
      }
    } else if (command === DO) {
      if (option === BINARY) {
        this.binaryMode = true;
        this.checkNegotiationComplete();
        return { response: Buffer.from([IAC, WILL, BINARY]) };
      } else if (option === EOR) {
        return { response: Buffer.from([IAC, WILL, EOR]) };
      } else if (option === ECHO) {
        // Echoは拒否
        return { response: Buffer.from([IAC, WONT, ECHO]) };
      } else if (option === SGA) {
        // Suppress Go Aheadを受け入れる
        return { response: Buffer.from([IAC, WILL, SGA]) };
      }
    }

    return { response: null };
  }

  /**
   * Subnegotiationを処理
   */
  handleSubnegotiation(option, data) {
    if (option === TERMINAL_TYPE && data.length > 0) {
      if (data[0] === 0) {
        // IS
        this.terminalType = data.slice(1).toString('ascii');
        logger.info(`Terminal type: ${this.terminalType}`);
        this.checkNegotiationComplete();
      }
    }

    return { response: null };
  }

  /**
   * ネゴシエーション完了をチェック
   */
  checkNegotiationComplete() {
    if (this.terminalType && this.binaryMode && this.eor) {
      this.negotiationComplete = true;
    }
  }

  /**
   * Terminal Typeをリクエスト
   */
  requestTerminalType(socket) {
    socket.write(Buffer.from([IAC, DO, TERMINAL_TYPE]));

    // SEND subnegotiation
    setTimeout(() => {
      socket.write(Buffer.from([IAC, SB, TERMINAL_TYPE, 1, IAC, SE]));
    }, 100);
  }

  /**
   * Binary Modeをリクエスト
   */
  requestBinaryMode(socket) {
    socket.write(Buffer.from([IAC, WILL, BINARY]));
    socket.write(Buffer.from([IAC, DO, BINARY]));
  }

  /**
   * EORをリクエスト
   */
  requestEOR(socket) {
    socket.write(Buffer.from([IAC, WILL, EOR]));
  }

  /**
   * ネゴシエーションが完了したか
   */
  isNegotiationComplete() {
    return this.negotiationComplete;
  }

  /**
   * Terminal Typeを取得
   */
  getTerminalType() {
    return this.terminalType;
  }

  /**
   * コマンド名を取得
   */
  commandName(command) {
    const names = {
      [WILL]: 'WILL',
      [WONT]: 'WONT',
      [DO]: 'DO',
      [DONT]: 'DONT'
    };
    return names[command] || `UNKNOWN(${command})`;
  }

  /**
   * オプション名を取得
   */
  optionName(option) {
    const names = {
      [BINARY]: 'BINARY',
      [ECHO]: 'ECHO',
      [SGA]: 'SGA',
      [TERMINAL_TYPE]: 'TERMINAL-TYPE',
      [EOR]: 'EOR'
    };
    return names[option] || `UNKNOWN(${option})`;
  }
}

module.exports = TelnetOptions;

// Made with Bob
