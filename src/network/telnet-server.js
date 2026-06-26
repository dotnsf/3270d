/**
 * Telnet Server
 * TCP接続を受け付け、Telnetプロトコルのネゴシエーションを行う
 */
const net = require('net');
const EventEmitter = require('events');
const logger = require('../logger');
const config = require('../config');
const Connection = require('./connection');

class TelnetServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      port: options.port || config.get('server.port') || 23000,
      host: options.host || config.get('server.host') || '0.0.0.0',
      maxConnections: options.maxConnections || config.get('server.maxConnections') || 2,
      ...options
    };

    this.server = null;
    this.connections = new Map();
  }

  /**
   * サーバ�Eを起勁E
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (error) => {
        logger.error('Server error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        logger.info(`TN3270 server listening on ${this.options.host}:${this.options.port}`);
        logger.info(`Max connections: ${this.options.maxConnections}`);
        resolve();
      });
    });
  }

  /**
   * サーバ�Eを停止
   */
  async stop() {
    return new Promise((resolve) => {
      // すべての接続をクローズ
      for (const connection of this.connections.values()) {
        connection.close();
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('TN3270 server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 新しい接続を処琁E
   */
  handleConnection(socket) {
    // 最大接続数チェチE��
    if (this.connections.size >= this.options.maxConnections) {
      logger.warn(`Max connections (${this.options.maxConnections}) reached, rejecting connection from ${socket.remoteAddress}`);
      socket.end();
      return;
    }

    const connection = new Connection(socket);
    this.connections.set(connection.id, connection);

    logger.info(`New connection: ${connection.id} from ${socket.remoteAddress}:${socket.remotePort}`);
    logger.info(`Active connections: ${this.connections.size}/${this.options.maxConnections}`);

    connection.on('close', () => {
      this.connections.delete(connection.id);
      logger.info(`Connection removed: ${connection.id}`);
      logger.info(`Active connections: ${this.connections.size}/${this.options.maxConnections}`);
    });

    connection.on('error', (error) => {
      logger.error(`Connection ${connection.id} error:`, error);
    });

    // ネゴシエーション完亁E��にターミナルセチE��ョンを開姁E
    connection.on('negotiated', async (terminalType) => {
      try {
        logger.info(`Starting terminal session for ${connection.id} (${terminalType})`);
        await connection.startTerminal();
      } catch (error) {
        logger.error(`Failed to start terminal session for ${connection.id}:`, error);
        connection.close();
      }
    });

    // Telnetネゴシエーションを開姁E
    connection.negotiate().catch((error) => {
      logger.error(`Negotiation failed for ${connection.id}:`, error);
      connection.close();
    });

    this.emit('connection', connection);
  }

  /**
   * アクチE��ブな接続数を取征E
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * すべての接続を取征E
   */
  getConnections() {
    return Array.from(this.connections.values());
  }

  /**
   * 接続を取征E
   */
  getConnection(id) {
    return this.connections.get(id);
  }
}

module.exports = TelnetServer;

