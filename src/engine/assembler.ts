import { CompiledProgram, ISAEntry, RomWord } from '../types';

export const DEFAULT_ISA: ISAEntry[] = [
  {
    opcode: 0,
    mnemonic: 'NOP',
    defaultMnemonic: 'NOP',
    hasArg: false,
    hardwareSummary: 'هیچ سیم کنترلی روشن نمی‌شود؛ فقط PC یک واحد جلو می‌رود.',
    controlWires: [],
  },
  {
    opcode: 1,
    mnemonic: 'LDI_A',
    defaultMnemonic: 'LDI_A',
    hasArg: true,
    argKind: 'imm',
    hardwareSummary: 'عدد ARG را در رجیستر A ذخیره می‌کند (A ← ARG).',
    controlWires: ['LD_A'],
  },
  {
    opcode: 2,
    mnemonic: 'LDI_B',
    defaultMnemonic: 'LDI_B',
    hasArg: true,
    argKind: 'imm',
    hardwareSummary: 'عدد ARG را در رجیستر B ذخیره می‌کند (B ← ARG).',
    controlWires: ['LD_B'],
  },
  {
    opcode: 3,
    mnemonic: 'ADD',
    defaultMnemonic: 'ADD',
    hasArg: false,
    hardwareSummary: 'ALU عددهای A و B را جمع کرده و در A ذخیره می‌کند (A ← A + B).',
    controlWires: ['ALU_WR'],
  },
  {
    opcode: 4,
    mnemonic: 'SUB',
    defaultMnemonic: 'SUB',
    hasArg: false,
    hardwareSummary: 'ALU تفریق A - B را انجام داده در A می‌نویسد و پرچم صفر Z را به‌روز می‌کند.',
    controlWires: ['ALU_WR', 'ALU_OP0'],
  },
  {
    opcode: 5,
    mnemonic: 'AND',
    defaultMnemonic: 'AND',
    hasArg: false,
    hardwareSummary: 'عمل AND بیتی روی A و B انجام داده و در A ذخیره می‌کند.',
    controlWires: ['ALU_WR', 'ALU_OP1'],
  },
  {
    opcode: 6,
    mnemonic: 'OR',
    defaultMnemonic: 'OR',
    hasArg: false,
    hardwareSummary: 'عمل OR بیتی روی A و B انجام داده و در A ذخیره می‌کند.',
    controlWires: ['ALU_WR', 'ALU_OP0', 'ALU_OP1'],
  },
  {
    opcode: 7,
    mnemonic: 'OUT',
    defaultMnemonic: 'OUT',
    hasArg: false,
    hardwareSummary: 'مقدار رجیستر A را روی نمایشگر خروجی پردازنده قفل و نمایش می‌دهد.',
    controlWires: ['OUT_EN'],
  },
  {
    opcode: 8,
    mnemonic: 'JMP',
    defaultMnemonic: 'JMP',
    hasArg: true,
    argKind: 'addr',
    hardwareSummary: 'پرش بی‌شرط: شمارنده برنامه (PC) مستقیم به آدرس برچسب یا عدد ARG می‌پرد.',
    controlWires: ['PC_LD'],
  },
  {
    opcode: 9,
    mnemonic: 'JZ',
    defaultMnemonic: 'JZ',
    hasArg: true,
    argKind: 'addr',
    hardwareSummary: 'پرش شرطی: فقط اگر پرچم صفر (Z_FLAG=1) باشد، از طریق گیت AND به آدرس ARG می‌پرد.',
    controlWires: ['AND(OP9, Z_FLAG) → PC_LD'],
  },
  {
    opcode: 10,
    mnemonic: 'HLT',
    defaultMnemonic: 'HLT',
    hasArg: false,
    hardwareSummary: 'سیم HALT را روشن می‌کند تا تپش کلاک پردازنده متوقف شود.',
    controlWires: ['HALT'],
  },
  {
    opcode: 11,
    mnemonic: 'SWAP',
    defaultMnemonic: 'SWAP',
    hasArg: false,
    hardwareSummary: 'مقدار رجیستر A و رجیستر کمکی C را هم‌زمان در یک کلاک جابه‌جا می‌کند (A ↔ C).',
    controlWires: ['SWAP'],
  },
];

export function toBin(num: number, bits: number): string {
  return (num >>> 0).toString(2).padStart(bits, '0').slice(-bits);
}

/**
 * Pure Assembler: translates Assembly text into raw binary machine words (OP[3:0] + ARG[7:0])
 * strictly using the player's Custom ISA Mapping Table. ZERO execution logic lives here!
 */
export function assembleProgram(source: string, isa: ISAEntry[]): CompiledProgram {
  const lines = source.split(/\r?\n/);
  const labels: Record<string, number> = {};
  const errors: { line: number; message: string }[] = [];
  const parsed: { line: number; raw: string; opToken: string; argToken?: string }[] = [];

  const mnemonicMap = new Map<string, ISAEntry>();
  for (const entry of isa) {
    mnemonicMap.set(entry.mnemonic.trim().toUpperCase(), entry);
  }

  // Pass 1: strip comments, collect labels, count instruction addresses
  let addr = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const noComment = rawLine.split(';')[0].trim();
    if (!noComment) continue;

    // Support "LABEL:" or "LABEL: INSTR ARG"
    let rest = noComment;
    if (rest.includes(':')) {
      const colonIdx = rest.indexOf(':');
      const labelName = rest.slice(0, colonIdx).trim().toUpperCase();
      if (!/^[A-Z_][A-Z0-9_]*$/.test(labelName)) {
        errors.push({
          line: lineNo,
          message: `خط ${lineNo}: نام برچسب «${labelName}» معتبر نیست (فقط حروف انگلیسی، عدد و _ مجاز است).`,
        });
        continue;
      }
      if (labels[labelName] !== undefined) {
        errors.push({ line: lineNo, message: `خط ${lineNo}: برچسب «${labelName}» تکراری است.` });
      }
      labels[labelName] = addr;
      rest = rest.slice(colonIdx + 1).trim();
      if (!rest) continue;
    }

    const parts = rest.split(/\s+/);
    const opToken = parts[0].toUpperCase();
    const argToken = parts[1];
    if (parts.length > 2) {
      errors.push({
        line: lineNo,
        message: `خط ${lineNo}: تعداد بخش‌های دستور زیاد است. هر خط فقط شامل «نام دستور» و حداکثر یک «عدد/برچسب» است.`,
      });
      continue;
    }
    parsed.push({ line: lineNo, raw: noComment, opToken, argToken });
    addr++;
  }

  if (addr > 64) {
    errors.push({ line: lines.length, message: 'حجم برنامه از ظرفیت ۶۴ دستور حافظه ROM بیشتر است.' });
  }

  // Pass 2: encode into binary ROM words
  const words: RomWord[] = [];
  const lineToAddr: Record<number, number> = {};
  const addrToLine: Record<number, number> = {};

  for (let idx = 0; idx < parsed.length; idx++) {
    const item = parsed[idx];
    const entry = mnemonicMap.get(item.opToken);
    if (!entry) {
      errors.push({
        line: item.line,
        message: `خط ${item.line}: دستور «${item.opToken}» در میز طراحی دستورات شما وجود ندارد!`,
      });
      continue;
    }

    let argVal = 0;
    if (entry.hasArg) {
      if (!item.argToken) {
        errors.push({
          line: item.line,
          message: `خط ${item.line}: دستور «${entry.mnemonic}» نیاز به یک ${
            entry.argKind === 'addr' ? 'آدرس یا نام برچسب' : 'عدد (۰ تا ۲۵۵)'
          } دارد.`,
        });
        continue;
      }
      const upperArg = item.argToken.toUpperCase();
      if (labels[upperArg] !== undefined) {
        argVal = labels[upperArg];
      } else if (/^0B[01]+$/i.test(item.argToken)) {
        argVal = parseInt(item.argToken.slice(2), 2);
      } else if (/^0X[0-9A-F]+$/i.test(item.argToken)) {
        argVal = parseInt(item.argToken.slice(2), 16);
      } else if (/^\d+$/.test(item.argToken)) {
        argVal = parseInt(item.argToken, 10);
      } else {
        errors.push({
          line: item.line,
          message: `خط ${item.line}: مقدار یا برچسب «${item.argToken}» پیدا نشد.`,
        });
        continue;
      }
      if (argVal < 0 || argVal > 255) {
        errors.push({
          line: item.line,
          message: `خط ${item.line}: عدد ${argVal} خارج از بازه ۸ بیتی (۰ تا ۲۵۵) است.`,
        });
        continue;
      }
    } else if (item.argToken) {
      errors.push({
        line: item.line,
        message: `خط ${item.line}: دستور «${entry.mnemonic}» نیازی به ورودی اضافی «${item.argToken}» ندارد.`,
      });
      continue;
    }

    lineToAddr[item.line] = idx;
    addrToLine[idx] = item.line;
    words.push({
      op: entry.opcode & 0xf,
      arg: argVal & 0xff,
      line: item.line,
      source: item.raw,
    });
  }

  return {
    ok: errors.length === 0,
    words,
    errors,
    lineToAddr,
    addrToLine,
  };
}

export interface PresetProgram {
  id: 'add' | 'countdown' | 'multiply';
  title: string;
  subtitle: string;
  expectedOutputs: number[];
  buildCode: (isa: ISAEntry[]) => string;
}

const mn = (isa: ISAEntry[], opcode: number) =>
  isa.find((e) => e.opcode === opcode)?.mnemonic ?? DEFAULT_ISA[opcode].mnemonic;

export const PRESET_PROGRAMS: PresetProgram[] = [
  {
    id: 'add',
    title: 'برنامه ۱: اولین جمع واقعی',
    subtitle: 'جمع ۷ + ۵ و نمایش حاصل (۱۲) روی پردازنده',
    expectedOutputs: [12],
    buildCode: (isa) => `; برنامه ۱: اولین جمع واقعی روی پردازنده لگو-۸
${mn(isa, 1)} 7      ; عدد ۷ را در رجیستر A بگذار
${mn(isa, 2)} 5      ; عدد ۵ را در رجیستر B بگذار
${mn(isa, 3)}        ; A و B را در ALU جمع کن و در A ذخیره کن
${mn(isa, 7)}        ; نتیجه (۱۲) را روی نمایشگر خروجی چاپ کن
${mn(isa, 10)}       ; پردازنده را متوقف کن`,
  },
  {
    id: 'countdown',
    title: 'برنامه ۲: شمارش معکوس با شرط و حلقه',
    subtitle: 'شمارش ۵ تا ۰ با SUB، پرچم صفر (Z) و پرش شرطی JZ',
    expectedOutputs: [5, 4, 3, 2, 1, 0],
    buildCode: (isa) => `; برنامه ۲: شمارش معکوس از ۵ تا ۰ با حلقه سخت‌افزاری
${mn(isa, 1)} 5      ; مقدار شروع شمارنده = ۵
${mn(isa, 2)} 1      ; گام کاهش = ۱
LOOP:
${mn(isa, 7)}        ; عدد فعلی A را روی نمایشگر نشان بده
${mn(isa, 4)}        ; یکی از A کم کن (اگر ۰ شود پرچم Z روشن می‌شود)
${mn(isa, 9)} DONE   ; اگر پرچم Z روشن بود به پایان بپر!
${mn(isa, 8)} LOOP   ; وگرنه به ابتدای حلقه برگرد
DONE:
${mn(isa, 7)}        ; عدد صفر پایانی را نمایش بده
${mn(isa, 10)}       ; توقف پردازنده`,
  },
  {
    id: 'multiply',
    title: 'برنامه ۳: ضرب دو عدد با جمع متوالی',
    subtitle: 'محاسبه ۶ × ۴ = ۲۴ با الگوریتم حلقه و رجیستر کمکی C',
    expectedOutputs: [24],
    buildCode: (isa) => `; برنامه ۳: ضرب ۶ در ۴ با جمع متوالی (6 × 4 = 24)
; رجیستر A = حاصل جمع ، رجیستر کمکی C = شمارنده تکرار
${mn(isa, 1)} 4      ; تعداد دفعات جمع (۴) را در A بگذار
${mn(isa, 11)}       ; شمارنده را با SWAP به رجیستر C منتقل کن
${mn(isa, 1)} 0      ; مقدار اولیه حاصل جمع = ۰
LOOP:
${mn(isa, 2)} 6      ; عدد ۶ را در B بگذار
${mn(isa, 3)}        ; ۶ واحد به حاصل جمع اضافه کن
${mn(isa, 11)}       ; جای A و C را عوض کن تا شمارنده به A بیاید
${mn(isa, 2)} 1      ; عدد ۱ را در B بگذار
${mn(isa, 4)}        ; یکی از شمارنده کم کن (اگر ۰ شد فلگ Z روشن می‌شود)
${mn(isa, 9)} DONE   ; اگر شمارنده صفر شد، ضرب تمام است!
${mn(isa, 11)}       ; حاصل جمع را دوباره به A برگردان
${mn(isa, 8)} LOOP   ; تکرار حلقه
DONE:
${mn(isa, 11)}       ; نتیجه نهایی (۲۴) را از C به A بیاور
${mn(isa, 7)}        ; نمایش حاصل‌ضرب (۲۴) روی نمایشگر!
${mn(isa, 10)}       ; پایان اجرا`,
  },
];
