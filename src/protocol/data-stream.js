/**
 * 3270 Data Stream Definitions
 * 3270チE�Eタストリームの定義
 */

// コマンチE
const Commands = {
  W: 0x01,      // Write
  EW: 0x05,     // Erase/Write
  EWA: 0x0D,    // Erase/Write Alternate
  EAU: 0x0F,    // Erase All Unprotected
  RB: 0x02,     // Read Buffer
  RM: 0x06,     // Read Modified
  RMA: 0x0E,    // Read Modified All
  WSF: 0x11,    // Write Structured Field
  NOP: 0x03     // No Operation
};

// WCC (Write Control Character)
const WCC = {
  RESET: 0x40,           // Reset (bit 6)
  RESET_MDT: 0x01,       // Reset MDT (bit 0)
  RESTORE_KEYBOARD: 0x02, // Restore Keyboard (bit 1)
  SOUND_ALARM: 0x04,     // Sound Alarm (bit 2)
  UNLOCK_KEYBOARD: 0x02, // Unlock Keyboard (bit 1)
  RESET_PARTITION: 0x20  // Reset Partition (bit 5)
};

// オーダー (Orders)
const Orders = {
  SF: 0x1D,     // Start Field
  SFE: 0x29,    // Start Field Extended
  SBA: 0x11,    // Set Buffer Address
  SA: 0x28,     // Set Attribute
  MF: 0x2C,     // Modify Field
  IC: 0x13,     // Insert Cursor
  PT: 0x05,     // Program Tab
  RA: 0x3C,     // Repeat to Address
  EUA: 0x12,    // Erase Unprotected to Address
  GE: 0x08      // Graphic Escape
};

// AID (Attention Identifier)
const AID = {
  NONE: 0x60,
  ENTER: 0x7D,
  PF1: 0xF1,
  PF2: 0xF2,
  PF3: 0xF3,
  PF4: 0xF4,
  PF5: 0xF5,
  PF6: 0xF6,
  PF7: 0xF7,
  PF8: 0xF8,
  PF9: 0xF9,
  PF10: 0x7A,
  PF11: 0x7B,
  PF12: 0x7C,
  PF13: 0xC1,
  PF14: 0xC2,
  PF15: 0xC3,
  PF16: 0xC4,
  PF17: 0xC5,
  PF18: 0xC6,
  PF19: 0xC7,
  PF20: 0xC8,
  PF21: 0xC9,
  PF22: 0x4A,
  PF23: 0x4B,
  PF24: 0x4C,
  PA1: 0x6C,
  PA2: 0x6E,
  PA3: 0x6B,
  CLEAR: 0x6D,
  SELECT: 0x7E
};

// 拡張属性
const ExtendedAttributes = {
  ALL: 0x00,
  HIGHLIGHTING: 0x41,
  COLOR: 0x42,
  CHARSET: 0x43,
  FIELD_OUTLINING: 0x44,
  TRANSPARENCY: 0x45,
  FIELD_VALIDATION: 0x46
};

// カラー
const Colors = {
  DEFAULT: 0x00,
  BLUE: 0xF1,
  RED: 0xF2,
  PINK: 0xF3,
  GREEN: 0xF4,
  TURQUOISE: 0xF5,
  YELLOW: 0xF6,
  WHITE: 0xF7
};

// ハイライチE
const Highlighting = {
  DEFAULT: 0x00,
  NORMAL: 0xF0,
  BLINK: 0xF1,
  REVERSE: 0xF2,
  UNDERSCORE: 0xF4
};

/**
 * コマンド名を取征E
 */
function getCommandName(command) {
  const names = {
    [Commands.W]: 'Write',
    [Commands.EW]: 'Erase/Write',
    [Commands.EWA]: 'Erase/Write Alternate',
    [Commands.EAU]: 'Erase All Unprotected',
    [Commands.RB]: 'Read Buffer',
    [Commands.RM]: 'Read Modified',
    [Commands.RMA]: 'Read Modified All',
    [Commands.WSF]: 'Write Structured Field',
    [Commands.NOP]: 'No Operation'
  };
  return names[command] || `Unknown(0x${command.toString(16)})`;
}

/**
 * オーダー名を取征E
 */
function getOrderName(order) {
  const names = {
    [Orders.SF]: 'Start Field',
    [Orders.SFE]: 'Start Field Extended',
    [Orders.SBA]: 'Set Buffer Address',
    [Orders.SA]: 'Set Attribute',
    [Orders.MF]: 'Modify Field',
    [Orders.IC]: 'Insert Cursor',
    [Orders.PT]: 'Program Tab',
    [Orders.RA]: 'Repeat to Address',
    [Orders.EUA]: 'Erase Unprotected to Address',
    [Orders.GE]: 'Graphic Escape'
  };
  return names[order] || `Unknown(0x${order.toString(16)})`;
}

/**
 * AID名を取征E
 */
function getAIDName(aid) {
  const names = {
    [AID.NONE]: 'None',
    [AID.ENTER]: 'Enter',
    [AID.CLEAR]: 'Clear',
    [AID.PA1]: 'PA1',
    [AID.PA2]: 'PA2',
    [AID.PA3]: 'PA3'
  };
  
  // PFキー
  for (let i = 1; i <= 24; i++) {
    const key = `PF${i}`;
    if (AID[key] === aid) {
      return key;
    }
  }
  
  return names[aid] || `Unknown(0x${aid.toString(16)})`;
}

/**
 * オーダーかどぁE��を判宁E
 */
function isOrder(byte) {
  return Object.values(Orders).includes(byte);
}

/**
 * コマンドかどぁE��を判宁E
 */
function isCommand(byte) {
  return Object.values(Commands).includes(byte);
}

module.exports = {
  Commands,
  WCC,
  Orders,
  AID,
  ExtendedAttributes,
  Colors,
  Highlighting,
  getCommandName,
  getOrderName,
  getAIDName,
  isOrder,
  isCommand
};

