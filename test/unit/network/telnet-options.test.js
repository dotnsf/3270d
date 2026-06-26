/**
 * Telnet Options Test
 */
const TelnetOptions = require('../../../src/network/telnet-options');

// TelnetコマンチE
const IAC = 255;
const WILL = 251;
const WONT = 252;
const DO = 253;
const DONT = 254;
const SB = 250;
const SE = 240;

// Telnetオプション
const BINARY = 0;
const TERMINAL_TYPE = 24;
const EOR = 25;

describe('TelnetOptions', () => {
  let options;

  beforeEach(() => {
    options = new TelnetOptions();
  });

  describe('Terminal Type Negotiation', () => {
    test('should respond to WILL TERMINAL-TYPE', () => {
      const data = Buffer.from([IAC, WILL, TERMINAL_TYPE]);
      let response = null;

      options.process(data, (res) => {
        response = res;
      });

      expect(response).not.toBeNull();
      expect(response).toEqual(Buffer.from([IAC, DO, TERMINAL_TYPE]));
    });

    test('should parse terminal type from subnegotiation', () => {
      const termType = 'IBM-3279-2-E';
      const data = Buffer.from([
        IAC, SB, TERMINAL_TYPE, 0,
        ...Buffer.from(termType, 'ascii'),
        IAC, SE
      ]);

      options.process(data, () => {});

      expect(options.getTerminalType()).toBe(termType);
    });
  });

  describe('Binary Mode Negotiation', () => {
    test('should respond to WILL BINARY', () => {
      const data = Buffer.from([IAC, WILL, BINARY]);
      let response = null;

      options.process(data, (res) => {
        response = res;
      });

      expect(response).not.toBeNull();
      expect(response).toEqual(Buffer.from([IAC, DO, BINARY]));
      expect(options.binaryMode).toBe(true);
    });

    test('should respond to DO BINARY', () => {
      const data = Buffer.from([IAC, DO, BINARY]);
      let response = null;

      options.process(data, (res) => {
        response = res;
      });

      expect(response).not.toBeNull();
      expect(response).toEqual(Buffer.from([IAC, WILL, BINARY]));
    });
  });

  describe('EOR Negotiation', () => {
    test('should respond to WILL EOR', () => {
      const data = Buffer.from([IAC, WILL, EOR]);
      let response = null;

      options.process(data, (res) => {
        response = res;
      });

      expect(response).not.toBeNull();
      expect(response).toEqual(Buffer.from([IAC, DO, EOR]));
      expect(options.eor).toBe(true);
    });

    test('should respond to DO EOR', () => {
      const data = Buffer.from([IAC, DO, EOR]);
      let response = null;

      options.process(data, (res) => {
        response = res;
      });

      expect(response).not.toBeNull();
      expect(response).toEqual(Buffer.from([IAC, WILL, EOR]));
    });
  });

  describe('Negotiation Complete', () => {
    test('should mark negotiation complete when all options are set', () => {
      // Terminal Type
      const termTypeData = Buffer.from([
        IAC, SB, TERMINAL_TYPE, 0,
        ...Buffer.from('IBM-3279-2-E', 'ascii'),
        IAC, SE
      ]);
      options.process(termTypeData, () => {});

      // Binary Mode
      const binaryData = Buffer.from([IAC, WILL, BINARY]);
      options.process(binaryData, () => {});

      // EOR
      const eorData = Buffer.from([IAC, WILL, EOR]);
      options.process(eorData, () => {});

      expect(options.isNegotiationComplete()).toBe(true);
    });

    test('should not mark complete if terminal type is missing', () => {
      // Binary Mode
      const binaryData = Buffer.from([IAC, WILL, BINARY]);
      options.process(binaryData, () => {});

      // EOR
      const eorData = Buffer.from([IAC, WILL, EOR]);
      options.process(eorData, () => {});

      expect(options.isNegotiationComplete()).toBe(false);
    });
  });

  describe('Buffer Handling', () => {
    test('should handle incomplete commands', () => {
      const data = Buffer.from([IAC]);
      let response = null;

      options.process(data, (res) => {
        response = res;
      });

      expect(response).toBeNull();
      expect(options.buffer.length).toBe(1);
    });

    test('should handle multiple commands in one buffer', () => {
      const data = Buffer.from([
        IAC, WILL, BINARY,
        IAC, WILL, EOR
      ]);
      const responses = [];

      options.process(data, (res) => {
        if (res) responses.push(res);
      });

      expect(responses.length).toBe(2);
    });
  });

  describe('Command Names', () => {
    test('should return correct command names', () => {
      expect(options.commandName(WILL)).toBe('WILL');
      expect(options.commandName(WONT)).toBe('WONT');
      expect(options.commandName(DO)).toBe('DO');
      expect(options.commandName(DONT)).toBe('DONT');
    });

    test('should return UNKNOWN for invalid commands', () => {
      expect(options.commandName(999)).toContain('UNKNOWN');
    });
  });

  describe('Option Names', () => {
    test('should return correct option names', () => {
      expect(options.optionName(BINARY)).toBe('BINARY');
      expect(options.optionName(TERMINAL_TYPE)).toBe('TERMINAL-TYPE');
      expect(options.optionName(EOR)).toBe('EOR');
    });

    test('should return UNKNOWN for invalid options', () => {
      expect(options.optionName(999)).toContain('UNKNOWN');
    });
  });
});

