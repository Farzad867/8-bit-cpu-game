export type BitWidth = 1 | 4 | 8;

export interface Signal {
  value: number; // integer masked to bitWidth
  width: BitWidth;
  floating?: boolean; // true when input pin has no driving wire (Z)
}

export type ComponentCategory =
  | 'io'
  | 'gates'
  | 'bus'
  | 'arithmetic'
  | 'memory'
  | 'control';

export type ComponentType =
  | 'SWITCH_1'
  | 'INPUT_4'
  | 'INPUT_8'
  | 'CONST_0'
  | 'CONST_1'
  | 'CONST_8'
  | 'CLOCK'
  | 'LED_1'
  | 'DISPLAY_8'
  | 'OUT_DISPLAY'
  | 'PORT_IN'
  | 'PORT_OUT'
  | 'SPLITTER_8'
  | 'MERGER_8'
  | 'SPLITTER_4'
  | 'MERGER_4'
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'NAND'
  | 'NOR'
  | 'OR_4'
  | 'XOR'
  | 'HALF_ADDER'
  | 'FULL_ADDER'
  | 'ADDER_8'
  | 'MUX_1'
  | 'MUX_8'
  | 'NOT_8'
  | 'AND_8'
  | 'OR_8'
  | 'NOR_8'
  | 'ALU_8'
  | 'DFF'
  | 'DFF_EN'
  | 'REG_8'
  | 'PC_8'
  | 'DECODER_2_4'
  | 'DECODER_4_16'
  | 'ROM_16'
  | 'CONTROL_UNIT';

export interface PinDef {
  id: string;
  label: string;
  width: BitWidth;
  side: 'left' | 'right';
  tooltip: string;
}

export interface ComponentDef {
  type: ComponentType;
  faName: string;
  enName: string;
  category: ComponentCategory;
  description: string;
  width: number;
  minHeight?: number;
  inputs: PinDef[];
  outputs: PinDef[];
  encapsulated?: boolean;
  unlockLevel: number;
}

export interface CircuitNode {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  label?: string;
  value?: number; // SWITCH_1, INPUT_4, INPUT_8, CONST_8
  locked?: boolean;
  portName?: string; // maps PORT_IN/PORT_OUT or level testbench I/O
  portRole?: 'input' | 'output';
  bitWidth?: BitWidth; // for PORT_IN / PORT_OUT
}

export interface Wire {
  id: string;
  fromNodeId: string;
  fromPinId: string;
  toNodeId: string;
  toPinId: string;
}

export interface CircuitGraph {
  nodes: CircuitNode[];
  wires: Wire[];
}

export interface RomWord {
  op: number; // 0..15
  arg: number; // 0..255
  line?: number; // source line number (1-indexed)
  source?: string;
}

export interface DffMemory {
  q: number;
  prevClk: number;
}

export interface OutDisplayMemory {
  latched: number;
  hasOutput: boolean;
  prevClk: number;
  history: number[];
}

export interface SimState {
  nodeInputs: Record<string, Record<string, Signal>>;
  nodeOutputs: Record<string, Record<string, Signal>>;
  dffs: Record<string, DffMemory>;
  outDisplays: Record<string, OutDisplayMemory>;
  subStates: Record<string, SimState>;
  halted: boolean;
  clockHigh: boolean;
}

export interface ISAEntry {
  opcode: number; // 0..11
  mnemonic: string;
  defaultMnemonic: string;
  hasArg: boolean;
  argKind?: 'imm' | 'addr';
  hardwareSummary: string;
  controlWires: string[];
}

export interface CompiledProgram {
  ok: boolean;
  words: RomWord[];
  errors: { line: number; message: string }[];
  lineToAddr: Record<number, number>;
  addrToLine: Record<number, number>;
}

export interface LessonCards {
  storyTitle: string;
  storyText: string;
  howTitle: string;
  howText: string;
  howDiagram: string;
  missionTitle: string;
  missionText: string;
  unlocksText: string;
}

export interface CoachStep {
  id: string;
  text: string;
  check: (circuit: CircuitGraph, sim: SimState) => boolean;
}

export interface CombTestCase {
  label: string;
  inputs: Record<string, number>; // maps portName -> value
  expected: Record<string, number>; // maps portName -> value
}

export interface SeqTestStep {
  label: string;
  inputs: Record<string, number>;
  tickClock: boolean;
  expected: Record<string, number>;
}

export interface TestRowResult {
  index: number;
  label: string;
  inputs: Record<string, number>;
  expected: Record<string, number>;
  actual: Record<string, number>;
  passed: boolean;
  isSequential?: boolean;
  stepIndex?: number;
}

export interface LevelDef {
  id: number;
  chapter: number;
  chapterTitle: string;
  title: string;
  shortGoal: string;
  palette: ComponentType[];
  lesson: LessonCards;
  hint: string;
  coachSteps: CoachStep[];
  initialCircuit: CircuitGraph;
  autoBuildCircuit: CircuitGraph;
  testKind: 'combinational' | 'sequential' | 'cpu_diagnostic' | 'assembly_lab';
  combTests?: CombTestCase[];
  seqTests?: SeqTestStep[];
  unlocks: ComponentType[];
  showIsaTab?: boolean;
  showAssemblyTab?: boolean;
  showClockBar?: boolean;
}

export interface NarrationFrame {
  cycle: number;
  pcBefore: number;
  pcAfter: number;
  opcode: number;
  arg: number;
  mnemonic: string;
  activeControlWires: string[];
  regA: number;
  regB: number;
  regC: number;
  aluRes: number;
  aluZero: number;
  flagZ: number;
  outVal: number;
  halted: boolean;
  fetchText: string;
  decodeText: string;
  executeText: string;
  warningText?: string;
}

export interface GlossaryItem {
  id: string;
  termFa: string;
  termEn: string;
  analogy: string;
  explanation: string;
  visualExample: string;
}
