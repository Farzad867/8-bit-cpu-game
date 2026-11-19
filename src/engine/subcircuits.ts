import { BitWidth, CircuitGraph, CircuitNode, ComponentType, Wire } from '../types';

let wSeq = 1;
const wire = (fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): Wire => ({
  id: `sw_${wSeq++}`,
  fromNodeId,
  fromPinId,
  toNodeId,
  toPinId,
});

const portIn = (id: string, portName: string, x: number, y: number, bitWidth: BitWidth = 1): CircuitNode => ({
  id,
  type: 'PORT_IN',
  portName,
  bitWidth,
  label: portName,
  x,
  y,
  locked: true,
});

const portOut = (id: string, portName: string, x: number, y: number, bitWidth: BitWidth = 1): CircuitNode => ({
  id,
  type: 'PORT_OUT',
  portName,
  bitWidth,
  label: portName,
  x,
  y,
  locked: true,
});

const n = (id: string, type: ComponentType, x: number, y: number, extra?: Partial<CircuitNode>): CircuitNode => ({
  id,
  type,
  x,
  y,
  ...extra,
});

function buildBitwise8(innerGate: 'NOT' | 'AND' | 'OR'): CircuitGraph {
  const nodes: CircuitNode[] = [portIn('inA', 'A', 20, 120, 8), n('spA', 'SPLITTER_8', 170, 80)];
  const wires: Wire[] = [wire('inA', 'OUT', 'spA', 'IN')];

  if (innerGate !== 'NOT') {
    nodes.push(portIn('inB', 'B', 20, 380, 8), n('spB', 'SPLITTER_8', 170, 330));
    wires.push(wire('inB', 'OUT', 'spB', 'IN'));
  }
  nodes.push(n('mg', 'MERGER_8', 540, 200), portOut('outY', 'Y', 700, 270, 8));
  wires.push(wire('mg', 'OUT', 'outY', 'IN'));

  for (let i = 0; i < 8; i++) {
    const gid = `g${i}`;
    nodes.push(n(gid, innerGate, 355, 20 + i * 74));
    wires.push(wire('spA', `B${i}`, gid, 'A'));
    if (innerGate !== 'NOT') {
      wires.push(wire('spB', `B${i}`, gid, 'B'));
    }
    wires.push(wire(gid, 'Y', 'mg', `B${i}`));
  }
  return { nodes, wires };
}

function buildAdder8(): CircuitGraph {
  const nodes: CircuitNode[] = [
    portIn('inA', 'A', 20, 120, 8),
    portIn('inB', 'B', 20, 380, 8),
    portIn('inC', 'CIN', 20, 620, 1),
    n('spA', 'SPLITTER_8', 170, 80),
    n('spB', 'SPLITTER_8', 170, 340),
    n('mg', 'MERGER_8', 580, 240),
    portOut('outS', 'SUM', 740, 300, 8),
    portOut('outC', 'COUT', 740, 620, 1),
  ];
  const wires: Wire[] = [
    wire('inA', 'OUT', 'spA', 'IN'),
    wire('inB', 'OUT', 'spB', 'IN'),
    wire('mg', 'OUT', 'outS', 'IN'),
  ];
  for (let i = 0; i < 8; i++) {
    const fa = `fa${i}`;
    nodes.push(n(fa, 'FULL_ADDER', 360, 20 + i * 102, { label: `بیت ${i}` }));
    wires.push(wire('spA', `B${i}`, fa, 'A'), wire('spB', `B${i}`, fa, 'B'), wire(fa, 'SUM', 'mg', `B${i}`));
    if (i === 0) {
      wires.push(wire('inC', 'OUT', fa, 'CIN'));
    } else {
      wires.push(wire(`fa${i - 1}`, 'COUT', fa, 'CIN'));
    }
  }
  wires.push(wire('fa7', 'COUT', 'outC', 'IN'));
  return { nodes, wires };
}

function buildMux8(): CircuitGraph {
  const nodes: CircuitNode[] = [
    portIn('inA', 'A', 20, 100, 8),
    portIn('inB', 'B', 20, 360, 8),
    portIn('inS', 'SEL', 20, 600, 1),
    n('spA', 'SPLITTER_8', 170, 70),
    n('spB', 'SPLITTER_8', 170, 330),
    n('mg', 'MERGER_8', 560, 230),
    portOut('outY', 'Y', 720, 300, 8),
  ];
  const wires: Wire[] = [
    wire('inA', 'OUT', 'spA', 'IN'),
    wire('inB', 'OUT', 'spB', 'IN'),
    wire('mg', 'OUT', 'outY', 'IN'),
  ];
  for (let i = 0; i < 8; i++) {
    const mid = `m${i}`;
    nodes.push(n(mid, 'MUX_1', 365, 20 + i * 98));
    wires.push(
      wire('spA', `B${i}`, mid, 'A'),
      wire('spB', `B${i}`, mid, 'B'),
      wire('inS', 'OUT', mid, 'SEL'),
      wire(mid, 'Y', 'mg', `B${i}`)
    );
  }
  return { nodes, wires };
}

function buildReg8(): CircuitGraph {
  const nodes: CircuitNode[] = [
    portIn('inD', 'D', 20, 140, 8),
    portIn('inE', 'EN', 20, 360, 1),
    portIn('inC', 'CLK', 20, 450, 1),
    n('sp', 'SPLITTER_8', 170, 100),
    n('mg', 'MERGER_8', 560, 240),
    portOut('outQ', 'Q', 720, 310, 8),
  ];
  const wires: Wire[] = [wire('inD', 'OUT', 'sp', 'IN'), wire('mg', 'OUT', 'outQ', 'IN')];
  for (let i = 0; i < 8; i++) {
    const id = `bit${i}`;
    nodes.push(n(id, 'DFF_EN', 360, 20 + i * 100, { label: `حافظه بیت ${i}` }));
    wires.push(
      wire('sp', `B${i}`, id, 'D'),
      wire('inE', 'OUT', id, 'EN'),
      wire('inC', 'OUT', id, 'CLK'),
      wire(id, 'Q', 'mg', `B${i}`)
    );
  }
  return { nodes, wires };
}

function buildDecoder4To16(): CircuitGraph {
  const nodes: CircuitNode[] = [
    portIn('inOp', 'IN', 20, 220, 4),
    n('sp', 'SPLITTER_4', 165, 190),
    n('decLo', 'DECODER_2_4', 320, 80, { label: '۲ بیت پایین' }),
    n('decHi', 'DECODER_2_4', 320, 280, { label: '۲ بیت بالا' }),
  ];
  const wires: Wire[] = [
    wire('inOp', 'OUT', 'sp', 'IN'),
    wire('sp', 'B0', 'decLo', 'S0'),
    wire('sp', 'B1', 'decLo', 'S1'),
    wire('sp', 'B2', 'decHi', 'S0'),
    wire('sp', 'B3', 'decHi', 'S1'),
  ];
  for (let code = 0; code < 12; code++) {
    const hi = (code >> 2) & 3;
    const lo = code & 3;
    const aid = `and_${code}`;
    const oid = `out_${code}`;
    nodes.push(
      n(aid, 'AND', 515, 20 + code * 72, { label: `OP ${code}` }),
      portOut(oid, `OP${code}`, 675, 24 + code * 72, 1)
    );
    wires.push(
      wire('decHi', `Y${hi}`, aid, 'A'),
      wire('decLo', `Y${lo}`, aid, 'B'),
      wire(aid, 'Y', oid, 'IN')
    );
  }
  return { nodes, wires };
}

export function buildDefaultControlUnitGraph(): CircuitGraph {
  return {
    nodes: [
      portIn('p_op', 'OP', 20, 180, 4),
      portIn('p_z', 'Z_FLAG', 20, 460, 1),
      n('dec', 'DECODER_4_16', 180, 80, { label: 'رمزگشای آپ‌کد' }),
      n('or_alu', 'OR_4', 410, 160, { label: 'نوشتن ALU' }),
      n('or_op0', 'OR', 410, 290, { label: 'ALU OP0' }),
      n('or_op1', 'OR', 410, 375, { label: 'ALU OP1' }),
      n('and_jz', 'AND', 410, 465, { label: 'شرط پرش JZ' }),
      n('or_jmp', 'OR', 565, 435, { label: 'پرش PC' }),
      portOut('o_lda', 'LD_A', 730, 30, 1),
      portOut('o_ldb', 'LD_B', 730, 95, 1),
      portOut('o_aluwr', 'ALU_WR', 730, 165, 1),
      portOut('o_op0', 'ALU_OP0', 730, 235, 1),
      portOut('o_op1', 'ALU_OP1', 730, 305, 1),
      portOut('o_out', 'OUT_EN', 730, 375, 1),
      portOut('o_pcld', 'PC_LD', 730, 445, 1),
      portOut('o_hlt', 'HALT', 730, 515, 1),
      portOut('o_swp', 'SWAP', 730, 585, 1),
    ],
    wires: [
      wire('p_op', 'OUT', 'dec', 'IN'),
      wire('dec', 'OP1', 'o_lda', 'IN'),
      wire('dec', 'OP2', 'o_ldb', 'IN'),
      wire('dec', 'OP3', 'or_alu', 'A'),
      wire('dec', 'OP4', 'or_alu', 'B'),
      wire('dec', 'OP5', 'or_alu', 'C'),
      wire('dec', 'OP6', 'or_alu', 'D'),
      wire('or_alu', 'Y', 'o_aluwr', 'IN'),
      wire('dec', 'OP4', 'or_op0', 'A'),
      wire('dec', 'OP6', 'or_op0', 'B'),
      wire('or_op0', 'Y', 'o_op0', 'IN'),
      wire('dec', 'OP5', 'or_op1', 'A'),
      wire('dec', 'OP6', 'or_op1', 'B'),
      wire('or_op1', 'Y', 'o_op1', 'IN'),
      wire('dec', 'OP7', 'o_out', 'IN'),
      wire('dec', 'OP9', 'and_jz', 'A'),
      wire('p_z', 'OUT', 'and_jz', 'B'),
      wire('dec', 'OP8', 'or_jmp', 'A'),
      wire('and_jz', 'Y', 'or_jmp', 'B'),
      wire('or_jmp', 'Y', 'o_pcld', 'IN'),
      wire('dec', 'OP10', 'o_hlt', 'IN'),
      wire('dec', 'OP11', 'o_swp', 'IN'),
    ],
  };
}

/** Converts the player's actual Level 12 Control Unit circuit into a live executable sub-circuit blueprint */
export function convertLevel12ToControlUnitBlueprint(level12Circuit: CircuitGraph): CircuitGraph {
  const nodes: CircuitNode[] = level12Circuit.nodes.map((node) => {
    if (node.portRole === 'input' && node.portName) {
      const bitWidth: BitWidth = node.type === 'INPUT_4' ? 4 : node.type === 'INPUT_8' ? 8 : 1;
      return {
        ...node,
        type: 'PORT_IN',
        bitWidth,
      };
    }
    if (node.portRole === 'output' && node.portName) {
      const bitWidth: BitWidth = node.type === 'DISPLAY_8' ? 8 : 1;
      return {
        ...node,
        type: 'PORT_OUT',
        bitWidth,
      };
    }
    return { ...node };
  });
  return {
    nodes,
    wires: level12Circuit.wires.map((w) => ({ ...w })),
  };
}

export const STATIC_SUBCIRCUITS: Partial<Record<ComponentType, CircuitGraph>> = {
  OR_4: {
    nodes: [
      portIn('inA', 'A', 20, 30),
      portIn('inB', 'B', 20, 100),
      portIn('inC', 'C', 20, 180),
      portIn('inD', 'D', 20, 250),
      n('or1', 'OR', 200, 60),
      n('or2', 'OR', 200, 210),
      n('or3', 'OR', 360, 135),
      portOut('outY', 'Y', 520, 140),
    ],
    wires: [
      wire('inA', 'OUT', 'or1', 'A'),
      wire('inB', 'OUT', 'or1', 'B'),
      wire('inC', 'OUT', 'or2', 'A'),
      wire('inD', 'OUT', 'or2', 'B'),
      wire('or1', 'Y', 'or3', 'A'),
      wire('or2', 'Y', 'or3', 'B'),
      wire('or3', 'Y', 'outY', 'IN'),
    ],
  },
  XOR: {
    nodes: [
      portIn('inA', 'A', 20, 70),
      portIn('inB', 'B', 20, 210),
      n('na', 'NOT', 180, 40),
      n('nb', 'NOT', 180, 230),
      n('and1', 'AND', 340, 60),
      n('and2', 'AND', 340, 200),
      n('or1', 'OR', 500, 130),
      portOut('outY', 'Y', 650, 135),
    ],
    wires: [
      wire('inA', 'OUT', 'na', 'A'),
      wire('inB', 'OUT', 'nb', 'A'),
      wire('inA', 'OUT', 'and1', 'A'),
      wire('nb', 'Y', 'and1', 'B'),
      wire('na', 'Y', 'and2', 'A'),
      wire('inB', 'OUT', 'and2', 'B'),
      wire('and1', 'Y', 'or1', 'A'),
      wire('and2', 'Y', 'or1', 'B'),
      wire('or1', 'Y', 'outY', 'IN'),
    ],
  },
  HALF_ADDER: {
    nodes: [
      portIn('inA', 'A', 20, 60),
      portIn('inB', 'B', 20, 190),
      n('x', 'XOR', 220, 50),
      n('a', 'AND', 220, 180),
      portOut('outS', 'SUM', 410, 55),
      portOut('outC', 'CARRY', 410, 185),
    ],
    wires: [
      wire('inA', 'OUT', 'x', 'A'),
      wire('inB', 'OUT', 'x', 'B'),
      wire('inA', 'OUT', 'a', 'A'),
      wire('inB', 'OUT', 'a', 'B'),
      wire('x', 'Y', 'outS', 'IN'),
      wire('a', 'Y', 'outC', 'IN'),
    ],
  },
  FULL_ADDER: {
    nodes: [
      portIn('inA', 'A', 20, 50),
      portIn('inB', 'B', 20, 140),
      portIn('inC', 'CIN', 20, 240),
      n('ha1', 'HALF_ADDER', 190, 70),
      n('ha2', 'HALF_ADDER', 380, 120),
      n('or1', 'OR', 565, 200),
      portOut('outS', 'SUM', 720, 110),
      portOut('outC', 'COUT', 720, 205),
    ],
    wires: [
      wire('inA', 'OUT', 'ha1', 'A'),
      wire('inB', 'OUT', 'ha1', 'B'),
      wire('ha1', 'SUM', 'ha2', 'A'),
      wire('inC', 'OUT', 'ha2', 'B'),
      wire('ha1', 'CARRY', 'or1', 'A'),
      wire('ha2', 'CARRY', 'or1', 'B'),
      wire('ha2', 'SUM', 'outS', 'IN'),
      wire('or1', 'Y', 'outC', 'IN'),
    ],
  },
  ADDER_8: buildAdder8(),
  MUX_1: {
    nodes: [
      portIn('inA', 'A', 20, 40),
      portIn('inB', 'B', 20, 140),
      portIn('inS', 'SEL', 20, 240),
      n('ns', 'NOT', 175, 225),
      n('a1', 'AND', 325, 50),
      n('a2', 'AND', 325, 175),
      n('o1', 'OR', 485, 115),
      portOut('outY', 'Y', 640, 120),
    ],
    wires: [
      wire('inS', 'OUT', 'ns', 'A'),
      wire('inA', 'OUT', 'a1', 'A'),
      wire('ns', 'Y', 'a1', 'B'),
      wire('inB', 'OUT', 'a2', 'A'),
      wire('inS', 'OUT', 'a2', 'B'),
      wire('a1', 'Y', 'o1', 'A'),
      wire('a2', 'Y', 'o1', 'B'),
      wire('o1', 'Y', 'outY', 'IN'),
    ],
  },
  MUX_8: buildMux8(),
  NOT_8: buildBitwise8('NOT'),
  AND_8: buildBitwise8('AND'),
  OR_8: buildBitwise8('OR'),
  NOR_8: {
    nodes: [
      portIn('inA', 'A', 20, 160, 8),
      n('sp', 'SPLITTER_8', 170, 80),
      n('orLo', 'OR_4', 350, 50),
      n('orHi', 'OR_4', 350, 195),
      n('orAll', 'OR', 510, 130),
      n('inv', 'NOT', 655, 135),
      portOut('outZ', 'ZERO', 795, 135, 1),
    ],
    wires: [
      wire('inA', 'OUT', 'sp', 'IN'),
      wire('sp', 'B0', 'orLo', 'A'),
      wire('sp', 'B1', 'orLo', 'B'),
      wire('sp', 'B2', 'orLo', 'C'),
      wire('sp', 'B3', 'orLo', 'D'),
      wire('sp', 'B4', 'orHi', 'A'),
      wire('sp', 'B5', 'orHi', 'B'),
      wire('sp', 'B6', 'orHi', 'C'),
      wire('sp', 'B7', 'orHi', 'D'),
      wire('orLo', 'Y', 'orAll', 'A'),
      wire('orHi', 'Y', 'orAll', 'B'),
      wire('orAll', 'Y', 'inv', 'A'),
      wire('inv', 'Y', 'outZ', 'IN'),
    ],
  },
  ALU_8: {
    nodes: [
      portIn('inA', 'A', 20, 70, 8),
      portIn('inB', 'B', 20, 210, 8),
      portIn('inOp0', 'OP0', 20, 350, 1),
      portIn('inOp1', 'OP1', 20, 430, 1),
      n('c0', 'CONST_0', 160, 20),
      n('c1', 'CONST_1', 160, 175),
      n('notB', 'NOT_8', 165, 245),
      n('add', 'ADDER_8', 330, 30, { label: 'جمع (ADD)' }),
      n('sub', 'ADDER_8', 330, 155, { label: 'تفریق (SUB)' }),
      n('and8', 'AND_8', 330, 290, { label: 'AND بیتی' }),
      n('or8', 'OR_8', 330, 385, { label: 'OR بیتی' }),
      n('muxArith', 'MUX_8', 530, 95, { label: 'انتخاب جمع/تفریق' }),
      n('muxLogic', 'MUX_8', 530, 320, { label: 'انتخاب AND/OR' }),
      n('muxOut', 'MUX_8', 710, 200, { label: 'انتخاب نهایی' }),
      n('zDet', 'NOR_8', 710, 360, { label: 'تشخیص صفر' }),
      portOut('outRes', 'RES', 910, 210, 8),
      portOut('outZ', 'ZERO', 910, 365, 1),
    ],
    wires: [
      wire('inA', 'OUT', 'add', 'A'),
      wire('inB', 'OUT', 'add', 'B'),
      wire('c0', 'OUT', 'add', 'CIN'),
      wire('inB', 'OUT', 'notB', 'A'),
      wire('inA', 'OUT', 'sub', 'A'),
      wire('notB', 'Y', 'sub', 'B'),
      wire('c1', 'OUT', 'sub', 'CIN'),
      wire('inA', 'OUT', 'and8', 'A'),
      wire('inB', 'OUT', 'and8', 'B'),
      wire('inA', 'OUT', 'or8', 'A'),
      wire('inB', 'OUT', 'or8', 'B'),
      wire('add', 'SUM', 'muxArith', 'A'),
      wire('sub', 'SUM', 'muxArith', 'B'),
      wire('inOp0', 'OUT', 'muxArith', 'SEL'),
      wire('and8', 'Y', 'muxLogic', 'A'),
      wire('or8', 'Y', 'muxLogic', 'B'),
      wire('inOp0', 'OUT', 'muxLogic', 'SEL'),
      wire('muxArith', 'Y', 'muxOut', 'A'),
      wire('muxLogic', 'Y', 'muxOut', 'B'),
      wire('inOp1', 'OUT', 'muxOut', 'SEL'),
      wire('muxOut', 'Y', 'outRes', 'IN'),
      wire('muxOut', 'Y', 'zDet', 'A'),
      wire('zDet', 'ZERO', 'outZ', 'IN'),
    ],
  },
  DFF_EN: {
    nodes: [
      portIn('inD', 'D', 20, 60),
      portIn('inE', 'EN', 20, 150),
      portIn('inC', 'CLK', 20, 240),
      n('mux', 'MUX_1', 210, 70, { label: 'نگه‌دارنده یا جدید' }),
      n('dff', 'DFF', 400, 120),
      portOut('outQ', 'Q', 590, 125),
    ],
    wires: [
      wire('dff', 'Q', 'mux', 'A'),
      wire('inD', 'OUT', 'mux', 'B'),
      wire('inE', 'OUT', 'mux', 'SEL'),
      wire('mux', 'Y', 'dff', 'D'),
      wire('inC', 'OUT', 'dff', 'CLK'),
      wire('dff', 'Q', 'outQ', 'IN'),
    ],
  },
  REG_8: buildReg8(),
  PC_8: {
    nodes: [
      portIn('inJmp', 'JMP', 20, 90, 8),
      portIn('inLd', 'LOAD', 20, 210, 1),
      portIn('inClk', 'CLK', 20, 310, 1),
      n('c1', 'CONST_8', 20, 400, { value: 1, label: 'ثابت ۱' }),
      n('c0', 'CONST_0', 20, 490),
      n('cEn', 'CONST_1', 20, 560),
      n('add1', 'ADDER_8', 220, 350, { label: 'افزایش +۱' }),
      n('mux', 'MUX_8', 415, 135, { label: 'عادی یا پرش' }),
      n('reg', 'REG_8', 610, 175, { label: 'رجیستر آدرس PC' }),
      portOut('outAddr', 'ADDR', 810, 195, 8),
    ],
    wires: [
      wire('reg', 'Q', 'add1', 'A'),
      wire('c1', 'OUT', 'add1', 'B'),
      wire('c0', 'OUT', 'add1', 'CIN'),
      wire('add1', 'SUM', 'mux', 'A'),
      wire('inJmp', 'OUT', 'mux', 'B'),
      wire('inLd', 'OUT', 'mux', 'SEL'),
      wire('mux', 'Y', 'reg', 'D'),
      wire('cEn', 'OUT', 'reg', 'EN'),
      wire('inClk', 'OUT', 'reg', 'CLK'),
      wire('reg', 'Q', 'outAddr', 'IN'),
    ],
  },
  DECODER_2_4: {
    nodes: [
      portIn('in0', 'S0', 20, 70),
      portIn('in1', 'S1', 20, 230),
      n('n0', 'NOT', 175, 50),
      n('n1', 'NOT', 175, 220),
      n('a0', 'AND', 350, 20, { label: '00' }),
      n('a1', 'AND', 350, 110, { label: '01' }),
      n('a2', 'AND', 350, 200, { label: '10' }),
      n('a3', 'AND', 350, 290, { label: '11' }),
      portOut('o0', 'Y0', 520, 25),
      portOut('o1', 'Y1', 520, 115),
      portOut('o2', 'Y2', 520, 205),
      portOut('o3', 'Y3', 520, 295),
    ],
    wires: [
      wire('in0', 'OUT', 'n0', 'A'),
      wire('in1', 'OUT', 'n1', 'A'),
      wire('n1', 'Y', 'a0', 'A'),
      wire('n0', 'Y', 'a0', 'B'),
      wire('n1', 'Y', 'a1', 'A'),
      wire('in0', 'OUT', 'a1', 'B'),
      wire('in1', 'OUT', 'a2', 'A'),
      wire('n0', 'Y', 'a2', 'B'),
      wire('in1', 'OUT', 'a3', 'A'),
      wire('in0', 'OUT', 'a3', 'B'),
      wire('a0', 'Y', 'o0', 'IN'),
      wire('a1', 'Y', 'o1', 'IN'),
      wire('a2', 'Y', 'o2', 'IN'),
      wire('a3', 'Y', 'o3', 'IN'),
    ],
  },
  DECODER_4_16: buildDecoder4To16(),
  CONTROL_UNIT: buildDefaultControlUnitGraph(),
};

export function getSubCircuitBlueprint(
  type: ComponentType,
  customControlUnit?: CircuitGraph
): CircuitGraph | undefined {
  if (type === 'CONTROL_UNIT' && customControlUnit) {
    return customControlUnit;
  }
  return STATIC_SUBCIRCUITS[type];
}
