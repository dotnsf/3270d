/**
 * 3270d - TN3270 Server
 * Entry Point
 */
const logger = require('./logger');
const config = require('./config');
const TelnetServer = require('./network/telnet-server');
const PTYManager = require('./pty/pty-manager');

class Server3270d {
  constructor() {
    this.telnetServer = null;
    this.ptyManager = null;
    this.sessions = new Map();
  }

  /**
   * サーバーを起動
   */
  async start() {
    try {
      logger.info('Starting 3270d server...');
      logger.info(`Node.js version: ${process.version}`);
      logger.info(`Platform: ${process.platform}`);

      // PTY Managerを初期化
      this.ptyManager = new PTYManager();
      logger.info('PTY Manager initialized');

      // Telnet Serverを起動
      this.telnetServer = new TelnetServer();
      
      this.telnetServer.on('connection', (connection) => {
        this.handleConnection(connection);
      });

      this.telnetServer.on('error', (error) => {
        logger.error('Telnet server error:', error);
      });

      await this.telnetServer.start();

      logger.info('3270d server started successfully');
      logger.info(`Listening on ${config.get('server.host')}:${config.get('server.port')}`);

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * サーバーを停止
   */
  async stop() {
    logger.info('Stopping 3270d server...');

    // すべてのセッションをクローズ
    for (const session of this.sessions.values()) {
      if (session.pty) {
        this.ptyManager.destroyPTY(session.pty);
      }
      if (session.connection) {
        session.connection.close();
      }
    }
    this.sessions.clear();

    // PTY Managerをクリーンアップ
    if (this.ptyManager) {
      this.ptyManager.destroyAll();
    }

    // Telnet Serverを停止
    if (this.telnetServer) {
      await this.telnetServer.stop();
    }

    logger.info('3270d server stopped');
  }

  /**
   * 新しい接続を処理
   */
  async handleConnection(connection) {
    try {
      logger.info(`Handling connection: ${connection.id}`);

      // Telnetネゴシエーション
      const terminalType = await connection.negotiate();
      logger.info(`Terminal type negotiated: ${terminalType}`);

      // 簡易的なウェルカムメッセージを送信（Phase 1では3270プロトコルなし）
      const welcomeMessage = this.createWelcomeMessage();
      connection.send(welcomeMessage);

      // PTYを作成（Phase 1では認証なし）
      const pty = this.ptyManager.createPTY({
        cols: config.get('terminal.cols'),
        rows: config.get('terminal.rows')
      });

      // セッションを作成
      const session = {
        id: connection.id,
        connection,
        pty,
        createdAt: new Date()
      };
      this.sessions.set(connection.id, session);

      // PTY出力 → クライアント
      pty.onData((data) => {
        // Phase 1では生データをそのまま送信（3270変換なし）
        connection.send(data);
      });

      // クライアント入力 → PTY
      connection.on('data', (data) => {
        // Phase 1では生データをそのまま送信
        pty.write(data);
      });

      // PTY終了時
      pty.onExit((exitCode) => {
        logger.info(`PTY exited for connection ${connection.id}: exitCode=${exitCode}`);
        connection.close();
      });

      // 接続クローズ時
      connection.on('close', () => {
        this.sessions.delete(connection.id);
        if (pty) {
          this.ptyManager.destroyPTY(pty);
        }
      });

      logger.info(`Session established: ${connection.id}`);

    } catch (error) {
      logger.error(`Failed to handle connection ${connection.id}:`, error);
      connection.close();
    }
  }

  /**
   * ウェルカムメッセージを作成
   */
  createWelcomeMessage() {
    const message = [
      '\r\n',
      '╔════════════════════════════════════════════════════════════════════════════╗\r\n',
      '║                          3270d - TN3270 Server                             ║\r\n',
      '║                                                                            ║\r\n',
      '║  Welcome to the TN3270 Server for Linux Shell Access                      ║\r\n',
      '║                                                                            ║\r\n',
      '║  Phase 1: Basic Telnet + PTY (3270 protocol not yet implemented)          ║\r\n',
      '║                                                                            ║\r\n',
      '╚════════════════════════════════════════════════════════════════════════════╝\r\n',
      '\r\n'
    ].join('');

    return Buffer.from(message, 'utf8');
  }

  /**
   * アクティブなセッション数を取得
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }
}

// メイン処理
async function main() {
  const server = new Server3270d();

  // シグナルハンドラー
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  // 未処理の例外をキャッチ
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // サーバーを起動
  await server.start();
}

// エントリーポイント
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = Server3270d;
