import { BitWidth, CircuitGraph, CircuitNode, RomWord, Signal, SimState } from '../types';
import { getNodePins } from './components';
import { getSubCircuitBlueprint } from './subcircuits';

const MAX_RELAX_ITERS = 32;

export function maskForWidth(width: BitWidth): number {
  return width === 1 ? 1 : width === 4 ? 0xf : 0xff;
}

export function createEmptySimState(): SimState {
  return {
    nodeInputs: {},
    nodeOutputs: {},
    dffs: {},
    outDisplays: {},
    subStates: {},
    halted: false,
    clockHigh: false,
  };
}

export function cloneSimState(state: SimState): SimState {
  const next: SimState = {
    nodeInputs: {},
    nodeOutputs: {},
    dffs: {},
    outDisplays: {},
    subStates: {},
    halted: state.halted,
    clockHigh: state.clockHigh,
  };
  for (const [k, v] of Object.entries(state.nodeInputs)) {
    next.nodeInputs[k] = {};
    for (const [p, s] of Object.entries(v)) next.nodeInputs[k][p] = { ...s };
  }
  for (const [k, v] of Object.entries(state.nodeOutputs)) {
    next.nodeOutputs[k] = {};
    for (const [p, s] of Object.entries(v)) next.nodeOutputs[k][p] = { ...s };
  }
  for (const [k, v] of Object.entries(state.dffs)) next.dffs[k] = { ...v };
  for (const [k, v] of Object.entries(state.outDisplays)) {
    next.outDisplays[k] = { ...v, history: [...v.history] };
  }
  for (const [k, v] of Object.entries(state.subStates)) {
    next.subStates[k] = cloneSimState(v);
  }
  return next;
}

export interface EvalContext {
  romProgram: RomWord[];
  customControlUnit?: CircuitGraph;
  clockOverride?: number; // undefined -> use state.clockHigh ? 1 : 0
}

function getInVal(state: SimState, nodeId: string, pinId: string): number {
  return state.nodeInputs[nodeId]?.[pinId]?.value ?? 0;
}

function setOut(state: SimState, nodeId: string, pinId: string, value: number, width: BitWidth): boolean {
  const masked = value & maskForWidth(width);
  if (!state.nodeOutputs[nodeId]) state.nodeOutputs[nodeId] = {};
  const prev = state.nodeOutputs[nodeId][pinId];
  if (prev && prev.value === masked && prev.width === width) return false;
  state.nodeOutputs[nodeId][pinId] = { value: masked, width, floating: false };
  return true;
}

function populateInputsFromWires(
  circuit: CircuitGraph,
  state: SimState,
  externalInputs?: Record<string, Signal>
): boolean {
  let changed = false;
  // Build map of incoming wires per (nodeId, pinId)
  const driven: Record<string, Record<string, Signal>> = {};

  for (const wire of circuit.wires) {
    const src = state.nodeOutputs[wire.fromNodeId]?.[wire.fromPinId];
    if (!src) continue;
    if (!driven[wire.toNodeId]) driven[wire.toNodeId] = {};
    const existing = driven[wire.toNodeId][wire.toPinId];
    if (existing) {
      // Wired-OR safe resolution if multiple wires connect to same input
      driven[wire.toNodeId][wire.toPinId] = {
        value: (existing.value | src.value) & maskForWidth(existing.width),
        width: existing.width,
        floating: false,
      };
    } else {
      driven[wire.toNodeId][wire.toPinId] = { ...src, floating: false };
    }
  }

  for (const node of circuit.nodes) {
    if (node.type === 'PORT_IN' && externalInputs && node.portName) {
      const ext = externalInputs[node.portName];
      const w = node.bitWidth ?? 1;
      const val = ext ? ext.value & maskForWidth(w) : 0;
      if (setOut(state, node.id, 'OUT', val, w)) changed = true;
    }

    const { inputs } = getNodePins(node);
    if (!state.nodeInputs[node.id]) state.nodeInputs[node.id] = {};
    for (const pin of inputs) {
      const incoming = driven[node.id]?.[pin.id];
      const nextSig: Signal = incoming
        ? { value: incoming.value & maskForWidth(pin.width), width: pin.width, floating: false }
        : { value: 0, width: pin.width, floating: true };
      const prev = state.nodeInputs[node.id][pin.id];
      if (!prev || prev.value !== nextSig.value || prev.floating !== nextSig.floating) {
        state.nodeInputs[node.id][pin.id] = nextSig;
        changed = true;
      }
    }
  }
  return changed;
}

function evalNodeCombinational(
  node: CircuitNode,
  state: SimState,
  ctx: EvalContext
): boolean {
  const id = node.id;
  switch (node.type) {
    case 'SWITCH_1':
      return setOut(state, id, 'OUT', node.value ? 1 : 0, 1);
    case 'INPUT_4':
      return setOut(state, id, 'OUT', (node.value ?? 0) & 0xf, 4);
    case 'INPUT_8':
    case 'CONST_8':
      return setOut(state, id, 'OUT', (node.value ?? 0) & 0xff, 8);
    case 'CONST_0':
      return setOut(state, id, 'OUT', 0, 1);
    case 'CONST_1':
      return setOut(state, id, 'OUT', 1, 1);
    case 'CLOCK': {
      const haltSig = getInVal(state, id, 'HALT');
      state.halted = haltSig === 1;
      const clkVal = ctx.clockOverride !== undefined ? (state.halted ? 0 : ctx.clockOverride) : state.clockHigh ? 1 : 0;
      return setOut(state, id, 'CLK', clkVal, 1);
    }
    case 'LED_1':
    case 'DISPLAY_8':
    case 'OUT_DISPLAY':
    case 'PORT_IN':
    case 'PORT_OUT':
      return false;

    case 'SPLITTER_8': {
      const v = getInVal(state, id, 'IN');
      let ch = false;
      for (let i = 0; i < 8; i++) {
        if (setOut(state, id, `B${i}`, (v >> i) & 1, 1)) ch = true;
      }
      return ch;
    }
    case 'MERGER_8': {
      let out = 0;
      for (let i = 0; i < 8; i++) {
        out |= (getInVal(state, id, `B${i}`) & 1) << i;
      }
      return setOut(state, id, 'OUT', out, 8);
    }
    case 'SPLITTER_4': {
      const v = getInVal(state, id, 'IN');
      let ch = false;
      for (let i = 0; i < 4; i++) {
        if (setOut(state, id, `B${i}`, (v >> i) & 1, 1)) ch = true;
      }
      return ch;
    }
    case 'MERGER_4': {
      let out = 0;
      for (let i = 0; i < 4; i++) {
        out |= (getInVal(state, id, `B${i}`) & 1) << i;
      }
      return setOut(state, id, 'OUT', out, 4);
    }

    case 'NOT':
      return setOut(state, id, 'Y', getInVal(state, id, 'A') ? 0 : 1, 1);
    case 'AND':
      return setOut(state, id, 'Y', getInVal(state, id, 'A') & getInVal(state, id, 'B'), 1);
    case 'OR':
      return setOut(state, id, 'Y', getInVal(state, id, 'A') | getInVal(state, id, 'B'), 1);
    case 'NAND':
      return setOut(state, id, 'Y', (getInVal(state, id, 'A') & getInVal(state, id, 'B')) ? 0 : 1, 1);
    case 'NOR':
      return setOut(state, id, 'Y', (getInVal(state, id, 'A') | getInVal(state, id, 'B')) ? 0 : 1, 1);

    case 'DFF': {
      if (!state.dffs[id]) state.dffs[id] = { q: 0, prevClk: 0 };
      const q = state.dffs[id].q & 1;
      const c1 = setOut(state, id, 'Q', q, 1);
      const c2 = setOut(state, id, 'NQ', q ? 0 : 1, 1);
      return c1 || c2;
    }

    case 'ROM_16': {
      const addr = getInVal(state, id, 'ADDR') & 0xff;
      const word = ctx.romProgram[addr];
      const op = word ? word.op & 0xf : 0;
      const arg = word ? word.arg & 0xff : 0;
      const c1 = setOut(state, id, 'OP', op, 4);
      const c2 = setOut(state, id, 'ARG', arg, 8);
      return c1 || c2;
    }

    default: {
      // Encapsulated sub-circuit evaluated by REAL netlist propagation!
      const bp = getSubCircuitBlueprint(node.type, ctx.customControlUnit);
      if (!bp) return false;
      if (!state.subStates[id]) state.subStates[id] = createEmptySimState();
      const subState = state.subStates[id];
      const extInputs = state.nodeInputs[id] ?? {};
      relaxCombinational(bp, subState, ctx, extInputs);

      let ch = false;
      for (const sn of bp.nodes) {
        if (sn.type === 'PORT_OUT' && sn.portName) {
          const sig = subState.nodeInputs[sn.id]?.['IN'];
          const w = sn.bitWidth ?? 1;
          if (setOut(state, id, sn.portName, sig?.value ?? 0, w)) ch = true;
        }
      }
      return ch;
    }
  }
}

export function relaxCombinational(
  circuit: CircuitGraph,
  state: SimState,
  ctx: EvalContext,
  externalInputs?: Record<string, Signal>
): void {
  state.halted = false;
  for (let iter = 0; iter < MAX_RELAX_ITERS; iter++) {
    let changed = populateInputsFromWires(circuit, state, externalInputs);
    for (const node of circuit.nodes) {
      if (evalNodeCombinational(node, state, ctx)) {
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Final wire input refresh so LEDs/PORT_OUTs see latest outputs
  populateInputsFromWires(circuit, state, externalInputs);
}

interface PendingCommit {
  kind: 'dff' | 'out';
  state: SimState;
  nodeId: string;
  nextValue: number;
  clkVal: number;
  enVal?: number;
}

/** Phase A: Detect every rising edge (0 -> 1) across the entire hierarchical netlist BEFORE mutating any Q */
function collectRisingEdges(
  circuit: CircuitGraph,
  state: SimState,
  ctx: EvalContext,
  commits: PendingCommit[]
): void {
  for (const node of circuit.nodes) {
    if (node.type === 'DFF') {
      if (!state.dffs[node.id]) state.dffs[node.id] = { q: 0, prevClk: 0 };
      const mem = state.dffs[node.id];
      const clk = getInVal(state, node.id, 'CLK') & 1;
      const d = getInVal(state, node.id, 'D') & 1;
      if (mem.prevClk === 0 && clk === 1) {
        commits.push({ kind: 'dff', state, nodeId: node.id, nextValue: d, clkVal: clk });
      } else {
        mem.prevClk = clk;
      }
    } else if (node.type === 'OUT_DISPLAY') {
      if (!state.outDisplays[node.id]) {
        state.outDisplays[node.id] = { latched: 0, hasOutput: false, prevClk: 0, history: [] };
      }
      const mem = state.outDisplays[node.id];
      const clk = getInVal(state, node.id, 'CLK') & 1;
      const en = getInVal(state, node.id, 'EN') & 1;
      const d = getInVal(state, node.id, 'D') & 0xff;
      if (mem.prevClk === 0 && clk === 1) {
        commits.push({ kind: 'out', state, nodeId: node.id, nextValue: d, clkVal: clk, enVal: en });
      } else {
        mem.prevClk = clk;
      }
    } else {
      const bp = getSubCircuitBlueprint(node.type, ctx.customControlUnit);
      if (bp && state.subStates[node.id]) {
        collectRisingEdges(bp, state.subStates[node.id], ctx, commits);
      }
    }
  }
}

function applyCommits(commits: PendingCommit[]): boolean {
  if (commits.length === 0) return false;
  for (const c of commits) {
    if (c.kind === 'dff') {
      const mem = c.state.dffs[c.nodeId];
      mem.q = c.nextValue & 1;
      mem.prevClk = c.clkVal;
    } else if (c.kind === 'out') {
      const mem = c.state.outDisplays[c.nodeId];
      if (c.enVal === 1) {
        mem.latched = c.nextValue & 0xff;
        mem.hasOutput = true;
        mem.history.push(mem.latched);
      }
      mem.prevClk = c.clkVal;
    }
  }
  return true;
}

/** Interactive evaluation (handles manual toggle switches driving CLK too!) */
export function evaluateCircuitInteractive(
  circuit: CircuitGraph,
  prevState: SimState,
  ctx: EvalContext
): SimState {
  const state = cloneSimState(prevState);
  relaxCombinational(circuit, state, { ...ctx, clockOverride: state.clockHigh ? 1 : 0 });
  const commits: PendingCommit[] = [];
  collectRisingEdges(circuit, state, ctx, commits);
  if (applyCommits(commits)) {
    relaxCombinational(circuit, state, { ...ctx, clockOverride: state.clockHigh ? 1 : 0 });
  }
  return state;
}

/** Executes one complete synchronous rising-edge Clock pulse (CLK: 0 -> 1 -> 0) */
export function stepClockCycle(
  circuit: CircuitGraph,
  prevState: SimState,
  ctx: EvalContext
): { nextState: SimState; halted: boolean } {
  const state = cloneSimState(prevState);

  // 1. Settle with CLK = 0 to check HALT and sample pre-edge D values
  state.clockHigh = false;
  relaxCombinational(circuit, state, { ...ctx, clockOverride: 0 });
  // Ensure prevClk sees 0 before rising edge
  const zeroCommits: PendingCommit[] = [];
  collectRisingEdges(circuit, state, ctx, zeroCommits);

  if (state.halted) {
    return { nextState: state, halted: true };
  }

  // 2. Drive CLK = 1 combinationally (WITHOUT committing yet) so every DFF sees CLK = 1
  state.clockHigh = true;
  relaxCombinational(circuit, state, { ...ctx, clockOverride: 1 });

  // 3. Simultaneous two-phase sample & commit on rising edge
  const commits: PendingCommit[] = [];
  collectRisingEdges(circuit, state, ctx, commits);
  applyCommits(commits);

  // 4. Drop CLK back to 0 and settle new outputs immediately
  state.clockHigh = false;
  relaxCombinational(circuit, state, { ...ctx, clockOverride: 0 });
  const postZero: PendingCommit[] = [];
  collectRisingEdges(circuit, state, ctx, postZero);

  return { nextState: state, halted: state.halted };
}

/** Helper to read an output value by portName (supports Level 1 dynamic LED/Switch fallback too) */
export function readPortOutputs(circuit: CircuitGraph, state: SimState): Record<string, number> {
  const result: Record<string, number> = {};
  for (const node of circuit.nodes) {
    if (node.portRole === 'output' && node.portName) {
      if (node.type === 'LED_1' || node.type === 'DISPLAY_8') {
        result[node.portName] = state.nodeInputs[node.id]?.['IN']?.value ?? 0;
      } else if (node.type === 'OUT_DISPLAY') {
        result[node.portName] = state.outDisplays[node.id]?.latched ?? 0;
      }
    }
  }
  // Level 1 fallback: player placed their own LED_1
  if (Object.keys(result).length === 0) {
    const firstLed = circuit.nodes.find((n) => n.type === 'LED_1');
    if (firstLed) {
      result['Y'] = state.nodeInputs[firstLed.id]?.['IN']?.value ?? 0;
    }
  }
  return result;
}

/** Clone circuit with test inputs injected into matching portName nodes */
export function injectInputsIntoCircuit(
  circuit: CircuitGraph,
  inputs: Record<string, number>
): CircuitGraph {
  let usedGenericSwitch = false;
  const nodes = circuit.nodes.map((node) => {
    if (node.portRole === 'input' && node.portName && inputs[node.portName] !== undefined) {
      return { ...node, value: inputs[node.portName] };
    }
    // Level 1 fallback: player placed SWITCH_1 without portName
    if (!usedGenericSwitch && node.type === 'SWITCH_1' && !node.portName && inputs['A'] !== undefined) {
      usedGenericSwitch = true;
      return { ...node, value: inputs['A'] };
    }
    return { ...node };
  });
  return { nodes, wires: circuit.wires.map((w) => ({ ...w })) };
}

/** Inspect live CPU state directly from the actual canvas nodes & wires (zero mocking!) */
export interface LiveCpuSnapshot {
  hasCpuNodes: boolean;
  pc: number;
  op: number;
  arg: number;
  regA: number;
  regB: number;
  regC: number;
  aluRes: number;
  aluZero: number;
  flagZ: number;
  outVal: number;
  outHistory: number[];
  halted: boolean;
  controlWires: Record<string, number>;
}

export function inspectLiveCpu(circuit: CircuitGraph, state: SimState): LiveCpuSnapshot {
  const pcNode = circuit.nodes.find((n) => n.type === 'PC_8');
  const romNode = circuit.nodes.find((n) => n.type === 'ROM_16');
  const ctrlNode = circuit.nodes.find((n) => n.type === 'CONTROL_UNIT');
  const aluNode = circuit.nodes.find((n) => n.type === 'ALU_8');
  const outNode = circuit.nodes.find((n) => n.type === 'OUT_DISPLAY');
  const regA = circuit.nodes.find((n) => n.id === 'regA' || (n.type === 'REG_8' && n.label?.includes('A')));
  const regB = circuit.nodes.find((n) => n.id === 'regB' || (n.type === 'REG_8' && n.label?.includes('B')));
  const regC = circuit.nodes.find((n) => n.id === 'regC' || (n.type === 'REG_8' && n.label?.includes('C')));
  const flagZ = circuit.nodes.find((n) => n.type === 'DFF_EN');

  const ctrlKeys = ['LD_A', 'LD_B', 'ALU_WR', 'ALU_OP0', 'ALU_OP1', 'OUT_EN', 'PC_LD', 'HALT', 'SWAP'];
  const controlWires: Record<string, number> = {};
  if (ctrlNode) {
    for (const k of ctrlKeys) {
      controlWires[k] = state.nodeOutputs[ctrlNode.id]?.[k]?.value ?? 0;
    }
  }

  return {
    hasCpuNodes: Boolean(pcNode && romNode && ctrlNode),
    pc: pcNode ? state.nodeOutputs[pcNode.id]?.['ADDR']?.value ?? 0 : 0,
    op: romNode ? state.nodeOutputs[romNode.id]?.['OP']?.value ?? 0 : 0,
    arg: romNode ? state.nodeOutputs[romNode.id]?.['ARG']?.value ?? 0 : 0,
    regA: regA ? state.nodeOutputs[regA.id]?.['Q']?.value ?? 0 : 0,
    regB: regB ? state.nodeOutputs[regB.id]?.['Q']?.value ?? 0 : 0,
    regC: regC ? state.nodeOutputs[regC.id]?.['Q']?.value ?? 0 : 0,
    aluRes: aluNode ? state.nodeOutputs[aluNode.id]?.['RES']?.value ?? 0 : 0,
    aluZero: aluNode ? state.nodeOutputs[aluNode.id]?.['ZERO']?.value ?? 0 : 0,
    flagZ: flagZ ? state.nodeOutputs[flagZ.id]?.['Q']?.value ?? 0 : 0,
    outVal: outNode ? state.outDisplays[outNode.id]?.latched ?? 0 : 0,
    outHistory: outNode ? [...(state.outDisplays[outNode.id]?.history ?? [])] : [],
    halted: state.halted,
    controlWires,
  };
}
