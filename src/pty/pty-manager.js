/**
 * PTY Manager
 * 疑似端末の管理とシェルプロセス制御
 */
const pty = require('node-pty');
const logger = require('../logger');
const config = require('../config');

class PTYManager {
  constructor() {
    this.ptys = new Map();
  }

  /**
   * PTYを作成
   */
  createPTY(options = {}) {
    const ptyOptions = {
      name: 'xterm-256color',
      cols: options.cols || config.get('terminal.cols') || 80,
      rows: options.rows || config.get('terminal.rows') || 24,
      cwd: options.cwd || process.env.HOME || '/tmp',
      env: {
        ...process.env,
        ...config.get('pty.env'),
        ...options.env
      }
    };

    // ユーザーコンテキストが指定されている場合
    if (options.uid !== undefined) {
      ptyOptions.uid = options.uid;
    }
    if (options.gid !== undefined) {
      ptyOptions.gid = options.gid;
    }

    const shell = options.shell || config.get('pty.shell') || '/bin/bash';

    try {
      const ptyProcess = pty.spawn(shell, [], ptyOptions);

      const ptyWrapper = new PTY(ptyProcess, ptyOptions);
      this.ptys.set(ptyWrapper.pid, ptyWrapper);

      logger.info(`PTY created: PID=${ptyWrapper.pid}, shell=${shell}`);

      ptyWrapper.on('exit', () => {
        this.ptys.delete(ptyWrapper.pid);
        logger.info(`PTY removed: PID=${ptyWrapper.pid}`);
      });

      return ptyWrapper;
    } catch (error) {
      logger.error('Failed to create PTY:', error);
      throw error;
    }
  }

  /**
   * PTYを破棄
   */
  destroyPTY(pty) {
    if (pty && pty.pid) {
      this.ptys.delete(pty.pid);
      pty.close();
    }
  }

  /**
   * すべてのPTYを破棄
   */
  destroyAll() {
    for (const pty of this.ptys.values()) {
      pty.close();
    }
    this.ptys.clear();
  }

  /**
   * アクティブなPTY数を取得
   */
  getActivePTYCount() {
    return this.ptys.size;
  }
}

/**
 * PTY Wrapper
 */
class PTY {
  constructor(ptyProcess, options) {
    this.ptyProcess = ptyProcess;
    this.pid = ptyProcess.pid;
    this.options = options;
    this.dataHandlers = [];
    this.exitHandlers = [];

    this.setupHandlers();
  }

  /**
   * イベントハンドラーをセットアップ
   */
  setupHandlers() {
    this.ptyProcess.onData((data) => {
      for (const handler of this.dataHandlers) {
        handler(data);
      }
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      logger.info(`PTY exited: PID=${this.pid}, exitCode=${exitCode}, signal=${signal}`);
      for (const handler of this.exitHandlers) {
        handler(exitCode, signal);
      }
    });
  }

  /**
   * データを書き込み
   */
  write(data) {
    try {
      this.ptyProcess.write(data);
    } catch (error) {
      logger.error(`Failed to write to PTY ${this.pid}:`, error);
      throw error;
    }
  }

  /**
   * データ受信イベント
   */
  onData(handler) {
    this.dataHandlers.push(handler);
  }

  /**
   * プロセス終了イベント
   */
  onExit(handler) {
    this.exitHandlers.push(handler);
  }

  /**
   * サイズ変更
   */
  resize(cols, rows) {
    try {
      this.ptyProcess.resize(cols, rows);
      this.options.cols = cols;
      this.options.rows = rows;
      logger.debug(`PTY ${this.pid} resized to ${cols}x${rows}`);
    } catch (error) {
      logger.error(`Failed to resize PTY ${this.pid}:`, error);
      throw error;
    }
  }

  /**
   * PTYをクローズ
   */
  close() {
    try {
      this.ptyProcess.kill();
      logger.info(`PTY ${this.pid} closed`);
    } catch (error) {
      logger.error(`Failed to close PTY ${this.pid}:`, error);
    }
  }

  /**
   * PTYが実行中か
   */
  isRunning() {
    // node-ptyにはisRunningメソッドがないため、プロセスの存在をチェック
    try {
      process.kill(this.pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = PTYManager;
module.exports.PTY = PTY;

// Made with Bob
