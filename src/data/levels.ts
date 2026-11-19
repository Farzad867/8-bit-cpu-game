import { CircuitGraph, CircuitNode, ComponentType, LevelDef, Wire } from '../types';
import { buildDefaultControlUnitGraph } from '../engine/subcircuits';

let lwSeq = 1;
const w = (fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): Wire => ({
  id: `lw_${lwSeq++}`,
  fromNodeId,
  fromPinId,
  toNodeId,
  toPinId,
});

const nd = (id: string, type: ComponentType, x: number, y: number, extra?: Partial<CircuitNode>): CircuitNode => ({
  id,
  type,
  x,
  y,
  ...extra,
});

const hasWireTo = (c: CircuitGraph, toTypeOrId: string, toPin?: string) =>
  c.wires.some((wire) => {
    const target = c.nodes.find((n) => n.id === wire.toNodeId);
    if (!target) return false;
    const matchTarget = target.id === toTypeOrId || target.type === toTypeOrId;
    return matchTarget && (!toPin || wire.toPinId === toPin);
  });

const hasNodeType = (c: CircuitGraph, type: ComponentType, count = 1) =>
  c.nodes.filter((n) => n.type === type).length >= count;

const connectedPair = (c: CircuitGraph, fromId: string, toId: string) =>
  c.wires.some((wire) => wire.fromNodeId === fromId && wire.toNodeId === toId);

/** Reusable complete Level 13 / 14 LEGO-8 Motherboard auto-build */
export function buildCpuMotherboardNodes(): CircuitNode[] {
  return [
    nd('clk', 'CLOCK', 30, 35, { label: 'تپش کلاک (CLK)', locked: true }),
    nd('pc', 'PC_8', 210, 30, { label: 'شمارنده برنامه (PC)', locked: true }),
    nd('rom', 'ROM_16', 420, 30, { label: 'حافظه برنامه (ROM)', locked: true }),
    nd('ctrl', 'CONTROL_UNIT', 650, 20, { label: 'واحد کنترل (ساخته خودت)', locked: true }),
    nd('muxA1', 'MUX_8', 210, 210, { label: 'انتخاب‌گر ARG / ALU', locked: true }),
    nd('muxA2', 'MUX_8', 390, 210, { label: 'انتخاب‌گر SWAP', locked: true }),
    nd('orAEn', 'OR_4', 390, 340, { label: 'اجازه نوشتن A', locked: true }),
    nd('regA', 'REG_8', 575, 315, { label: 'رجیستر A', locked: true }),
    nd('regB', 'REG_8', 575, 445, { label: 'رجیستر B', locked: true }),
    nd('regC', 'REG_8', 210, 355, { label: 'رجیستر کمکی C', locked: true }),
    nd('alu', 'ALU_8', 810, 330, { label: 'مغز محاسباتی (ALU)', locked: true }),
    nd('flagZ', 'DFF_EN', 865, 175, { label: 'فلگ صفر (FLAG Z)', locked: true }),
    nd('outDisp', 'OUT_DISPLAY', 810, 485, { label: 'نمایشگر خروجی (OUT)', locked: true }),
  ];
}

export function buildCpuMotherboardAutoBuild(): CircuitGraph {
  return {
    nodes: buildCpuMotherboardNodes(),
    wires: [
      // Clock distribution & HALT
      w('ctrl', 'HALT', 'clk', 'HALT'),
      w('clk', 'CLK', 'pc', 'CLK'),
      w('clk', 'CLK', 'regA', 'CLK'),
      w('clk', 'CLK', 'regB', 'CLK'),
      w('clk', 'CLK', 'regC', 'CLK'),
      w('clk', 'CLK', 'flagZ', 'CLK'),
      w('clk', 'CLK', 'outDisp', 'CLK'),
      // Fetch: PC -> ROM
      w('pc', 'ADDR', 'rom', 'ADDR'),
      // Decode: ROM.OP -> Control Unit
      w('rom', 'OP', 'ctrl', 'OP'),
      w('flagZ', 'Q', 'ctrl', 'Z_FLAG'),
      // Jump path: ROM.ARG & CTRL.PC_LD -> PC
      w('rom', 'ARG', 'pc', 'JMP'),
      w('ctrl', 'PC_LD', 'pc', 'LOAD'),
      // Register A input MUX chain (ARG vs ALU.RES vs REG_C)
      w('rom', 'ARG', 'muxA1', 'A'),
      w('alu', 'RES', 'muxA1', 'B'),
      w('ctrl', 'ALU_WR', 'muxA1', 'SEL'),
      w('muxA1', 'Y', 'muxA2', 'A'),
      w('regC', 'Q', 'muxA2', 'B'),
      w('ctrl', 'SWAP', 'muxA2', 'SEL'),
      w('muxA2', 'Y', 'regA', 'D'),
      // Register A write enable = LD_A OR ALU_WR OR SWAP
      w('ctrl', 'LD_A', 'orAEn', 'A'),
      w('ctrl', 'ALU_WR', 'orAEn', 'B'),
      w('ctrl', 'SWAP', 'orAEn', 'C'),
      w('orAEn', 'Y', 'regA', 'EN'),
      // Register B & C
      w('rom', 'ARG', 'regB', 'D'),
      w('ctrl', 'LD_B', 'regB', 'EN'),
      w('regA', 'Q', 'regC', 'D'),
      w('ctrl', 'SWAP', 'regC', 'EN'),
      // ALU & FLAG Z
      w('regA', 'Q', 'alu', 'A'),
      w('regB', 'Q', 'alu', 'B'),
      w('ctrl', 'ALU_OP0', 'alu', 'OP0'),
      w('ctrl', 'ALU_OP1', 'alu', 'OP1'),
      w('alu', 'ZERO', 'flagZ', 'D'),
      w('ctrl', 'ALU_WR', 'flagZ', 'EN'),
      // Output Display
      w('regA', 'Q', 'outDisp', 'D'),
      w('ctrl', 'OUT_EN', 'outDisp', 'EN'),
    ],
  };
}

/** Build Level 6 auto-build (8-bit Ripple Carry Adder) */
function buildLevel6Auto(): CircuitGraph {
  const nodes: CircuitNode[] = [
    nd('inA', 'INPUT_8', 25, 110, { label: 'عدد A', value: 5, locked: true, portName: 'A', portRole: 'input' }),
    nd('inB', 'INPUT_8', 25, 340, { label: 'عدد B', value: 3, locked: true, portName: 'B', portRole: 'input' }),
    nd('inC', 'SWITCH_1', 45, 570, { label: 'نقلی ورودی (CIN)', value: 0, locked: true, portName: 'CIN', portRole: 'input' }),
    nd('spA', 'SPLITTER_8', 235, 65),
    nd('spB', 'SPLITTER_8', 235, 315),
    nd('mg', 'MERGER_8', 640, 220),
    nd('outS', 'DISPLAY_8', 810, 275, { label: 'حاصل جمع (SUM)', locked: true, portName: 'SUM', portRole: 'output' }),
    nd('outC', 'LED_1', 835, 600, { label: 'سرریز (COUT)', locked: true, portName: 'COUT', portRole: 'output' }),
  ];
  const wires: Wire[] = [
    w('inA', 'OUT', 'spA', 'IN'),
    w('inB', 'OUT', 'spB', 'IN'),
    w('mg', 'OUT', 'outS', 'IN'),
  ];
  for (let i = 0; i < 8; i++) {
    const fid = `fa${i}`;
    nodes.push(nd(fid, 'FULL_ADDER', 425, 15 + i * 98, { label: `بیت ${i}` }));
    wires.push(w('spA', `B${i}`, fid, 'A'), w('spB', `B${i}`, fid, 'B'), w(fid, 'SUM', 'mg', `B${i}`));
    if (i === 0) wires.push(w('inC', 'OUT', fid, 'CIN'));
    else wires.push(w(`fa${i - 1}`, 'COUT', fid, 'CIN'));
  }
  wires.push(w('fa7', 'COUT', 'outC', 'IN'));
  return { nodes, wires };
}

/** Build Level 12 auto-build from default control unit mapped to level I/O nodes */
function buildLevel12Initial(): CircuitGraph {
  return {
    nodes: [
      nd('in_op', 'INPUT_4', 30, 180, { label: 'آپ‌کد OP[3:0]', value: 3, locked: true, portName: 'OP', portRole: 'input' }),
      nd('in_z', 'SWITCH_1', 45, 455, { label: 'پرچم صفر (Z_FLAG)', value: 0, locked: true, portName: 'Z_FLAG', portRole: 'input' }),
      nd('out_lda', 'LED_1', 790, 20, { label: 'LD_A', locked: true, portName: 'LD_A', portRole: 'output' }),
      nd('out_ldb', 'LED_1', 790, 88, { label: 'LD_B', locked: true, portName: 'LD_B', portRole: 'output' }),
      nd('out_aluwr', 'LED_1', 790, 156, { label: 'ALU_WR', locked: true, portName: 'ALU_WR', portRole: 'output' }),
      nd('out_op0', 'LED_1', 790, 224, { label: 'ALU_OP0', locked: true, portName: 'ALU_OP0', portRole: 'output' }),
      nd('out_op1', 'LED_1', 790, 292, { label: 'ALU_OP1', locked: true, portName: 'ALU_OP1', portRole: 'output' }),
      nd('out_out', 'LED_1', 790, 360, { label: 'OUT_EN', locked: true, portName: 'OUT_EN', portRole: 'output' }),
      nd('out_pcld', 'LED_1', 790, 428, { label: 'PC_LD', locked: true, portName: 'PC_LD', portRole: 'output' }),
      nd('out_hlt', 'LED_1', 790, 496, { label: 'HALT', locked: true, portName: 'HALT', portRole: 'output' }),
      nd('out_swp', 'LED_1', 790, 564, { label: 'SWAP', locked: true, portName: 'SWAP', portRole: 'output' }),
    ],
    wires: [],
  };
}

function buildLevel12Auto(): CircuitGraph {
  const base = buildLevel12Initial();
  const defCtrl = buildDefaultControlUnitGraph();
  const middleNodes = defCtrl.nodes.filter((n) => n.type !== 'PORT_IN' && n.type !== 'PORT_OUT');
  const idMap: Record<string, string> = {
    p_op: 'in_op',
    p_z: 'in_z',
    o_lda: 'out_lda',
    o_ldb: 'out_ldb',
    o_aluwr: 'out_aluwr',
    o_op0: 'out_op0',
    o_op1: 'out_op1',
    o_out: 'out_out',
    o_pcld: 'out_pcld',
    o_hlt: 'out_hlt',
    o_swp: 'out_swp',
  };
  const wires = defCtrl.wires.map((wire, idx) => ({
    id: `l12w_${idx}`,
    fromNodeId: idMap[wire.fromNodeId] ?? wire.fromNodeId,
    fromPinId: wire.fromPinId,
    toNodeId: idMap[wire.toNodeId] ?? wire.toNodeId,
    toPinId: wire.toPinId,
  }));
  return {
    nodes: [...base.nodes, ...middleNodes],
    wires,
  };
}

export const CAMPAIGN_LEVELS: LevelDef[] = [
  // ================= CHAPTER 1 =================
  {
    id: 1,
    chapter: 1,
    chapterTitle: 'فصل ۱: الفبای برق و منطق',
    title: 'اولین بیت (برق، کلید و لامپ)',
    shortGoal: 'یک کلید برق و یک لامپ روی تخته بگذار و با یک سیم به هم وصل کن تا اولین بیت را روشن کنی!',
    palette: ['SWITCH_1', 'LED_1'],
    lesson: {
      storyTitle: 'همه چیز از یک کلید چراغ شروع می‌شود!',
      storyText:
        'شاید عجیب باشد اما تمام بازی‌ها، ویدیوها و هوش مصنوعی جهان در نهایت فقط از میلیاردها کلید برق بسیار ریز ساخته شده‌اند! هر سیم فقط دو حالت دارد: یا برق ندارد (عدد ۰) یا برق دارد (عدد ۱). به این دو حالت ساده «بیت» (Bit) می‌گویند.',
      howTitle: 'جریان برق روی سیم چطور کار می‌کند؟',
      howText:
        'وقتی پایه خروجی یک کلید (سمت راست بلوک) را به پایه ورودی یک لامپ (سمت چپ بلوک) وصل کنی، با زدن کلید، برق به صورت نئونی در سیم جاری شده و لامپ روشن می‌شود.',
      howDiagram: '[ کلید برق: 0 ] ───── (سیم خاموش) ─────▶ [ لامپ خاموش ]\n[ کلید برق: 1 ] ═════ ⚡ برق جاری! ═════▶ [ لامپ روشن 💡 ]',
      missionTitle: 'ماموریت تو در این مرحله',
      missionText:
        'از منوی قطعات سمت راست، یک «کلید برق ۱ بیتی» و یک «لامپ ۱ بیتی» روی تخته بگذار، خروجی کلید را به ورودی لامپ سیم‌کشی کن و سپس دکمه «تست مدار» را بزن!',
      unlocksText: 'تسلط بر مفهوم بیت (۰ و ۱) و سیم‌کشی روی تخته‌مدار لگویی',
    },
    hint: 'روی «کلید برق ۱ بیتی» و «لامپ ۱ بیتی» در منوی سمت راست کلیک کن تا روی تخته بیایند؛ سپس از دایره سمت راست کلید به دایره سمت چپ لامپ سیم بکش!',
    coachSteps: [
      { id: '1_1', text: 'گام ۱: یک بلوک «کلید برق ۱ بیتی» از منوی سمت راست روی تخته بگذار.', check: (c) => hasNodeType(c, 'SWITCH_1') },
      { id: '1_2', text: 'گام ۲: یک بلوک «لامپ ۱ بیتی» روی تخته بگذار.', check: (c) => hasNodeType(c, 'LED_1') },
      { id: '1_3', text: 'گام ۳: از خروجی کلید به ورودی لامپ یک سیم وصل کن.', check: (c) => hasWireTo(c, 'LED_1', 'IN') },
    ],
    initialCircuit: { nodes: [], wires: [] },
    autoBuildCircuit: {
      nodes: [
        nd('sw1', 'SWITCH_1', 140, 190, { label: 'کلید A', value: 1 }),
        nd('led1', 'LED_1', 420, 190, { label: 'لامپ Y' }),
      ],
      wires: [w('sw1', 'OUT', 'led1', 'IN')],
    },
    testKind: 'combinational',
    combTests: [
      { label: 'کلید خاموش (0)', inputs: { A: 0 }, expected: { Y: 0 } },
      { label: 'کلید روشن (1)', inputs: { A: 1 }, expected: { Y: 1 } },
    ],
    unlocks: ['NOT', 'AND', 'OR'],
  },

  {
    id: 2,
    chapter: 1,
    chapterTitle: 'فصل ۱: الفبای برق و منطق',
    title: 'گیت‌های پایه (NOT، AND، OR)',
    shortGoal: 'سه معمای واقعی (قفل گاوصندوق، دزدگیر دوحسگره و چراغ شب خودکار) را با گیت‌های AND، OR و NOT حل کن.',
    palette: ['AND', 'OR', 'NOT'],
    lesson: {
      storyTitle: 'نگهبان‌های هوشمند برق!',
      storyText:
        'سه گیت پایه مثل نگهبان‌های باهوش هستند: ۱) گیت AND مثل قفل دوکلیده گاوصندوق بانک است؛ هر دو کلید باید هم‌زمان باشند. ۲) گیت OR مثل دزدگیر خانه است؛ چه در باز شود چه پنجره، آژیر می‌زند! ۳) گیت NOT مثل چراغ شب است؛ وقتی خورشید خاموش (۰) شد، چراغ روشن (۱) می‌شود.',
      howTitle: 'قانون ساده هر سه گیت',
      howText: 'هر گیت بیت‌های ورودی را می‌بیند و فوراً تصمیم می‌گیرد خروجی ۰ باشد یا ۱:',
      howDiagram: 'AND: فقط 1 و 1 ← 1\nOR:  هر کدام 1 باشد ← 1\nNOT: برعکس می‌کند (0 ← 1 ، 1 ← 0)',
      missionTitle: 'ماموریت تو: حل ۳ معما روی یک تخته!',
      missionText:
        'بالا: قفل گاوصندوق (AND) | وسط: دزدگیر در و پنجره (OR) | پایین: چراغ شب خودکار (NOT). هر سه را با گیت مناسب به خروجی‌شان وصل کن.',
      unlocksText: 'تسلط کامل بر سه سنگ‌بنای اصلی منطق دیجیتال (AND, OR, NOT)',
    },
    hint: 'بالا یک AND بین کلید ۱ و ۲ بگذار. وسط یک OR بین حسگر در و پنجره. پایین یک NOT بین نور خورشید و چراغ شب!',
    coachSteps: [
      { id: '2_1', text: 'گام ۱: برای قفل گاوصندوق (بالا) یک گیت AND قرار بده و به Y1 وصل کن.', check: (c) => hasNodeType(c, 'AND') && hasWireTo(c, 'y1', 'IN') },
      { id: '2_2', text: 'گام ۲: برای دزدگیر (وسط) یک گیت OR قرار بده و به Y2 وصل کن.', check: (c) => hasNodeType(c, 'OR') && hasWireTo(c, 'y2', 'IN') },
      { id: '2_3', text: 'گام ۳: برای چراغ شب (پایین) یک گیت NOT قرار بده و به Y3 وصل کن.', check: (c) => hasNodeType(c, 'NOT') && hasWireTo(c, 'y3', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('a1', 'SWITCH_1', 60, 40, { label: 'کلید ۱ گاوصندوق', value: 1, locked: true, portName: 'A1', portRole: 'input' }),
        nd('b1', 'SWITCH_1', 60, 120, { label: 'کلید ۲ گاوصندوق', value: 1, locked: true, portName: 'B1', portRole: 'input' }),
        nd('y1', 'LED_1', 540, 80, { label: 'قفل گاوصندوق', locked: true, portName: 'Y1', portRole: 'output' }),

        nd('a2', 'SWITCH_1', 60, 230, { label: 'حسگر در', value: 0, locked: true, portName: 'A2', portRole: 'input' }),
        nd('b2', 'SWITCH_1', 60, 310, { label: 'حسگر پنجره', value: 1, locked: true, portName: 'B2', portRole: 'input' }),
        nd('y2', 'LED_1', 540, 270, { label: 'آژیر دزدگیر', locked: true, portName: 'Y2', portRole: 'output' }),

        nd('a3', 'SWITCH_1', 60, 425, { label: 'نور خورشید', value: 0, locked: true, portName: 'A3', portRole: 'input' }),
        nd('y3', 'LED_1', 540, 425, { label: 'چراغ شب', locked: true, portName: 'Y3', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('a1', 'SWITCH_1', 60, 40, { label: 'کلید ۱ گاوصندوق', value: 1, locked: true, portName: 'A1', portRole: 'input' }),
        nd('b1', 'SWITCH_1', 60, 120, { label: 'کلید ۲ گاوصندوق', value: 1, locked: true, portName: 'B1', portRole: 'input' }),
        nd('g_and', 'AND', 300, 75),
        nd('y1', 'LED_1', 540, 80, { label: 'قفل گاوصندوق', locked: true, portName: 'Y1', portRole: 'output' }),

        nd('a2', 'SWITCH_1', 60, 230, { label: 'حسگر در', value: 0, locked: true, portName: 'A2', portRole: 'input' }),
        nd('b2', 'SWITCH_1', 60, 310, { label: 'حسگر پنجره', value: 1, locked: true, portName: 'B2', portRole: 'input' }),
        nd('g_or', 'OR', 300, 265),
        nd('y2', 'LED_1', 540, 270, { label: 'آژیر دزدگیر', locked: true, portName: 'Y2', portRole: 'output' }),

        nd('a3', 'SWITCH_1', 60, 425, { label: 'نور خورشید', value: 0, locked: true, portName: 'A3', portRole: 'input' }),
        nd('g_not', 'NOT', 300, 425),
        nd('y3', 'LED_1', 540, 425, { label: 'چراغ شب', locked: true, portName: 'Y3', portRole: 'output' }),
      ],
      wires: [
        w('a1', 'OUT', 'g_and', 'A'),
        w('b1', 'OUT', 'g_and', 'B'),
        w('g_and', 'Y', 'y1', 'IN'),
        w('a2', 'OUT', 'g_or', 'A'),
        w('b2', 'OUT', 'g_or', 'B'),
        w('g_or', 'Y', 'y2', 'IN'),
        w('a3', 'OUT', 'g_not', 'A'),
        w('g_not', 'Y', 'y3', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: 'تست ۱ (همه خاموش)', inputs: { A1: 0, B1: 0, A2: 0, B2: 0, A3: 0 }, expected: { Y1: 0, Y2: 0, Y3: 1 } },
      { label: 'تست ۲ (یکی روشن)', inputs: { A1: 1, B1: 0, A2: 1, B2: 0, A3: 1 }, expected: { Y1: 0, Y2: 1, Y3: 0 } },
      { label: 'تست ۳ (دومی روشن)', inputs: { A1: 0, B1: 1, A2: 0, B2: 1, A3: 0 }, expected: { Y1: 0, Y2: 1, Y3: 1 } },
      { label: 'تست ۴ (هر دو روشن)', inputs: { A1: 1, B1: 1, A2: 1, B2: 1, A3: 1 }, expected: { Y1: 1, Y2: 1, Y3: 0 } },
    ],
    unlocks: [],
  },

  {
    id: 3,
    chapter: 1,
    chapterTitle: 'فصل ۱: الفبای برق و منطق',
    title: 'ساخت گیت XOR (یا انحصاری)',
    shortGoal: 'با ترکیب گیت‌های NOT، AND و OR مداری بساز که فقط وقتی A و B با هم «متفاوت» باشند خروجی ۱ بدهد.',
    palette: ['NOT', 'AND', 'OR'],
    lesson: {
      storyTitle: 'کلید دوپل راهپله (یا این، یا آن، نه هر دو!)',
      storyText:
        'فکر کن برای شام به تو بگویند «یا پیتزا بخور یا همبرگر، اما هر دو با هم نه!» به این قانون در منطق دیجیتال می‌گویند XOR (یا انحصاری). وقتی دو ورودی متفاوت باشند (یکی ۰ و دیگری ۱) خروجی روشن می‌شود، ولی اگر هر دو مثل هم باشند خروجی خاموش است.',
      howTitle: 'فرمول ساخت XOR با قطعات پایه',
      howText:
        'خروجی باید روشن شود اگر: «A روشن باشد و B خاموش» یا «A خاموش باشد و B روشن»!',
      howDiagram: 'A=0, B=0 → 0\nA=0, B=1 → 1\nA=1, B=0 → 1\nA=1, B=1 → 0\nفرمول: (A AND NOT B) OR (NOT A AND B)',
      missionTitle: 'ماموریت تو و جایزه ساخت قطعه',
      missionText:
        'مدار XOR را با دو NOT، دو AND و یک OR بساز. به محض قبولی، این مدار تبدیل به یک آجر لگویی آماده به نام «XOR» می‌شود!',
      unlocksText: 'باز شدن آی‌سی لگویی XOR (با قابلیت مشاهده داخل قطعه!)',
    },
    hint: 'دو NOT بگذار (یکی برای A و یکی برای B). یک AND برای (A و NOT B) و یک AND برای (NOT A و B) بگذار و خروجی هر دو را به یک OR بده.',
    coachSteps: [
      { id: '3_1', text: 'گام ۱: دو گیت NOT بگذار و یکی را به A و دیگری را به B وصل کن.', check: (c) => hasNodeType(c, 'NOT', 2) },
      { id: '3_2', text: 'گام ۲: دو گیت AND اضافه کن تا (A و NOT B) و (NOT A و B) را بسازی.', check: (c) => hasNodeType(c, 'AND', 2) },
      { id: '3_3', text: 'گام ۳: یک گیت OR بگذار، خروجی دو AND را به آن وصل کن و خروجی OR را به لامپ Y بده.', check: (c) => hasNodeType(c, 'OR') && hasWireTo(c, 'outY', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 40, 100, { label: 'ورودی A', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 40, 260, { label: 'ورودی B', value: 0, locked: true, portName: 'B', portRole: 'input' }),
        nd('outY', 'LED_1', 670, 180, { label: 'خروجی XOR', locked: true, portName: 'Y', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 40, 100, { label: 'ورودی A', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 40, 260, { label: 'ورودی B', value: 0, locked: true, portName: 'B', portRole: 'input' }),
        nd('nA', 'NOT', 210, 60),
        nd('nB', 'NOT', 210, 280),
        nd('and1', 'AND', 370, 90),
        nd('and2', 'AND', 370, 240),
        nd('or1', 'OR', 525, 170),
        nd('outY', 'LED_1', 670, 180, { label: 'خروجی XOR', locked: true, portName: 'Y', portRole: 'output' }),
      ],
      wires: [
        w('inA', 'OUT', 'nA', 'A'),
        w('inB', 'OUT', 'nB', 'A'),
        w('inA', 'OUT', 'and1', 'A'),
        w('nB', 'Y', 'and1', 'B'),
        w('nA', 'Y', 'and2', 'A'),
        w('inB', 'OUT', 'and2', 'B'),
        w('and1', 'Y', 'or1', 'A'),
        w('and2', 'Y', 'or1', 'B'),
        w('or1', 'Y', 'outY', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: '0 XOR 0', inputs: { A: 0, B: 0 }, expected: { Y: 0 } },
      { label: '0 XOR 1', inputs: { A: 0, B: 1 }, expected: { Y: 1 } },
      { label: '1 XOR 0', inputs: { A: 1, B: 0 }, expected: { Y: 1 } },
      { label: '1 XOR 1', inputs: { A: 1, B: 1 }, expected: { Y: 0 } },
    ],
    unlocks: ['XOR'],
  },

  // ================= CHAPTER 2 =================
  {
    id: 4,
    chapter: 2,
    chapterTitle: 'فصل ۲: کامپیوتر چطور حساب می‌کند؟',
    title: 'اعداد باینری و نیم‌جمع‌کننده (Half Adder)',
    shortGoal: 'دو بیت A و B را جمع کن و حاصل جمع (SUM) و رقم نقلی (CARRY) را بساز!',
    palette: ['XOR', 'AND', 'OR', 'NOT'],
    lesson: {
      storyTitle: 'راز بزرگ جمع در کامپیوتر: 1 + 1 = 10!',
      storyText:
        'در دنیای باینری فقط ۰ و ۱ داریم؛ پس وقتی ۱ را با ۱ جمع می‌کنیم به جای «۲» می‌نویسیم «۱۰» (یعنی یکان ۰ می‌شود و یک رقم نقلی ۱ به ستون بعدی می‌رود!). دقیقاً مثل وقتی در جمع معمولی ۵ + ۵ می‌نویسیم ۰ و ۱ به دست داریم.',
      howTitle: 'به جدول جمع دو بیت با دقت نگاه کن!',
      howText: 'ستون SUM دقیقاً شبیه گیت XOR است و ستون CARRY دقیقاً شبیه گیت AND است! چقدر زیبا!',
      howDiagram: '0 + 0 = 0  (CARRY=0, SUM=0)\n0 + 1 = 1  (CARRY=0, SUM=1)\n1 + 0 = 1  (CARRY=0, SUM=1)\n1 + 1 = 10 (CARRY=1, SUM=0)',
      missionTitle: 'ماموریت تو: اولین مدار ریاضی خودت!',
      missionText:
        'با استفاده از آجر جدید XOR (که خودت ساختی!) و گیت AND، نیم‌جمع‌کننده را بساز و به خروجی‌های SUM و CARRY وصل کن.',
      unlocksText: 'باز شدن آی‌سی لگویی «نیم‌جمع‌کننده (Half Adder)»',
    },
    hint: 'A و B را به یک XOR بده و خروجی آن را به SUM وصل کن. همچنین A و B را به یک AND بده و خروجی آن را به CARRY وصل کن.',
    coachSteps: [
      { id: '4_1', text: 'گام ۱: یک بلوک XOR بگذار و ورودی‌های A و B را به آن وصل کن.', check: (c) => hasNodeType(c, 'XOR') },
      { id: '4_2', text: 'گام ۲: خروجی XOR را به لامپ SUM وصل کن.', check: (c) => hasWireTo(c, 'outS', 'IN') },
      { id: '4_3', text: 'گام ۳: یک گیت AND بگذار، A و B را به آن وصل کن و خروجی‌اش را به CARRY بده.', check: (c) => hasNodeType(c, 'AND') && hasWireTo(c, 'outC', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 60, 100, { label: 'بیت A', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 60, 240, { label: 'بیت B', value: 1, locked: true, portName: 'B', portRole: 'input' }),
        nd('outS', 'LED_1', 500, 100, { label: 'حاصل (SUM)', locked: true, portName: 'SUM', portRole: 'output' }),
        nd('outC', 'LED_1', 500, 240, { label: 'نقلی (CARRY)', locked: true, portName: 'CARRY', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 60, 100, { label: 'بیت A', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 60, 240, { label: 'بیت B', value: 1, locked: true, portName: 'B', portRole: 'input' }),
        nd('g_xor', 'XOR', 275, 95),
        nd('g_and', 'AND', 275, 235),
        nd('outS', 'LED_1', 500, 100, { label: 'حاصل (SUM)', locked: true, portName: 'SUM', portRole: 'output' }),
        nd('outC', 'LED_1', 500, 240, { label: 'نقلی (CARRY)', locked: true, portName: 'CARRY', portRole: 'output' }),
      ],
      wires: [
        w('inA', 'OUT', 'g_xor', 'A'),
        w('inB', 'OUT', 'g_xor', 'B'),
        w('g_xor', 'Y', 'outS', 'IN'),
        w('inA', 'OUT', 'g_and', 'A'),
        w('inB', 'OUT', 'g_and', 'B'),
        w('g_and', 'Y', 'outC', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: '0 + 0', inputs: { A: 0, B: 0 }, expected: { SUM: 0, CARRY: 0 } },
      { label: '0 + 1', inputs: { A: 0, B: 1 }, expected: { SUM: 1, CARRY: 0 } },
      { label: '1 + 0', inputs: { A: 1, B: 0 }, expected: { SUM: 1, CARRY: 0 } },
      { label: '1 + 1 = 10₂', inputs: { A: 1, B: 1 }, expected: { SUM: 0, CARRY: 1 } },
    ],
    unlocks: ['HALF_ADDER'],
  },

  {
    id: 5,
    chapter: 2,
    chapterTitle: 'فصل ۲: کامپیوتر چطور حساب می‌کند؟',
    title: 'تمام‌جمع‌کننده (Full Adder)',
    shortGoal: 'دو نیم‌جمع‌کننده و یک گیت OR را ترکیب کن تا سه بیت (A، B و رقم نقلی ورودی CIN) را با هم جمع کنی!',
    palette: ['HALF_ADDER', 'OR', 'XOR', 'AND'],
    lesson: {
      storyTitle: 'چرا «نیم»‌جمع‌کننده کافی نیست؟',
      storyText:
        'وقتی اعداد چندرقمی جمع می‌کنی، ستون دوم علاوه بر رقم‌های A و B باید «رقم نقلی» (CIN) که از ستون قبلی آمده را هم جمع بزند! یعنی باید بتوانیم ۳ بیت را هم‌زمان جمع کنیم (حداکثر 1+1+1 = 11₂ یعنی SUM=1 و COUT=1).',
      howTitle: 'جمع سه عدد به روش مرحله‌ای',
      howText:
        'خیلی ساده: اول A و B را با یک Half Adder جمع کن. بعد حاصلش (SUM) را با CIN در یک Half Adder دوم جمع کن! اگر در هر کدام از این دو مرحله رقم نقلی تولید شد، با یک گیت OR به COUT بفرست.',
      howDiagram: 'HA1(A, B) ──▶ S1 ──▶ HA2(S1, CIN) ──▶ SUM نهایی\n   └── C1 ──┐\n            ├──▶ OR ──▶ COUT نهایی\n   HA2.C2 ──┘',
      missionTitle: 'ماموریت تو: ساخت آجر طلایی محاسبات',
      missionText:
        'دو بلوک Half Adder و یک OR روی تخته بگذار و تمام‌جمع‌کننده را تکمیل کن تا برای جمع‌کننده ۸ بیتی آماده شوی!',
      unlocksText: 'باز شدن آی‌سی «تمام‌جمع‌کننده (Full Adder)»',
    },
    hint: 'A و B را به HA1 بده. خروجی SUM از HA1 و ورودی CIN را به HA2 بده. خروجی SUM از HA2 می‌شود SUM نهایی، و OR دو CARRY می‌شود COUT!',
    coachSteps: [
      { id: '5_1', text: 'گام ۱: دو بلوک «نیم‌جمع‌کننده (Half Adder)» روی تخته قرار بده.', check: (c) => hasNodeType(c, 'HALF_ADDER', 2) },
      { id: '5_2', text: 'گام ۲: یک گیت OR برای ترکیب دو خروجی CARRY اضافه کن.', check: (c) => hasNodeType(c, 'OR') },
      { id: '5_3', text: 'گام ۳: خروجی SUM نهایی و خروجی COUT را به لامپ‌ها وصل کن.', check: (c) => hasWireTo(c, 'outS', 'IN') && hasWireTo(c, 'outC', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 40, 60, { label: 'بیت A', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 40, 165, { label: 'بیت B', value: 1, locked: true, portName: 'B', portRole: 'input' }),
        nd('inC', 'SWITCH_1', 40, 270, { label: 'نقلی ورودی (CIN)', value: 1, locked: true, portName: 'CIN', portRole: 'input' }),
        nd('outS', 'LED_1', 700, 110, { label: 'حاصل (SUM)', locked: true, portName: 'SUM', portRole: 'output' }),
        nd('outC', 'LED_1', 700, 240, { label: 'نقلی خروجی (COUT)', locked: true, portName: 'COUT', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 40, 60, { label: 'بیت A', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 40, 165, { label: 'بیت B', value: 1, locked: true, portName: 'B', portRole: 'input' }),
        nd('inC', 'SWITCH_1', 40, 270, { label: 'نقلی ورودی (CIN)', value: 1, locked: true, portName: 'CIN', portRole: 'input' }),
        nd('ha1', 'HALF_ADDER', 210, 80, { label: 'نیم‌جمع ۱' }),
        nd('ha2', 'HALF_ADDER', 395, 115, { label: 'نیم‌جمع ۲' }),
        nd('or1', 'OR', 560, 235),
        nd('outS', 'LED_1', 700, 110, { label: 'حاصل (SUM)', locked: true, portName: 'SUM', portRole: 'output' }),
        nd('outC', 'LED_1', 700, 240, { label: 'نقلی خروجی (COUT)', locked: true, portName: 'COUT', portRole: 'output' }),
      ],
      wires: [
        w('inA', 'OUT', 'ha1', 'A'),
        w('inB', 'OUT', 'ha1', 'B'),
        w('ha1', 'SUM', 'ha2', 'A'),
        w('inC', 'OUT', 'ha2', 'B'),
        w('ha1', 'CARRY', 'or1', 'A'),
        w('ha2', 'CARRY', 'or1', 'B'),
        w('ha2', 'SUM', 'outS', 'IN'),
        w('or1', 'Y', 'outC', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: '0+0+0', inputs: { A: 0, B: 0, CIN: 0 }, expected: { SUM: 0, COUT: 0 } },
      { label: '0+0+1', inputs: { A: 0, B: 0, CIN: 1 }, expected: { SUM: 1, COUT: 0 } },
      { label: '0+1+0', inputs: { A: 0, B: 1, CIN: 0 }, expected: { SUM: 1, COUT: 0 } },
      { label: '0+1+1', inputs: { A: 0, B: 1, CIN: 1 }, expected: { SUM: 0, COUT: 1 } },
      { label: '1+0+0', inputs: { A: 1, B: 0, CIN: 0 }, expected: { SUM: 1, COUT: 0 } },
      { label: '1+0+1', inputs: { A: 1, B: 0, CIN: 1 }, expected: { SUM: 0, COUT: 1 } },
      { label: '1+1+0', inputs: { A: 1, B: 1, CIN: 0 }, expected: { SUM: 0, COUT: 1 } },
      { label: '1+1+1 = 11₂', inputs: { A: 1, B: 1, CIN: 1 }, expected: { SUM: 1, COUT: 1 } },
    ],
    unlocks: ['FULL_ADDER', 'SPLITTER_8', 'MERGER_8', 'INPUT_8', 'DISPLAY_8', 'CONST_0', 'CONST_1'],
  },

  {
    id: 6,
    chapter: 2,
    chapterTitle: 'فصل ۲: کامپیوتر چطور حساب می‌کند؟',
    title: 'جمع‌کننده ۸ بیتی (8-bit Ripple Adder)',
    shortGoal: 'با زنجیر کردن ۸ تمام‌جمع‌کننده و استفاده از جداکننده/ادغام‌کننده گذرگاه ۸ بیتی، دو عدد از ۰ تا ۲۵۵ را جمع کن!',
    palette: ['FULL_ADDER', 'SPLITTER_8', 'MERGER_8'],
    lesson: {
      storyTitle: 'اثر دومینوی رقم نقلی (Ripple Carry)!',
      storyText:
        'حالا که می‌توانی یک ستون را جمع بزنی، جمع زدن اعداد بزرگ (تا ۲۵۵) مثل چیدن ۸ دومینو پشت سر هم است! دو «جداکننده ۸ به ۱» کابل‌های ۸ بیتی A و B را به ۸ سیم باز می‌کنند، ۸ تمام‌جمع‌کننده هر بیت را جمع می‌زنند و COUT هر طبقه مثل دومینو به CIN طبقه بعدی می‌رود.',
      howTitle: 'چطور ۸ بیت یک بایت می‌سازند؟',
      howText:
        'بیت B0 ارزش ۱ دارد، B1 ارزش ۲، B2 ارزش ۴ ... تا B7 با ارزش ۱۲۸! در پایان، «ادغام‌کننده ۱ به ۸» دوباره ۸ حاصل SUM را در یک کابل ۸ بیتی جمع می‌کند.',
      howDiagram: 'A[7:0] ─▶ SPLIT ─▶ FA0 ─(C)─▶ FA1 ─(C)─▶ ... ─▶ FA7 ─▶ COUT\n                     └────────── MERGE ──────────▶ SUM[7:0]',
      missionTitle: 'ماموریت تو: ساخت ماشین‌حساب ۸ بیتی واقعی',
      missionText:
        'دو Splitter، هشت Full Adder و یک Merger را به هم وصل کن (اگر خواستی الگوی تمیز آن را سریع ببینی از دکمه «چیدمان خودکار» استفاده کن و عدد ۱۵ + ۱ را تست کن تا موج Carry را ببینی!).',
      unlocksText: 'باز شدن آی‌سی قدرتمند «جمع‌کننده ۸ بیتی (ADDER-8)»',
    },
    hint: 'دو SPLITTER_8 برای A و B بگذار. ۸ تا FULL_ADDER بچین: بیت B0..B7 هر دو را به FA0..FA7 بده، CIN ورودی به FA0 و COUT هر FA به CIN بعدی برود. در آخر همه SUMها را به MERGER_8 وصل کن.',
    coachSteps: [
      { id: '6_1', text: 'گام ۱: دو «جداکننده ۸ به ۱» برای باز کردن گذرگاه A و B قرار بده.', check: (c) => hasNodeType(c, 'SPLITTER_8', 2) },
      { id: '6_2', text: 'گام ۲: هشت عدد «تمام‌جمع‌کننده (Full Adder)» روی تخته بگذار.', check: (c) => hasNodeType(c, 'FULL_ADDER', 8) },
      { id: '6_3', text: 'گام ۳: یک «ادغام‌کننده ۱ به ۸» بگذار و به نمایشگر SUM وصل کن.', check: (c) => hasNodeType(c, 'MERGER_8') && hasWireTo(c, 'outS', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('inA', 'INPUT_8', 25, 110, { label: 'عدد A', value: 15, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'INPUT_8', 25, 340, { label: 'عدد B', value: 1, locked: true, portName: 'B', portRole: 'input' }),
        nd('inC', 'SWITCH_1', 45, 570, { label: 'نقلی ورودی (CIN)', value: 0, locked: true, portName: 'CIN', portRole: 'input' }),
        nd('outS', 'DISPLAY_8', 810, 275, { label: 'حاصل جمع (SUM)', locked: true, portName: 'SUM', portRole: 'output' }),
        nd('outC', 'LED_1', 835, 600, { label: 'سرریز (COUT)', locked: true, portName: 'COUT', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: buildLevel6Auto(),
    testKind: 'combinational',
    combTests: [
      { label: '0 + 0', inputs: { A: 0, B: 0, CIN: 0 }, expected: { SUM: 0, COUT: 0 } },
      { label: '5 + 3 = 8', inputs: { A: 5, B: 3, CIN: 0 }, expected: { SUM: 8, COUT: 0 } },
      { label: '15 + 1 = 16 (موج نقلی!)', inputs: { A: 15, B: 1, CIN: 0 }, expected: { SUM: 16, COUT: 0 } },
      { label: '127 + 1 = 128', inputs: { A: 127, B: 1, CIN: 0 }, expected: { SUM: 128, COUT: 0 } },
      { label: '200 + 55 = 255', inputs: { A: 200, B: 55, CIN: 0 }, expected: { SUM: 255, COUT: 0 } },
      { label: '255 + 1 = 0 (سرریز!)', inputs: { A: 255, B: 1, CIN: 0 }, expected: { SUM: 0, COUT: 1 } },
      { label: '100 + 50 + CIN(1) = 151', inputs: { A: 100, B: 50, CIN: 1 }, expected: { SUM: 151, COUT: 0 } },
    ],
    unlocks: ['ADDER_8'],
  },

  // ================= CHAPTER 3 =================
  {
    id: 7,
    chapter: 3,
    chapterTitle: 'فصل ۳: مسیریابی برق و مغز محاسباتی',
    title: 'سوزن‌بان برق (انتخاب‌گر مسیر / MUX)',
    shortGoal: 'مداری بساز که با یک سیم انتخاب‌گر (SEL)، اگر SEL=0 بود ورودی A و اگر SEL=1 بود ورودی B را به خروجی بفرستد.',
    palette: ['NOT', 'AND', 'OR'],
    lesson: {
      storyTitle: 'سوزن‌بان راه‌آهن در قلب پردازنده!',
      storyText:
        'در پردازنده مدام باید تصمیم بگیریم «الان کدام داده عبور کند؟ مثلاً نتیجه جمع یا تفریق؟ عدد از ROM یا از ALU؟» قطعه‌ای که مثل سوزن‌بان ریل قطار این کار را می‌کند مالتی‌پلکسر (MUX) نام دارد.',
      howTitle: 'منطق پشت سوزن‌بان (MUX)',
      howText:
        'وقتی SEL=0 باشد، «NOT SEL» برابر ۱ می‌شود پس گیت AND اول مسیر A را باز می‌کند و مسیر B بسته است. وقتی SEL=1 باشد، برعکس! در نهایت یک OR دو مسیر را به خروجی Y می‌رساند.',
      howDiagram: 'SEL = 0 ──▶ مسیر A باز است ──▶ Y = A\nSEL = 1 ──▶ مسیر B باز است ──▶ Y = B\nفرمول: (A AND NOT SEL) OR (B AND SEL)',
      missionTitle: 'ماموریت تو: ساخت کلید انتخاب‌گر مسیر',
      missionText:
        'با یک NOT، دو AND و یک OR سوزن‌بان ۱ بیتی را بساز تا هر دو قطعه MUX-1 و MUX-8 برایت باز شوند!',
      unlocksText: 'باز شدن آی‌سی‌های «سوزن‌بان ۱ بیتی (MUX-1)» و «۸ بیتی (MUX-8)»',
    },
    hint: 'SEL را به NOT بده. خروجی NOT و A را به AND اول، و SEL و B را به AND دوم بده. خروجی هر دو AND را با OR به Y وصل کن.',
    coachSteps: [
      { id: '7_1', text: 'گام ۱: یک گیت NOT بگذار و ورودی SEL را به آن وصل کن.', check: (c) => hasNodeType(c, 'NOT') },
      { id: '7_2', text: 'گام ۲: دو گیت AND بگذار تا هر مسیر (A با NOT SEL) و (B با SEL) را کنترل کنی.', check: (c) => hasNodeType(c, 'AND', 2) },
      { id: '7_3', text: 'گام ۳: یک گیت OR بگذار و خروجی آن را به لامپ Y وصل کن.', check: (c) => hasNodeType(c, 'OR') && hasWireTo(c, 'outY', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 45, 50, { label: 'مسیر A (SEL=0)', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 45, 165, { label: 'مسیر B (SEL=1)', value: 0, locked: true, portName: 'B', portRole: 'input' }),
        nd('inS', 'SWITCH_1', 45, 280, { label: 'انتخاب‌گر (SEL)', value: 0, locked: true, portName: 'SEL', portRole: 'input' }),
        nd('outY', 'LED_1', 670, 165, { label: 'خروجی Y', locked: true, portName: 'Y', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inA', 'SWITCH_1', 45, 50, { label: 'مسیر A (SEL=0)', value: 1, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'SWITCH_1', 45, 165, { label: 'مسیر B (SEL=1)', value: 0, locked: true, portName: 'B', portRole: 'input' }),
        nd('inS', 'SWITCH_1', 45, 280, { label: 'انتخاب‌گر (SEL)', value: 0, locked: true, portName: 'SEL', portRole: 'input' }),
        nd('nS', 'NOT', 210, 275),
        nd('a1', 'AND', 360, 75),
        nd('a2', 'AND', 360, 200),
        nd('o1', 'OR', 520, 155),
        nd('outY', 'LED_1', 670, 165, { label: 'خروجی Y', locked: true, portName: 'Y', portRole: 'output' }),
      ],
      wires: [
        w('inS', 'OUT', 'nS', 'A'),
        w('inA', 'OUT', 'a1', 'A'),
        w('nS', 'Y', 'a1', 'B'),
        w('inB', 'OUT', 'a2', 'A'),
        w('inS', 'OUT', 'a2', 'B'),
        w('a1', 'Y', 'o1', 'A'),
        w('a2', 'Y', 'o1', 'B'),
        w('o1', 'Y', 'outY', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: 'SEL=0, A=0, B=1 → 0', inputs: { A: 0, B: 1, SEL: 0 }, expected: { Y: 0 } },
      { label: 'SEL=0, A=1, B=0 → 1', inputs: { A: 1, B: 0, SEL: 0 }, expected: { Y: 1 } },
      { label: 'SEL=1, A=1, B=0 → 0', inputs: { A: 1, B: 0, SEL: 1 }, expected: { Y: 0 } },
      { label: 'SEL=1, A=0, B=1 → 1', inputs: { A: 0, B: 1, SEL: 1 }, expected: { Y: 1 } },
    ],
    unlocks: ['MUX_1', 'MUX_8', 'NOT_8', 'AND_8', 'OR_8', 'NOR_8'],
  },

  {
    id: 8,
    chapter: 3,
    chapterTitle: 'فصل ۳: مسیریابی برق و مغز محاسباتی',
    title: 'ساخت مغز حساب‌گر (8-bit ALU)',
    shortGoal: 'جمع، تفریق (مکمل دو)، AND، OR، سه سوزن‌بان MUX و تشخیص‌گر صفر (NOR-8) را ترکیب کن تا ALU ۸ بیتی بسازی!',
    palette: ['ADDER_8', 'NOT_8', 'AND_8', 'OR_8', 'MUX_8', 'NOR_8', 'CONST_0', 'CONST_1'],
    lesson: {
      storyTitle: 'مغز واقعی محاسبات پردازنده!',
      storyText:
        'واحد حساب و منطق (ALU) مثل یک ماشین‌حساب فوق‌سریع با ۴ دکمه است: جمع (00)، تفریق (01)، AND بیتی (10) و OR بیتی (11). نکته شگفت‌انگیز این است که کامپیوتر برای تفریق A - B مدار جدیدی نمی‌سازد، بلکه همه بیت‌های B را برعکس کرده (NOT-8) و با عدد 1 جمع می‌زند: A + (~B) + 1!',
      howTitle: 'درخت سوزن‌بان‌ها و پرچم صفر (Zero Flag)',
      howText:
        'هر ۴ عملیات هم‌زمان حساب می‌شوند و ۳ بلوک MUX-8 با کلیدهای OP0 و OP1 یکی را انتخاب می‌کنند. سپس خروجی نهایی وارد «تشخیص‌گر صفر (NOR-8)» می‌شود تا اگر حاصل ۰ شد (مثلاً ۵ - ۵ = ۰)، چراغ ZERO روشن شود — همین چراغ بعداً شرط «اگر صفر بود بپر» را ممکن می‌کند!',
      howDiagram: 'OP1=0, OP0=0 → A + B (ADD)\nOP1=0, OP0=1 → A + (~B) + 1 (SUB)\nOP1=1, OP0=0 → A & B (AND)\nOP1=1, OP0=1 → A | B (OR)\nاگر RES == 0 ──▶ ZERO = 1',
      missionTitle: 'ماموریت تو: ساخت ALU کامل با پرچم صفر',
      missionText:
        'چهار شاخه (ADD، SUB، AND، OR) را بساز، با سه MUX-8 به خروجی RES برسان و RES را به NOR-8 بده تا ZERO روشن شود!',
      unlocksText: 'باز شدن قلب محاسباتی پردازنده: «مغز محاسباتی (ALU-8)»',
    },
    hint: 'دو ADDER_8 بگذار (اولی با CIN=0 برای جمع، دومی با B معکوس‌شده توسط NOT_8 و CIN=1 برای تفریق). سپس MUX1(ADD, SUB, OP0) و MUX2(AND, OR, OP0) و MUX3(MUX1, MUX2, OP1) را ببند و خروجی MUX3 را به RES و NOR_8 وصل کن.',
    coachSteps: [
      { id: '8_1', text: 'گام ۱: دو ADDER_8 (برای جمع و تفریق با NOT_8 و CONST_1) و بلوک‌های AND_8 و OR_8 را قرار بده.', check: (c) => hasNodeType(c, 'ADDER_8', 2) && hasNodeType(c, 'NOT_8') && hasNodeType(c, 'AND_8') && hasNodeType(c, 'OR_8') },
      { id: '8_2', text: 'گام ۲: سه بلوک MUX_8 قرار بده و خروجی نهایی را به نمایشگر RES وصل کن.', check: (c) => hasNodeType(c, 'MUX_8', 3) && hasWireTo(c, 'outRes', 'IN') },
      { id: '8_3', text: 'گام ۳: یک تشخیص‌گر صفر (NOR_8) به خروجی RES وصل کن و خروجی آن را به لامپ ZERO بده.', check: (c) => hasNodeType(c, 'NOR_8') && hasWireTo(c, 'outZ', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('inA', 'INPUT_8', 20, 60, { label: 'عملوند A', value: 12, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'INPUT_8', 20, 195, { label: 'عملوند B', value: 5, locked: true, portName: 'B', portRole: 'input' }),
        nd('inOp0', 'SWITCH_1', 35, 340, { label: 'OP0 (بیت ۱)', value: 0, locked: true, portName: 'OP0', portRole: 'input' }),
        nd('inOp1', 'SWITCH_1', 35, 425, { label: 'OP1 (بیت ۲)', value: 0, locked: true, portName: 'OP1', portRole: 'input' }),
        nd('outRes', 'DISPLAY_8', 940, 200, { label: 'نتیجه (RES)', locked: true, portName: 'RES', portRole: 'output' }),
        nd('outZ', 'LED_1', 960, 365, { label: 'پرچم صفر (Z)', locked: true, portName: 'ZERO', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inA', 'INPUT_8', 20, 60, { label: 'عملوند A', value: 12, locked: true, portName: 'A', portRole: 'input' }),
        nd('inB', 'INPUT_8', 20, 195, { label: 'عملوند B', value: 5, locked: true, portName: 'B', portRole: 'input' }),
        nd('inOp0', 'SWITCH_1', 35, 340, { label: 'OP0 (بیت ۱)', value: 0, locked: true, portName: 'OP0', portRole: 'input' }),
        nd('inOp1', 'SWITCH_1', 35, 425, { label: 'OP1 (بیت ۲)', value: 0, locked: true, portName: 'OP1', portRole: 'input' }),
        nd('c0', 'CONST_0', 210, 15),
        nd('c1', 'CONST_1', 210, 175),
        nd('notB', 'NOT_8', 205, 245),
        nd('add', 'ADDER_8', 365, 25, { label: 'جمع (ADD)' }),
        nd('sub', 'ADDER_8', 365, 150, { label: 'تفریق (SUB)' }),
        nd('and8', 'AND_8', 365, 285, { label: 'AND بیتی' }),
        nd('or8', 'OR_8', 365, 380, { label: 'OR بیتی' }),
        nd('muxAr', 'MUX_8', 565, 90, { label: 'جمع یا تفریق' }),
        nd('muxLg', 'MUX_8', 565, 315, { label: 'AND یا OR' }),
        nd('muxFin', 'MUX_8', 745, 195, { label: 'انتخاب نهایی' }),
        nd('zDet', 'NOR_8', 745, 355, { label: 'تشخیص صفر' }),
        nd('outRes', 'DISPLAY_8', 940, 200, { label: 'نتیجه (RES)', locked: true, portName: 'RES', portRole: 'output' }),
        nd('outZ', 'LED_1', 960, 365, { label: 'پرچم صفر (Z)', locked: true, portName: 'ZERO', portRole: 'output' }),
      ],
      wires: [
        w('inA', 'OUT', 'add', 'A'),
        w('inB', 'OUT', 'add', 'B'),
        w('c0', 'OUT', 'add', 'CIN'),
        w('inB', 'OUT', 'notB', 'A'),
        w('inA', 'OUT', 'sub', 'A'),
        w('notB', 'Y', 'sub', 'B'),
        w('c1', 'OUT', 'sub', 'CIN'),
        w('inA', 'OUT', 'and8', 'A'),
        w('inB', 'OUT', 'and8', 'B'),
        w('inA', 'OUT', 'or8', 'A'),
        w('inB', 'OUT', 'or8', 'B'),
        w('add', 'SUM', 'muxAr', 'A'),
        w('sub', 'SUM', 'muxAr', 'B'),
        w('inOp0', 'OUT', 'muxAr', 'SEL'),
        w('and8', 'Y', 'muxLg', 'A'),
        w('or8', 'Y', 'muxLg', 'B'),
        w('inOp0', 'OUT', 'muxLg', 'SEL'),
        w('muxAr', 'Y', 'muxFin', 'A'),
        w('muxLg', 'Y', 'muxFin', 'B'),
        w('inOp1', 'OUT', 'muxFin', 'SEL'),
        w('muxFin', 'Y', 'outRes', 'IN'),
        w('muxFin', 'Y', 'zDet', 'A'),
        w('zDet', 'ZERO', 'outZ', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: 'ADD: 7 + 5 = 12', inputs: { A: 7, B: 5, OP0: 0, OP1: 0 }, expected: { RES: 12, ZERO: 0 } },
      { label: 'SUB: 10 - 4 = 6', inputs: { A: 10, B: 4, OP0: 1, OP1: 0 }, expected: { RES: 6, ZERO: 0 } },
      { label: 'SUB صفر: 5 - 5 = 0 (Z=1!)', inputs: { A: 5, B: 5, OP0: 1, OP1: 0 }, expected: { RES: 0, ZERO: 1 } },
      { label: 'AND: 12 & 10 = 8', inputs: { A: 12, B: 10, OP0: 0, OP1: 1 }, expected: { RES: 8, ZERO: 0 } },
      { label: 'AND صفر: 4 & 2 = 0 (Z=1!)', inputs: { A: 4, B: 2, OP0: 0, OP1: 1 }, expected: { RES: 0, ZERO: 1 } },
      { label: 'OR: 12 | 3 = 15', inputs: { A: 12, B: 3, OP0: 1, OP1: 1 }, expected: { RES: 15, ZERO: 0 } },
    ],
    unlocks: ['ALU_8', 'DFF', 'CLOCK'],
  },

  // ================= CHAPTER 4 =================
  {
    id: 9,
    chapter: 4,
    chapterTitle: 'فصل ۴: حافظه و تپش قلب پردازنده',
    title: 'تله برق (حافظه ۱ بیتی / D-Flip-Flop)',
    shortGoal: 'با ترکیب یک MUX و یک D-Flip-Flop در یک حلقه بازخورد، حافظه‌ای بساز که فقط وقتی WE=1 است ذخیره کند وگرنه برق را به دام بیندازد!',
    palette: ['DFF', 'MUX_1'],
    showClockBar: true,
    lesson: {
      storyTitle: 'چطور برق را روی کاغذ یادداشت به دام بیندازیم؟',
      storyText:
        'تا الان هر مداری ساختیم، به محض اینکه کلید را خاموش می‌کردیم خروجی هم می‌پرید! برای ساخت حافظه از «فلیپ‌فلاپ نوع D» استفاده می‌کنیم که مثل شاتر دوربین عکاسی است: فقط در لحظه تپش کلاک (0→1) از ورودی D عکس می‌گیرد و آن را نگه می‌دارد.',
      howTitle: 'جادوی حلقه بازخورد (Feedback Loop)!',
      howText:
        'اگر بخواهیم فقط وقتی اجازه نوشتن (WE=1) دادیم بیت جدید ثبت شود، یک MUX جلوی فلیپ‌فلاپ می‌گذاریم: وقتی WE=0 است، خروجی Q خودش دوباره به ورودی A برمی‌گردد و عدد فراموش نمی‌شود! وقتی WE=1 است، داده جدید (DATA) وارد D می‌شود.',
      howDiagram: '   ┌─────── بازخورد (Q قدیمی) ───────┐\n   ▼                                  │\n[ MUX (A=قدیمی, B=DATA, SEL=WE) ] ─▶ [ DFF ] ─▶ Q\n                                 CLK ─┘',
      missionTitle: 'ماموریت تو: ساخت سلول حافظه ۱ بیتی واقعی',
      missionText:
        'یک MUX-1 و یک DFF را با حلقه بازخورد (Q به MUX.A) سیم‌کشی کن. می‌توانی با دکمه «تک‌گام کلاک» در پایین صفحه ببینی حتی بعد از خاموش کردن DATA، بیت داخل حافظه زنده می‌ماند!',
      unlocksText: 'باز شدن «حافظه ۱ بیتی (BIT-MEM)» و «رجیستر ۸ بیتی (REG-8)»',
    },
    hint: 'خروجی DFF.Q را به MUX.A برگردان! DATA را به MUX.B و WE را به MUX.SEL بده. خروجی MUX.Y را به DFF.D، تپش کلاک را به DFF.CLK و DFF.Q را به لامپ Q وصل کن.',
    coachSteps: [
      { id: '9_1', text: 'گام ۱: یک MUX_1 و یک DFF روی تخته بگذار.', check: (c) => hasNodeType(c, 'MUX_1') && hasNodeType(c, 'DFF') },
      { id: '9_2', text: 'گام ۲: حلقه بازخورد بساز: خروجی DFF.Q را به ورودی MUX.A برگردان!', check: (c) => c.wires.some((wire) => { const f = c.nodes.find((n) => n.id === wire.fromNodeId); const t = c.nodes.find((n) => n.id === wire.toNodeId); return f?.type === 'DFF' && t?.type === 'MUX_1' && wire.toPinId === 'A'; }) },
      { id: '9_3', text: 'گام ۳: DATA، WE، کلاک و لامپ خروجی Q را متصل کن.', check: (c) => hasWireTo(c, 'outQ', 'IN') && hasWireTo(c, 'DFF', 'CLK') },
    ],
    initialCircuit: {
      nodes: [
        nd('inD', 'SWITCH_1', 40, 60, { label: 'داده (DATA)', value: 1, locked: true, portName: 'DATA', portRole: 'input' }),
        nd('inW', 'SWITCH_1', 40, 160, { label: 'اجازه نوشتن (WE)', value: 1, locked: true, portName: 'WE', portRole: 'input' }),
        nd('clk', 'CLOCK', 35, 265, { label: 'تپش کلاک', locked: true }),
        nd('outQ', 'LED_1', 640, 145, { label: 'خروجی حافظه Q', locked: true, portName: 'Q', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inD', 'SWITCH_1', 40, 60, { label: 'داده (DATA)', value: 1, locked: true, portName: 'DATA', portRole: 'input' }),
        nd('inW', 'SWITCH_1', 40, 160, { label: 'اجازه نوشتن (WE)', value: 1, locked: true, portName: 'WE', portRole: 'input' }),
        nd('clk', 'CLOCK', 35, 265, { label: 'تپش کلاک', locked: true }),
        nd('mux', 'MUX_1', 240, 95, { label: 'نگه‌دارنده یا جدید' }),
        nd('dff', 'DFF', 435, 135),
        nd('outQ', 'LED_1', 640, 145, { label: 'خروجی حافظه Q', locked: true, portName: 'Q', portRole: 'output' }),
      ],
      wires: [
        w('dff', 'Q', 'mux', 'A'),
        w('inD', 'OUT', 'mux', 'B'),
        w('inW', 'OUT', 'mux', 'SEL'),
        w('mux', 'Y', 'dff', 'D'),
        w('clk', 'CLK', 'dff', 'CLK'),
        w('dff', 'Q', 'outQ', 'IN'),
      ],
    },
    testKind: 'sequential',
    seqTests: [
      { label: 'گام ۱: نوشتن 1 (DATA=1, WE=1 + کلاک)', inputs: { DATA: 1, WE: 1 }, tickClock: true, expected: { Q: 1 } },
      { label: 'گام ۲: حفظ 1 با وجود خاموشی (DATA=0, WE=0 + کلاک)', inputs: { DATA: 0, WE: 0 }, tickClock: true, expected: { Q: 1 } },
      { label: 'گام ۳: نوشتن 0 (DATA=0, WE=1 + کلاک)', inputs: { DATA: 0, WE: 1 }, tickClock: true, expected: { Q: 0 } },
      { label: 'گام ۴: قفل روی 0 (DATA=1, WE=0 + کلاک)', inputs: { DATA: 1, WE: 0 }, tickClock: true, expected: { Q: 0 } },
    ],
    unlocks: ['DFF_EN', 'REG_8', 'CONST_8'],
  },

  {
    id: 10,
    chapter: 4,
    chapterTitle: 'فصل ۴: حافظه و تپش قلب پردازنده',
    title: 'رجیستر ۸ بیتی و شمارنده برنامه (Register & PC)',
    shortGoal: 'با رجیستر ۸ بیتی، جمع‌کننده +۱ و سوزن‌بان MUX، شمارنده برنامه (PC) بساز که 0→1→2→3 بشمارد و قابلیت پرش (JMP) داشته باشد!',
    palette: ['REG_8', 'ADDER_8', 'MUX_8', 'CONST_8', 'CONST_0', 'CONST_1'],
    showClockBar: true,
    lesson: {
      storyTitle: 'چطور پردازنده می‌فهمد الان خط چندم برنامه است؟',
      storyText:
        'وقتی کتاب می‌خوانی انگشتت خط‌به‌خط پایین می‌رود (۰، ۱، ۲، ۳...) و اگر کتاب گفت «برو صفحه ۱۰»، انگشتت مستقیم می‌پرد صفحه ۱۰! در پردازنده به این انگشت راهنما «شمارنده برنامه» یا PC می‌گویند.',
      howTitle: 'حلقه جادویی PC + 1 و پرش',
      howText:
        'رجیستر ۸ بیتی (که از ۸ حافظه مرحله قبل ساخته شده) شماره خط فعلی را نگه می‌دارد. خروجی آن به یک جمع‌کننده (+۱) می‌رود. سپس یک MUX-8 تصمیم می‌گیرد در تپش بعدی کلاک، خط بعدی (PC+1) ثبت شود یا آدرس پرش (JMP_ADDR)!',
      howDiagram: '   ┌────────── +1 (ADDER_8) ──────────┐\n   ▼                                   │\n[ MUX_8 (A=PC+1, B=JMP, SEL=LOAD) ] ─▶ [ REG_8 (EN=1) ] ─▶ ADDR',
      missionTitle: 'ماموریت تو: ساخت شمارنده برنامه با پرش',
      missionText:
        'رجیستر ۸ بیتی (با EN=1)، ADDER_8 (با عدد ثابت ۱ و CIN=0) و MUX_8 را در حلقه به هم وصل کن و با دکمه «تک‌گام کلاک» تماشا کن چطور می‌شمارد و می‌پرد!',
      unlocksText: 'باز شدن آی‌سی «شمارنده برنامه (PC-8)»',
    },
    hint: 'REG_8.Q را به نمایشگر PC و به ADDER_8.A بده. یک CONST_8 (با مقدار ۱) به ADDER_8.B و CONST_0 به CIN بده. ADDER_8.SUM برود به MUX_8.A، ورودی JMP برود به MUX_8.B و LOAD برود به MUX_8.SEL. خروجی MUX به REG_8.D و CONST_1 به REG_8.EN!',
    coachSteps: [
      { id: '10_1', text: 'گام ۱: یک REG_8، یک ADDER_8 و یک MUX_8 روی تخته قرار بده.', check: (c) => hasNodeType(c, 'REG_8') && hasNodeType(c, 'ADDER_8') && hasNodeType(c, 'MUX_8') },
      { id: '10_2', text: 'گام ۲: حلقه +۱ بساز (REG_8.Q → ADDER_8.A با عدد ثابت ۱) و به MUX.A وصل کن.', check: (c) => hasNodeType(c, 'CONST_8') && hasWireTo(c, 'ADDER_8', 'A') },
      { id: '10_3', text: 'گام ۳: CONST_1 را به REG_8.EN، کلاک را به REG_8.CLK و خروجی REG_8.Q را به نمایشگر ADDR وصل کن.', check: (c) => hasWireTo(c, 'outPc', 'IN') && hasWireTo(c, 'REG_8', 'CLK') },
    ],
    initialCircuit: {
      nodes: [
        nd('inJmp', 'INPUT_8', 25, 65, { label: 'آدرس پرش (JMP)', value: 10, locked: true, portName: 'JMP', portRole: 'input' }),
        nd('inLd', 'SWITCH_1', 45, 190, { label: 'فرمان پرش (LOAD)', value: 0, locked: true, portName: 'LOAD', portRole: 'input' }),
        nd('clk', 'CLOCK', 35, 290, { label: 'تپش کلاک', locked: true }),
        nd('outPc', 'DISPLAY_8', 810, 175, { label: 'آدرس فعلی (ADDR)', locked: true, portName: 'ADDR', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('inJmp', 'INPUT_8', 25, 65, { label: 'آدرس پرش (JMP)', value: 10, locked: true, portName: 'JMP', portRole: 'input' }),
        nd('inLd', 'SWITCH_1', 45, 190, { label: 'فرمان پرش (LOAD)', value: 0, locked: true, portName: 'LOAD', portRole: 'input' }),
        nd('clk', 'CLOCK', 35, 290, { label: 'تپش کلاک', locked: true }),
        nd('c1', 'CONST_8', 35, 390, { value: 1, label: 'ثابت ۱' }),
        nd('c0', 'CONST_0', 45, 480),
        nd('cEn', 'CONST_1', 445, 310),
        nd('add1', 'ADDER_8', 235, 365, { label: 'افزایش +۱' }),
        nd('mux', 'MUX_8', 425, 115, { label: 'عادی یا پرش' }),
        nd('reg', 'REG_8', 610, 175, { label: 'رجیستر PC' }),
        nd('outPc', 'DISPLAY_8', 810, 175, { label: 'آدرس فعلی (ADDR)', locked: true, portName: 'ADDR', portRole: 'output' }),
      ],
      wires: [
        w('reg', 'Q', 'add1', 'A'),
        w('c1', 'OUT', 'add1', 'B'),
        w('c0', 'OUT', 'add1', 'CIN'),
        w('add1', 'SUM', 'mux', 'A'),
        w('inJmp', 'OUT', 'mux', 'B'),
        w('inLd', 'OUT', 'mux', 'SEL'),
        w('mux', 'Y', 'reg', 'D'),
        w('cEn', 'OUT', 'reg', 'EN'),
        w('clk', 'CLK', 'reg', 'CLK'),
        w('reg', 'Q', 'outPc', 'IN'),
      ],
    },
    testKind: 'sequential',
    seqTests: [
      { label: 'کلاک ۱: شمارش 0 → 1', inputs: { JMP: 10, LOAD: 0 }, tickClock: true, expected: { ADDR: 1 } },
      { label: 'کلاک ۲: شمارش 1 → 2', inputs: { JMP: 10, LOAD: 0 }, tickClock: true, expected: { ADDR: 2 } },
      { label: 'کلاک ۳: شمارش 2 → 3', inputs: { JMP: 10, LOAD: 0 }, tickClock: true, expected: { ADDR: 3 } },
      { label: 'کلاک ۴: پرش به خط 10 (LOAD=1)!', inputs: { JMP: 10, LOAD: 1 }, tickClock: true, expected: { ADDR: 10 } },
      { label: 'کلاک ۵: ادامه شمارش 10 → 11', inputs: { JMP: 10, LOAD: 0 }, tickClock: true, expected: { ADDR: 11 } },
    ],
    unlocks: ['PC_8', 'SPLITTER_4', 'MERGER_4', 'INPUT_4'],
  },

  // ================= CHAPTER 5 =================
  {
    id: 11,
    chapter: 5,
    chapterTitle: 'فصل ۵: اختراع دستورات پردازنده!',
    title: 'رمزگشا (Decoder) — ریموت کنترل پردازنده',
    shortGoal: 'یک رمزگشای ۲ به ۴ بساز که با گرفتن کد ۲ بیتی (S1, S0)، دقیقاً یکی از ۴ سیم خروجی (Y0 تا Y3) را روشن کند.',
    palette: ['NOT', 'AND'],
    lesson: {
      storyTitle: 'ریموت کنترل تلویزیون چطور دکمه‌ها را می‌فهمد؟',
      storyText:
        'وقتی یک عدد باینری مثل 10 (عدد ۲) از حافظه برنامه می‌آید، پردازنده چطور می‌فهمد باید دقیقاً سیم فرمان شماره ۲ را روشن کند؟ جواب: رمزگشا (Decoder)! رمزگشا یک کد باینری فشرده می‌گیرد و دقیقاً «یک» سیم خروجی متناظر را روشن (1-Hot) می‌کند.',
      howTitle: '۴ حالت کد ۲ بیتی با گیت AND و NOT',
      howText: 'هر خروجی یک گیت AND دارد که فقط برای همان کد خاص هر دو ورودی‌اش ۱ می‌شود:',
      howDiagram: 'S1=0, S0=0 (00) ──▶ Y0 = NOT S1 AND NOT S0\nS1=0, S0=1 (01) ──▶ Y1 = NOT S1 AND S0\nS1=1, S0=0 (10) ──▶ Y2 = S1 AND NOT S0\nS1=1, S0=1 (11) ──▶ Y3 = S1 AND S0',
      missionTitle: 'ماموریت تو: ساخت رمزگشای ۲ به ۴',
      missionText:
        'با دو NOT و چهار AND این رمزگشا را بساز تا آی‌سی «رمزگشای دستورات ۴ به ۱۲ (OP-DEC)» برای مرحله اختراع دستورات پردازنده باز شود!',
      unlocksText: 'باز شدن آی‌سی‌های «رمزگشای ۲ به ۴» و «رمزگشای دستورات ۴ به ۱۲ (OP-DEC)»',
    },
    hint: 'دو NOT برای S0 و S1 بگذار. سپس ۴ گیت AND بچین: Y0=(¬S1 & ¬S0)، Y1=(¬S1 & S0)، Y2=(S1 & ¬S0)، Y3=(S1 & S0).',
    coachSteps: [
      { id: '11_1', text: 'گام ۱: دو گیت NOT برای ساخت معکوس S0 و S1 قرار بده.', check: (c) => hasNodeType(c, 'NOT', 2) },
      { id: '11_2', text: 'گام ۲: چهار گیت AND برای ۴ کد 00، 01، 10 و 11 روی تخته بگذار.', check: (c) => hasNodeType(c, 'AND', 4) },
      { id: '11_3', text: 'گام ۳: خروجی هر ۴ گیت AND را به لامپ‌های Y0 تا Y3 وصل کن.', check: (c) => hasWireTo(c, 'y0', 'IN') && hasWireTo(c, 'y1', 'IN') && hasWireTo(c, 'y2', 'IN') && hasWireTo(c, 'y3', 'IN') },
    ],
    initialCircuit: {
      nodes: [
        nd('s0', 'SWITCH_1', 40, 80, { label: 'بیت S0 (یکان)', value: 0, locked: true, portName: 'S0', portRole: 'input' }),
        nd('s1', 'SWITCH_1', 40, 260, { label: 'بیت S1 (دوتایی)', value: 1, locked: true, portName: 'S1', portRole: 'input' }),
        nd('y0', 'LED_1', 590, 35, { label: 'خروجی Y0 (00)', locked: true, portName: 'Y0', portRole: 'output' }),
        nd('y1', 'LED_1', 590, 125, { label: 'خروجی Y1 (01)', locked: true, portName: 'Y1', portRole: 'output' }),
        nd('y2', 'LED_1', 590, 215, { label: 'خروجی Y2 (10)', locked: true, portName: 'Y2', portRole: 'output' }),
        nd('y3', 'LED_1', 590, 305, { label: 'خروجی Y3 (11)', locked: true, portName: 'Y3', portRole: 'output' }),
      ],
      wires: [],
    },
    autoBuildCircuit: {
      nodes: [
        nd('s0', 'SWITCH_1', 40, 80, { label: 'بیت S0 (یکان)', value: 0, locked: true, portName: 'S0', portRole: 'input' }),
        nd('s1', 'SWITCH_1', 40, 260, { label: 'بیت S1 (دوتایی)', value: 1, locked: true, portName: 'S1', portRole: 'input' }),
        nd('n0', 'NOT', 210, 60),
        nd('n1', 'NOT', 210, 240),
        nd('a0', 'AND', 395, 30, { label: 'کد 00' }),
        nd('a1', 'AND', 395, 120, { label: 'کد 01' }),
        nd('a2', 'AND', 395, 210, { label: 'کد 10' }),
        nd('a3', 'AND', 395, 300, { label: 'کد 11' }),
        nd('y0', 'LED_1', 590, 35, { label: 'خروجی Y0 (00)', locked: true, portName: 'Y0', portRole: 'output' }),
        nd('y1', 'LED_1', 590, 125, { label: 'خروجی Y1 (01)', locked: true, portName: 'Y1', portRole: 'output' }),
        nd('y2', 'LED_1', 590, 215, { label: 'خروجی Y2 (10)', locked: true, portName: 'Y2', portRole: 'output' }),
        nd('y3', 'LED_1', 590, 305, { label: 'خروجی Y3 (11)', locked: true, portName: 'Y3', portRole: 'output' }),
      ],
      wires: [
        w('s0', 'OUT', 'n0', 'A'),
        w('s1', 'OUT', 'n1', 'A'),
        w('n1', 'Y', 'a0', 'A'),
        w('n0', 'Y', 'a0', 'B'),
        w('n1', 'Y', 'a1', 'A'),
        w('s0', 'OUT', 'a1', 'B'),
        w('s1', 'OUT', 'a2', 'A'),
        w('n0', 'Y', 'a2', 'B'),
        w('s1', 'OUT', 'a3', 'A'),
        w('s0', 'OUT', 'a3', 'B'),
        w('a0', 'Y', 'y0', 'IN'),
        w('a1', 'Y', 'y1', 'IN'),
        w('a2', 'Y', 'y2', 'IN'),
        w('a3', 'Y', 'y3', 'IN'),
      ],
    },
    testKind: 'combinational',
    combTests: [
      { label: 'کد 00 (0)', inputs: { S1: 0, S0: 0 }, expected: { Y0: 1, Y1: 0, Y2: 0, Y3: 0 } },
      { label: 'کد 01 (1)', inputs: { S1: 0, S0: 1 }, expected: { Y0: 0, Y1: 1, Y2: 0, Y3: 0 } },
      { label: 'کد 10 (2)', inputs: { S1: 1, S0: 0 }, expected: { Y0: 0, Y1: 0, Y2: 1, Y3: 0 } },
      { label: 'کد 11 (3)', inputs: { S1: 1, S0: 1 }, expected: { Y0: 0, Y1: 0, Y2: 0, Y3: 1 } },
    ],
    unlocks: ['DECODER_2_4', 'DECODER_4_16', 'OR_4'],
  },

  {
    id: 12,
    chapter: 5,
    chapterTitle: 'فصل ۵: اختراع دستورات پردازنده!',
    title: 'اختراع دستورات خودت (ساخت واحد کنترل)',
    shortGoal: 'سیم‌های رمزگشای ۴ به ۱۲ را به پایه‌های کنترلی CPU وصل کن و با یک گیت AND بین OP9 و Z_FLAG پرش شرطی JZ را اختراع کن!',
    palette: ['DECODER_4_16', 'OR_4', 'OR', 'AND', 'NOT'],
    showIsaTab: true,
    lesson: {
      storyTitle: 'لحظه تولد زبان ماشین پردازنده خودت!',
      storyText:
        'اینجا هیجان‌انگیزترین بخش ساخت پردازنده است! هیچ جادوی پنهانی در کار نیست: دقیقاً سیم‌هایی که الان خودت وصل می‌کنی تعیین می‌کنند هر دستور اسمبلی چه کاری روی سخت‌افزار انجام بدهد! حتی می‌توانی در تب «میز طراحی دستورات» اسم دلخواه خودت را روی هر دستور بگذاری (مثلاً JAM به جای ADD).',
      howTitle: 'نقشه سیم‌کشی واحد کنترل و اختراع پرش شرطی (JZ)',
      howText:
        'رمزگشا آپ‌کد OP[3:0] را به سیم‌های OP1 تا OP11 تبدیل می‌کند. دستورات مستقیم (مثل OP1→LD_A) مستقیم وصل می‌شوند. برای ۴ دستور ALU (کدهای ۳ تا ۶) از OR-4 برای ALU_WR استفاده کن. و شاهکار ماجرا: برای پرش شرطی JZ (کد ۹)، با یک گیت AND بررسی کن آیا «دستور JZ است AND پرچم صفر Z_FLAG روشن است» و آن را با OP8 (پرش بی‌شرط JMP) به PC_LD وصل کن!',
      howDiagram: 'OP1→LD_A | OP2→LD_B | OP7→OUT_EN | OP10→HALT | OP11→SWAP\nALU_WR = OR_4(OP3, OP4, OP5, OP6)\nALU_OP0 = OR(OP4[SUB], OP6[OR])\nALU_OP1 = OR(OP5[AND], OP6[OR])\nPC_LD = OR(OP8[JMP], AND(OP9[JZ], Z_FLAG))',
      missionTitle: 'ماموریت تو: ساخت مدار زنده واحد کنترل',
      missionText:
        'دقیقاً همین مداری که اینجا می‌سازی در مراحل ۱۳ و ۱۴ به صورت واقعی داخل پردازنده‌ات اجرا می‌شود! اگر سیمی را اشتباه ببندی، آن دستور در اسمبلی واقعاً کار نخواهد کرد!',
      unlocksText: 'باز شدن آی‌سی «واحد کنترل (ساخته خودت!)» و «میز طراحی دستورات»',
    },
    hint: 'رمزگشای OP-DEC را وسط بگذار و OP[3:0] را به آن وصل کن. سپس OP1→LD_A، OP2→LD_B، OR_4(OP3..6)→ALU_WR، OR(OP4,OP6)→ALU_OP0، OR(OP5,OP6)→ALU_OP1، OP7→OUT_EN، OR(OP8, AND(OP9, Z_FLAG))→PC_LD، OP10→HALT و OP11→SWAP.',
    coachSteps: [
      { id: '12_1', text: 'گام ۱: بلوک «رمزگشای دستورات ۴ به ۱۲ (OP-DEC)» را بگذار و OP[3:0] را به آن وصل کن.', check: (c) => hasNodeType(c, 'DECODER_4_16') && hasWireTo(c, 'DECODER_4_16', 'IN') },
      { id: '12_2', text: 'گام ۲: سیم‌های مستقیم OP1→LD_A، OP2→LD_B، OP7→OUT_EN، OP10→HALT و OP11→SWAP را وصل کن.', check: (c) => hasWireTo(c, 'out_lda', 'IN') && hasWireTo(c, 'out_ldb', 'IN') && hasWireTo(c, 'out_out', 'IN') && hasWireTo(c, 'out_hlt', 'IN') && hasWireTo(c, 'out_swp', 'IN') },
      { id: '12_3', text: 'گام ۳: با OR_4 و دو OR سیم‌های ALU_WR، ALU_OP0 و ALU_OP1 را سیم‌کشی کن.', check: (c) => hasWireTo(c, 'out_aluwr', 'IN') && hasWireTo(c, 'out_op0', 'IN') && hasWireTo(c, 'out_op1', 'IN') },
      { id: '12_4', text: 'گام ۴: پرش شرطی JZ را اختراع کن: AND(OP9, Z_FLAG) را با OP8 از طریق OR به PC_LD وصل کن!', check: (c) => hasNodeType(c, 'AND') && hasWireTo(c, 'out_pcld', 'IN') },
    ],
    initialCircuit: buildLevel12Initial(),
    autoBuildCircuit: buildLevel12Auto(),
    testKind: 'combinational',
    combTests: [
      { label: '0000 NOP', inputs: { OP: 0, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0001 LDI_A', inputs: { OP: 1, Z_FLAG: 0 }, expected: { LD_A: 1, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0010 LDI_B', inputs: { OP: 2, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 1, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0011 ADD (00)', inputs: { OP: 3, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 1, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0100 SUB (01)', inputs: { OP: 4, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 1, ALU_OP0: 1, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0101 AND (10)', inputs: { OP: 5, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 1, ALU_OP0: 0, ALU_OP1: 1, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0110 OR (11)', inputs: { OP: 6, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 1, ALU_OP0: 1, ALU_OP1: 1, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '0111 OUT', inputs: { OP: 7, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 1, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '1000 JMP (Z=0)', inputs: { OP: 8, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 1, HALT: 0, SWAP: 0 } },
      { label: '1001 JZ با Z=0 (نپرد!)', inputs: { OP: 9, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 0 } },
      { label: '1001 JZ با Z=1 (بپرد!)', inputs: { OP: 9, Z_FLAG: 1 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 1, HALT: 0, SWAP: 0 } },
      { label: '1010 HLT', inputs: { OP: 10, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 1, SWAP: 0 } },
      { label: '1011 SWAP', inputs: { OP: 11, Z_FLAG: 0 }, expected: { LD_A: 0, LD_B: 0, ALU_WR: 0, ALU_OP0: 0, ALU_OP1: 0, OUT_EN: 0, PC_LD: 0, HALT: 0, SWAP: 1 } },
    ],
    unlocks: ['CONTROL_UNIT', 'ROM_16', 'OUT_DISPLAY'],
  },

  // ================= CHAPTER 6 =================
  {
    id: 13,
    chapter: 6,
    chapterTitle: 'فصل ۶: مونتاژ نهایی و برنامه‌نویسی اسمبلی',
    title: 'مونتاژ کامل پردازنده لگو-۸ (Full CPU)',
    shortGoal: 'همه قطعات پردازنده روی مادربورد را به هم سیم‌کشی کن و تست عیب‌یابی سخت‌افزاری واقعی (Fetch-Decode-Execute) را بگذران!',
    palette: ['CLOCK', 'PC_8', 'ROM_16', 'CONTROL_UNIT', 'REG_8', 'ALU_8', 'MUX_8', 'DFF_EN', 'OR_4', 'OUT_DISPLAY'],
    showIsaTab: true,
    showAssemblyTab: true,
    showClockBar: true,
    lesson: {
      storyTitle: 'همه آجرهایی که ساختی حالا یک کامپیوتر زنده می‌شوند!',
      storyText:
        'به مادربورد نگاه کن! تک‌تک این بلوک‌ها (ALU، رجیسترها، شمارنده برنامه، فلگ صفر، و واحد کنترل) حاصل دست‌رنج خودت در ۱۲ مرحله قبل هستند. الان فقط کافی است گذرگاه‌های داده و سیم‌های کنترلی را روی مادربورد به هم وصل کنی.',
      howTitle: 'چرخه کامل برق در پردازنده لگو-۸',
      howText:
        '۱) واکشی: PC آدرس را به ROM می‌دهد. ۲) رمزگشایی: ROM آپ‌کد را به واحد کنترل تو می‌دهد. ۳) اجرا: واحد کنترل مسیرهای MUX، رجیسترهای A/B/C، ALU، فلگ Z و نمایشگر OUT را هدایت می‌کند.',
      howDiagram: 'CLK ─▶ [PC] ─▶ [ROM] ─(OP)─▶ [واحد کنترل تو] ─▶ HALT / PC_LD / ALU / REG\n                 └─(ARG)─▶ MUX ─▶ [REG A/B/C] ─▶ [ALU] ─▶ [FLAG Z] ──┘',
      missionTitle: 'ماموریت تو: سیم‌کشی مادربورد و تست عیب‌یابی',
      missionText:
        'گذرگاه‌ها را طبق راهنمای مربی وصل کن (یا برای دیدن معماری تمیز از «چیدمان خودکار» استفاده کن) و «تست مدار» را بزن تا برنامه عیب‌یابی سخت‌افزاری (جمع، تفریق، پرش شرطی JZ و خروجی 42) واقعاً روی سیم‌هایت اجرا شود!',
      unlocksText: 'باز شدن آزمایشگاه کامل برنامه‌نویسی اسمبلی (مرحله ۱۴) و تمام قطعات در حالت آزاد!',
    },
    hint: 'اگر تعداد سیم‌های مادربورد زیاد است، ابتدا بخش‌های Fetch (PC→ROM→CTRL) را وصل کن یا از دکمه «چیدمان خودکار» کمک بگیر و سپس روی هر بلوک (به‌خصوص واحد کنترل) آیکون 🔍 را بزن تا جریان زنده برق را ببینی!',
    coachSteps: [
      { id: '13_1', text: 'گام ۱: مسیر واکشی (Fetch): سیم PC.ADDR → ROM.ADDR و ROM.OP → CTRL.OP را وصل کن.', check: (c) => connectedPair(c, 'pc', 'rom') && connectedPair(c, 'rom', 'ctrl') },
      { id: '13_2', text: 'گام ۲: تپش کلاک و توقف: CTRL.HALT → CLK.HALT و CLK.CLK را به PC، رجیسترها، FLAG Z و نمایشگر وصل کن.', check: (c) => connectedPair(c, 'ctrl', 'clk') && connectedPair(c, 'clk', 'pc') && connectedPair(c, 'clk', 'regA') },
      { id: '13_3', text: 'گام ۳: مسیر داده و ALU: خروجی‌های REG A و REG B را به ALU و نتیجه ALU را به MUX_A1 و FLAG Z وصل کن.', check: (c) => connectedPair(c, 'regA', 'alu') && connectedPair(c, 'regB', 'alu') && connectedPair(c, 'alu', 'flagZ') },
      { id: '13_4', text: 'گام ۴: بازخورد پرش و خروجی: FLAG_Z.Q → CTRL.Z_FLAG، CTRL.PC_LD → PC.LOAD و REG_A.Q → OUT_DISPLAY.D را وصل کن.', check: (c) => connectedPair(c, 'flagZ', 'ctrl') && connectedPair(c, 'ctrl', 'pc') && connectedPair(c, 'regA', 'outDisp') },
    ],
    initialCircuit: {
      nodes: buildCpuMotherboardNodes(),
      wires: [],
    },
    autoBuildCircuit: buildCpuMotherboardAutoBuild(),
    testKind: 'cpu_diagnostic',
    unlocks: [],
  },

  {
    id: 14,
    chapter: 6,
    chapterTitle: 'فصل ۶: مونتاژ نهایی و برنامه‌نویسی اسمبلی',
    title: 'آزمایشگاه اسمبلی (برنامه‌نویسی روی پردازنده خودت!)',
    shortGoal: 'برنامه‌های واقعی اسمبلی (جمع، شمارش معکوس با حلقه و ضرب با جمع متوالی) را کامپایل کن و اجرا شدن آن‌ها را بیت‌به‌بیت روی مدار خودت تماشا کن!',
    palette: ['CLOCK', 'PC_8', 'ROM_16', 'CONTROL_UNIT', 'REG_8', 'ALU_8', 'MUX_8', 'DFF_EN', 'OR_4', 'OUT_DISPLAY', 'AND', 'OR', 'NOT'],
    showIsaTab: true,
    showAssemblyTab: true,
    showClockBar: true,
    lesson: {
      storyTitle: 'تبریک! حالا تو یک مهندس کامل معماری کامپیوتر هستی!',
      storyText:
        'به تخته‌مدار مقابلت نگاه کن: از یک کلید ساده شروع کردی و الان یک پردازنده ۸ بیتی واقعی ساخته‌ای که کد اسمبلی می‌فهمد! وقتی روی «کامپایل و بارگذاری در ROM» می‌زنی، اسمبلر فقط متن تو را به ۰ و ۱ تبدیل کرده و در ROM می‌ریزد؛ بقیه‌اش ۱۰۰٪ کار برق واقعی روی سیم‌های توست.',
      howTitle: 'آزمایش‌های هیجان‌انگیزی که می‌توانی انجام بدهی:',
      howText:
        '۱) هر ۳ برنامه آماده را با حالت «تک‌گام کلاک» اجرا کن و گزارش «راوی زنده پردازنده» را بخوان. ۲) در تب «میز طراحی دستورات» اسم دستور ADD را به JAM تغییر بده و ببین اسمبلر با زبان اختراعی تو کامپایل می‌شود! ۳) روی واحد کنترل آیکون 🔍 را بزن، سیم JZ را قطع کن و ببین حلقه شمارش معکوس واقعاً خراب می‌شود!',
      howDiagram: 'کد اسمبلی ─▶ [اسمبلر] ─▶ ۰ و ۱ در ROM ─▶ PC ─▶ واحد کنترل تو ─▶ ALU ─▶ خروجی!',
      missionTitle: 'ماموریت نهایی: اجرای موفق هر ۳ برنامه روی سخت‌افزار',
      missionText:
        'در پنل سمت چپ (تب ویرایشگر اسمبلی)، هر ۳ برنامه نمونه را در ROM بارگذاری و اجرا کن تا خروجی‌های 12، شمارش معکوس 5→0 و ضرب 6×4=24 روی نمایشگر پردازنده‌ات ثبت شوند — سپس هر برنامه دلخواهی دوست داری بنویس!',
      unlocksText: 'تکمیل کامل کمپین لگو-۸ و کسب نشان معمار پردازنده 🏆',
    },
    hint: 'در پنل سمت چپ روی تب «اسمبلی و راوی» برو، یکی از ۳ برنامه نمونه را انتخاب کن، «کامپایل و بارگذاری در ROM» را بزن و سپس با دکمه پخش (▶) یا «تک‌گام کلاک» در نوار پایین اجرای زنده را ببین!',
    coachSteps: [
      { id: '14_1', text: 'گام ۱: برنامه ۱ (اولین جمع واقعی: 7+5=12) را کامپایل و اجرا کن.', check: (_c, s) => Object.values(s.outDisplays).some((d) => d.history.includes(12)) },
      { id: '14_2', text: 'گام ۲: برنامه ۲ (شمارش معکوس ۵ تا ۰ با حلقه JZ) را روی سخت‌افزار اجرا کن.', check: (_c, s) => Object.values(s.outDisplays).some((d) => d.history.join(',').includes('5,4,3,2,1,0')) },
      { id: '14_3', text: 'گام ۳: برنامه ۳ (ضرب ۶ × ۴ = ۲۴ با جمع متوالی) را اجرا کن!', check: (_c, s) => Object.values(s.outDisplays).some((d) => d.history.includes(24)) },
    ],
    initialCircuit: buildCpuMotherboardAutoBuild(),
    autoBuildCircuit: buildCpuMotherboardAutoBuild(),
    testKind: 'assembly_lab',
    unlocks: [],
  },
];
