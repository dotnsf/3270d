/**
 * Connection
 * 蛟句挨縺ｮ謗･邯壹ｒ邂｡逅・
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
   * 繧ｽ繧ｱ繝・ヨ縺ｮ繧ｻ繝・ヨ繧｢繝・・
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
   * 繝・・繧ｿ蜿嶺ｿ｡蜃ｦ逅・
   */
  handleData(data) {
    if (this.state === 'connecting' || this.state === 'negotiating') {
      // Telnet繝阪ざ繧ｷ繧ｨ繝ｼ繧ｷ繝ｧ繝ｳ荳ｭ
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
      // 繝阪ざ繧ｷ繧ｨ繝ｼ繧ｷ繝ｧ繝ｳ螳御ｺ・ｾ後〉eady迥ｶ諷九↓縺ｪ繧九∪縺ｧ繝・・繧ｿ繧堤┌隕・
      logger.debug(`Ignoring data in negotiated state for ${this.id}`);
    } else if (this.state === 'ready' || this.state === 'authenticated') {
      // Telnet繧ｳ繝槭Φ繝会ｼ・AC・峨ｒ繝√ぉ繝・け
      if (data.length > 0 && data[0] === 0xFF) {
        // Telnet繝阪ざ繧ｷ繧ｨ繝ｼ繧ｷ繝ｧ繝ｳ縺ｾ縺溘・繧ｵ繝悶ロ繧ｴ繧ｷ繧ｨ繝ｼ繧ｷ繝ｧ繝ｳ
        logger.debug(`Received Telnet command in ready state for ${this.id}, processing`);
        this.options.process(data, (response) => {
          if (response) {
            this.socket.write(response);
          }
        });
      } else {
        // 3270繝・・繧ｿ繧ｹ繝医Μ繝ｼ繝 - 繧ｿ繝ｼ繝溘リ繝ｫ繝上Φ繝峨Λ繝ｼ縺ｫ繝・・繧ｿ繧呈ｸ｡縺・
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
      // 騾壼ｸｸ縺ｮ繝・・繧ｿ
      this.emit('data', data);
    }
  }

  /**
   * Telnet繝阪ざ繧ｷ繧ｨ繝ｼ繧ｷ繝ｧ繝ｳ繧帝幕蟋・
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

      // Terminal Type繧偵Μ繧ｯ繧ｨ繧ｹ繝・
      this.options.requestTerminalType(this.socket);

      // Binary Mode繧偵Μ繧ｯ繧ｨ繧ｹ繝・
      this.options.requestBinaryMode(this.socket);

      // EOR繧偵Μ繧ｯ繧ｨ繧ｹ繝・
      this.options.requestEOR(this.socket);
    });
  }

  /**
   * 繧ｿ繝ｼ繝溘リ繝ｫ繧ｻ繝・す繝ｧ繝ｳ繧帝幕蟋・
   */
  async startTerminal() {
    if (this.state !== 'negotiated') {
      throw new Error('Cannot start terminal before negotiation is complete');
    }

    logger.info(`Starting terminal session for ${this.id}`);
    
    // 繧ｿ繝ｼ繝溘リ繝ｫ繝上Φ繝峨Λ繝ｼ繧剃ｽ懈・
    this.terminalHandler = new TerminalHandler(this);
    
    // 繧ｿ繝ｼ繝溘リ繝ｫ繧ｻ繝・す繝ｧ繝ｳ繧帝幕蟋・
    const initialScreen = await this.terminalHandler.start();
    
    this.state = 'ready';
    
    // 蛻晄悄逕ｻ髱｢繧帝∽ｿ｡
    this.write(initialScreen);
    
    logger.info(`Terminal session started for ${this.id}`);
  }

  /**
   * 繝・・繧ｿ騾∽ｿ｡
   */
  send(data) {
    if (this.state !== 'closed') {
      this.socket.write(data);
    }
  }

  /**
   * 繝・・繧ｿ譖ｸ縺崎ｾｼ縺ｿ・・end縺ｮ繧ｨ繧､繝ｪ繧｢繧ｹ・・
   */
  write(data) {
    this.send(data);
  }

  /**
   * 謗･邯壹ｒ繧ｯ繝ｭ繝ｼ繧ｺ
   */
  close() {
    if (this.state !== 'closed') {
      logger.info(`Closing connection ${this.id}`);
      
      // 繧ｿ繝ｼ繝溘リ繝ｫ繝上Φ繝峨Λ繝ｼ繧偵け繝ｪ繝ｼ繝ｳ繧｢繝・・
      if (this.terminalHandler) {
        this.terminalHandler.cleanup();
        this.terminalHandler = null;
      }
      
      this.socket.end();
      this.state = 'closed';
    }
  }

  /**
   * 謗･邯夂憾諷九ｒ蜿門ｾ・
   */
  getState() {
    return this.state;
  }

  /**
   * 迥ｶ諷九ｒ險ｭ螳・
   */
  setState(state) {
    this.state = state;
  }

  /**
   * 繝ｪ繝｢繝ｼ繝医い繝峨Ξ繧ｹ繧貞叙蠕・
   */
  getRemoteAddress() {
    return this.remoteAddress;
  }

  /**
   * 繝ｪ繝｢繝ｼ繝医・繝ｼ繝医ｒ蜿門ｾ・
   */
  getRemotePort() {
    return this.remotePort;
  }

  /**
   * 遶ｯ譛ｫ繧ｿ繧､繝励ｒ蜿門ｾ・
   */
  getTerminalType() {
    return this.terminalType;
  }
}

module.exports = Connection;

