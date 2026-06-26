/**
 * Logger
 * Winstonを使用したロギング
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// ログディレクトリを作成
const logFile = config.get('logging.file') || '/var/log/3270d/server.log';
const logDir = path.dirname(logFile);

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    // ディレクトリ作成に失敗した場合はカレントディレクトリに出力
    console.warn(`Failed to create log directory: ${logDir}, using ./logs instead`);
  }
}

// ログフォーマット
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// コンソール用フォーマット
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Loggerを作成
const logger = winston.createLogger({
  level: config.get('logging.level') || 'info',
  format: logFormat,
  transports: [
    // ファイル出力
    new winston.transports.File({
      filename: logFile,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // コンソール出力
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ]
});

// 開発環境では詳細ログを出力
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

// LOG_LEVEL環境変数でログレベルを上書き
if (process.env.LOG_LEVEL) {
  logger.level = process.env.LOG_LEVEL;
}

module.exports = logger;

// Made with Bob
