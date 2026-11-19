import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Eye,
  GraduationCap,
  Layers,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  Wand2,
} from 'lucide-react';
import {
  CircuitGraph,
  CircuitNode,
  ComponentCategory,
  ComponentType,
  ISAEntry,
  NarrationFrame,
  RomWord,
  SimState,
  TestRowResult,
} from './types';
import { CATEGORY_META, COMPONENT_DEFS } from './engine/components';
import {
  buildDefaultControlUnitGraph,
  convertLevel12ToControlUnitBlueprint,
} from './engine/subcircuits';
import {
  createEmptySimState,
  evaluateCircuitInteractive,
  injectInputsIntoCircuit,
  inspectLiveCpu,
  readPortOutputs,
  stepClockCycle,
} from './engine/simulator';
import { assembleProgram, DEFAULT_ISA, PRESET_PROGRAMS, toBin } from './engine/assembler';
import { buildCpuMotherboardAutoBuild, CAMPAIGN_LEVELS } from './data/levels';
import { CanvasBoard } from './components/CanvasBoard';
import { PeekInsideModal } from './components/PeekInsideModal';
import { LeftPanel, LeftTab } from './components/LeftPanel';
import { GlossaryModal, LessonModal, LevelSelectModal, VictoryModal } from './components/Modals';
import { sound } from './utils/sound';

const LS_PROGRESS = 'lego8_completed_levels_v1';
const LS_ISA = 'lego8_custom_isa_v1';
const LS_CTRL = 'lego8_custom_ctrl_v1';
const LS_SANDBOX = 'lego8_sandbox_circuit_v1';

const ALL_SANDBOX_TYPES: ComponentType[] = [
  'SWITCH_1',
  'INPUT_4',
  'INPUT_8',
  'CONST_0',
  'CONST_1',
  'CONST_8',
  'LED_1',
  'DISPLAY_8',
  'OUT_DISPLAY',
  'NOT',
  'AND',
  'OR',
  'NAND',
  'NOR',
  'OR_4',
  'XOR',
  'SPLITTER_8',
  'MERGER_8',
  'SPLITTER_4',
  'MERGER_4',
  'HALF_ADDER',
  'FULL_ADDER',
  'ADDER_8',
  'MUX_1',
  'MUX_8',
  'NOT_8',
  'AND_8',
  'OR_8',
  'NOR_8',
  'ALU_8',
  'CLOCK',
  'DFF',
  'DFF_EN',
  'REG_8',
  'PC_8',
  'DECODER_2_4',
  'DECODER_4_16',
  'ROM_16',
  'CONTROL_UNIT',
];

function cloneGraph(g: CircuitGraph): CircuitGraph {
  return {
    nodes: g.nodes.map((n) => ({ ...n })),
    wires: g.wires.map((w) => ({ ...w })),
  };
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [mode, setMode] = useState<'campaign' | 'sandbox'>('campaign');
  const [levelId, setLevelId] = useState<number>(1);
  const [completedLevels, setCompletedLevels] = useState<number[]>(() => loadJson(LS_PROGRESS, []));
  const [isa, setIsa] = useState<ISAEntry[]>(() => loadJson(LS_ISA, DEFAULT_ISA));
  const [customControlUnit, setCustomControlUnit] = useState<CircuitGraph>(() =>
    loadJson(LS_CTRL, buildDefaultControlUnitGraph())
  );

  // Per-level circuit cache + Sandbox circuit
  const [savedLevelCircuits, setSavedLevelCircuits] = useState<Record<number, CircuitGraph>>({});
  const [sandboxCircuit, setSandboxCircuit] = useState<CircuitGraph>(() =>
    loadJson(LS_SANDBOX, buildCpuMotherboardAutoBuild())
  );

  const currentLevel = useMemo(
    () => (mode === 'campaign' ? CAMPAIGN_LEVELS.find((l) => l.id === levelId) ?? CAMPAIGN_LEVELS[0] : null),
    [mode, levelId]
  );

  const [circuit, setCircuit] = useState<CircuitGraph>(() => cloneGraph(CAMPAIGN_LEVELS[0].initialCircuit));
  const [undoStack, setUndoStack] = useState<CircuitGraph[]>([]);
  const [simState, setSimState] = useState<SimState>(() => createEmptySimState());

  // Assembly & ROM state
  const [asmCode, setAsmCode] = useState<string>(() => PRESET_PROGRAMS[0].buildCode(DEFAULT_ISA));
  const [romWords, setRomWords] = useState<RomWord[]>(() => assembleProgram(PRESET_PROGRAMS[0].buildCode(DEFAULT_ISA), DEFAULT_ISA).words);
  const [activePresetId, setActivePresetId] = useState<'add' | 'countdown' | 'multiply' | null>('add');
  const [completedPresets, setCompletedPresets] = useState<Record<string, boolean>>({});

  // Clock & Narrator
  const [clockRunning, setClockRunning] = useState(false);
  const [clockSpeedMs, setClockSpeedMs] = useState(550);
  const [cycleCount, setCycleCount] = useState(0);
  const [narration, setNarration] = useState<NarrationFrame | null>(null);

  // UI panels & modals
  const [leftTab, setLeftTab] = useState<LeftTab>('mission');
  const [showBusValues, setShowBusValues] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [showLesson, setShowLesson] = useState(true);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [victoryLevel, setVictoryLevel] = useState<number | null>(null);
  const [peekNode, setPeekNode] = useState<CircuitNode | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'info' | 'error' | 'success' } | null>(null);

  // Testbench UI
  const [testResults, setTestResults] = useState<TestRowResult[] | null>(null);
  const [testSummary, setTestSummary] = useState<{ passed: boolean; message: string } | null>(null);

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string, kind: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  // Persist user data
  useEffect(() => {
    localStorage.setItem(LS_PROGRESS, JSON.stringify(completedLevels));
  }, [completedLevels]);

  useEffect(() => {
    localStorage.setItem(LS_ISA, JSON.stringify(isa));
  }, [isa]);

  useEffect(() => {
    localStorage.setItem(LS_CTRL, JSON.stringify(customControlUnit));
  }, [customControlUnit]);

  useEffect(() => {
    if (mode === 'sandbox') {
      localStorage.setItem(LS_SANDBOX, JSON.stringify(circuit));
    }
  }, [mode, circuit]);

  // Compile Assembly live for editor diagnostics
  const compiled = useMemo(() => assembleProgram(asmCode, isa), [asmCode, isa]);

  // Re-evaluate combinational & manual-edge signals whenever circuit, ROM, or Control Unit changes
  useEffect(() => {
    setSimState((prev) =>
      evaluateCircuitInteractive(circuit, prev, {
        romProgram: romWords,
        customControlUnit,
      })
    );
  }, [circuit, romWords, customControlUnit]);

  // Whenever player edits Level 12, keep customControlUnit live-synced!
  const handleCircuitChange = useCallback(
    (next: CircuitGraph, pushUndo = false) => {
      if (pushUndo) {
        setUndoStack((prev) => [...prev.slice(-24), cloneGraph(circuit)]);
      }
      setCircuit(next);
      if (mode === 'campaign' && levelId === 12) {
        const bp = convertLevel12ToControlUnitBlueprint(next);
        setCustomControlUnit(bp);
      }
      if (mode === 'sandbox') {
        setSandboxCircuit(next);
      }
    },
    [circuit, mode, levelId]
  );

  // Switch between Campaign Levels cleanly
  const switchToLevel = useCallback(
    (targetId: number, openLesson = true) => {
      setClockRunning(false);
      // Save current board
      if (mode === 'campaign') {
        setSavedLevelCircuits((prev) => ({ ...prev, [levelId]: cloneGraph(circuit) }));
      } else {
        setSandboxCircuit(cloneGraph(circuit));
      }
      setMode('campaign');
      setLevelId(targetId);
      const target = CAMPAIGN_LEVELS.find((l) => l.id === targetId) ?? CAMPAIGN_LEVELS[0];

      // Level 14 inherits completed Level 13 CPU if available, otherwise full working CPU
      let nextGraph: CircuitGraph;
      if (savedLevelCircuits[targetId]) {
        nextGraph = cloneGraph(savedLevelCircuits[targetId]);
      } else if (targetId === 14 && savedLevelCircuits[13] && savedLevelCircuits[13].wires.length > 20) {
        nextGraph = cloneGraph(savedLevelCircuits[13]);
      } else {
        nextGraph = cloneGraph(target.initialCircuit);
      }

      setCircuit(nextGraph);
      setUndoStack([]);
      setSimState(createEmptySimState());
      setCycleCount(0);
      setNarration(null);
      setTestResults(null);
      setTestSummary(null);
      setShowHint(false);
      setShowLesson(openLesson);
      setLeftTab(targetId === 14 ? 'assembly' : 'mission');
    },
    [mode, levelId, circuit, savedLevelCircuits]
  );

  const switchToSandbox = () => {
    setClockRunning(false);
    if (mode === 'campaign') {
      setSavedLevelCircuits((prev) => ({ ...prev, [levelId]: cloneGraph(circuit) }));
    }
    setMode('sandbox');
    setCircuit(cloneGraph(sandboxCircuit));
    setUndoStack([]);
    setSimState(createEmptySimState());
    setCycleCount(0);
    setNarration(null);
    setTestResults(null);
    setTestSummary(null);
    setShowLesson(false);
    setLeftTab('assembly');
  };

  // Build authentic Persian Execution Narration from REAL before/after wire snapshots
  const buildNarration = useCallback(
    (
      before: ReturnType<typeof inspectLiveCpu>,
      after: ReturnType<typeof inspectLiveCpu>,
      nextCycle: number
    ): NarrationFrame => {
      const entry = isa.find((e) => e.opcode === before.op);
      const mnemonic = entry?.mnemonic ?? `OP_${before.op}`;
      const activeCtrl = Object.entries(before.controlWires)
        .filter(([, v]) => v === 1)
        .map(([k]) => k);

      const fetchText = `شمارنده برنامه (PC) آدرس ${before.pc} را به ROM فرستاد و دستور خط ${before.pc} خوانده شد: «${mnemonic}${
        entry?.hasArg ? ` ${before.arg}` : ''
      }» (آپ‌کد ${toBin(before.op, 4)}).`;

      const decodeText =
        activeCtrl.length > 0
          ? `واحد کنترلی که خودت ساختی کد ${toBin(before.op, 4)} را شناخت و سیم‌های ${activeCtrl.join(' ، ')} را روشن کرد.`
          : before.op === 0
            ? 'کد 0000 (NOP) دریافت شد؛ هیچ سیم کنترلی روشن نشد.'
            : `واحد کنترل برای آپ‌کد ${toBin(before.op, 4)} هیچ سیم کنترلی روشن نکرد!`;

      let executeText = '';
      if (before.controlWires['HALT'] === 1 || after.halted) {
        executeText = 'سیم HALT به تپش کلاک رسید و پردازنده با موفقیت متوقف شد!';
      } else if (before.controlWires['LD_A'] === 1) {
        executeText = `عدد ${before.arg} از گذرگاه ARG عبور کرد و در رجیستر A ذخیره شد (A = ${after.regA})؛ PC به خط ${after.pc} رفت.`;
      } else if (before.controlWires['LD_B'] === 1) {
        executeText = `عدد ${before.arg} در رجیستر B ذخیره شد (B = ${after.regB})؛ PC به خط ${after.pc} رفت.`;
      } else if (before.controlWires['ALU_WR'] === 1) {
        const opIdx = (before.controlWires['ALU_OP1'] << 1) | before.controlWires['ALU_OP0'];
        const opName = ['جمع (+)', 'تفریق (−)', 'AND بیتی (&)', 'OR بیتی (|)'][opIdx];
        executeText = `واحد ALU عمل ${opName} را روی A=${before.regA} و B=${before.regB} انجام داد ← حاصل (${before.aluRes}) در رجیستر A و پرچم صفر (Z=${before.aluZero}) در FLAG Z ثبت شد!`;
      } else if (before.controlWires['OUT_EN'] === 1) {
        executeText = `مقدار رجیستر A (عدد ${before.regA}) روی نمایشگر خروجی پردازنده قفل و نمایش داده شد!`;
      } else if (before.controlWires['SWAP'] === 1) {
        executeText = `مقادیر رجیستر A (${before.regA}) و رجیستر کمکی C (${before.regC}) هم‌زمان روی لبه کلاک جابه‌جا شدند ← حالا A=${after.regA} و C=${after.regC}.`;
      } else if (before.controlWires['PC_LD'] === 1) {
        executeText = `سیم PC_LD روشن بود! شمارنده برنامه به آدرس ${before.arg} پرید (PC = ${after.pc}).`;
      } else if (before.op === 9) {
        executeText = `شرط پرش JZ برقرار نبود (Z_FLAG=${before.flagZ} یا سیم JZ قطع است)، پس PC نپرید و به خط بعدی (${after.pc}) رفت.`;
      } else {
        executeText = `شمارنده برنامه از خط ${before.pc} به خط ${after.pc} رفت.`;
      }

      let warningText: string | undefined;
      if (before.op === 9 && before.flagZ === 1 && before.controlWires['PC_LD'] === 0) {
        warningText =
          'توجه! پرچم صفر (Z_FLAG) برابر ۱ بود و دستور JZ اجرا شد، اما سیم PC_LD روشن نشد! سیم‌کشی گیت AND(OP9, Z_FLAG) داخل واحد کنترل را بررسی کن!';
      }

      return {
        cycle: nextCycle,
        pcBefore: before.pc,
        pcAfter: after.pc,
        opcode: before.op,
        arg: before.arg,
        mnemonic,
        activeControlWires: activeCtrl,
        regA: after.regA,
        regB: after.regB,
        regC: after.regC,
        aluRes: before.aluRes,
        aluZero: before.aluZero,
        flagZ: after.flagZ,
        outVal: after.outVal,
        halted: after.halted,
        fetchText,
        decodeText,
        executeText,
        warningText,
      };
    },
    [isa]
  );

  // Single Synchronous Clock Step (genuine electrical signal propagation!)
  const handleStepClock = useCallback(() => {
    const beforeCpu = inspectLiveCpu(circuit, simState);
    const { nextState, halted } = stepClockCycle(circuit, simState, {
      romProgram: romWords,
      customControlUnit,
    });

    if (halted && beforeCpu.halted) {
      setClockRunning(false);
      showToast('پردازنده با سیگنال سخت‌افزاری HALT متوقف شده است. برای اجرای مجدد «ریست» را بزن.', 'info');
      return;
    }

    sound.tick();
    const nextCycle = cycleCount + 1;
    setSimState(nextState);
    setCycleCount(nextCycle);

    const afterCpu = inspectLiveCpu(circuit, nextState);
    if (beforeCpu.hasCpuNodes) {
      setNarration(buildNarration(beforeCpu, afterCpu, nextCycle));

      // Detect Level 14 preset program genuine hardware completion!
      if (afterCpu.halted) {
        setClockRunning(false);
        const hist = afterCpu.outHistory;
        if (activePresetId) {
          const preset = PRESET_PROGRAMS.find((p) => p.id === activePresetId);
          if (preset && JSON.stringify(hist) === JSON.stringify(preset.expectedOutputs)) {
            setCompletedPresets((prev) => {
              const updated = { ...prev, [preset.id]: true };
              if (mode === 'campaign' && levelId === 14 && updated.add && updated.countdown && updated.multiply) {
                setCompletedLevels((cl) => (cl.includes(14) ? cl : [...cl, 14]));
                setVictoryLevel(14);
                sound.victory();
              } else {
                sound.victory();
              }
              return updated;
            });
            showToast(`عالی! «${preset.title}» با موفقیت کامل روی سخت‌افزار خودت اجرا شد!`, 'success');
          }
        }
      }
    }
  }, [
    circuit,
    simState,
    romWords,
    customControlUnit,
    cycleCount,
    buildNarration,
    activePresetId,
    mode,
    levelId,
    showToast,
  ]);

  // Auto-clock loop
  useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => {
      handleStepClock();
    }, clockSpeedMs);
    return () => window.clearInterval(id);
  }, [clockRunning, clockSpeedMs, handleStepClock]);

  const handleResetSim = () => {
    setClockRunning(false);
    const fresh = evaluateCircuitInteractive(circuit, createEmptySimState(), {
      romProgram: romWords,
      customControlUnit,
    });
    setSimState(fresh);
    setCycleCount(0);
    setNarration(null);
    sound.toggle(false);
  };

  // Place component from palette (click or drag-drop)
  const addNodeToCanvas = (type: ComponentType, x?: number, y?: number) => {
    const offset = (circuit.nodes.length % 7) * 28;
    const newNode: CircuitNode = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type,
      x: x ?? 260 + offset,
      y: y ?? 120 + offset,
      value: type === 'CONST_8' ? 1 : 0,
    };
    handleCircuitChange({ ...circuit, nodes: [...circuit.nodes, newNode] }, true);
    sound.snap();
  };

  // Auto-Build solution
  const handleAutoBuild = () => {
    setClockRunning(false);
    const target = mode === 'sandbox' ? buildCpuMotherboardAutoBuild() : currentLevel?.autoBuildCircuit;
    if (!target) return;
    const cloned = cloneGraph(target);
    handleCircuitChange(cloned, true);
    setSimState(createEmptySimState());
    setCycleCount(0);
    setNarration(null);
    setTestResults(null);
    setTestSummary(null);
    sound.snap();
    showToast('چیدمان خودکار کامل شد! اکنون سیم‌کشی را بررسی کن و «تست مدار» را بزن.', 'success');
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setCircuit(prev);
    if (mode === 'campaign' && levelId === 12) {
      setCustomControlUnit(convertLevel12ToControlUnitBlueprint(prev));
    }
    sound.toggle(false);
  };

  const handleClearWires = () => {
    setClockRunning(false);
    handleCircuitChange(
      {
        nodes: circuit.nodes.filter((n) => n.locked),
        wires: [],
      },
      true
    );
    setSimState(createEmptySimState());
    setCycleCount(0);
    setNarration(null);
    setTestResults(null);
    setTestSummary(null);
  };

  // Custom ISA renaming
  const handleRenameMnemonic = (opcode: number, raw: string): string | null => {
    const clean = raw.trim().toUpperCase();
    if (!clean) return 'نام دستور نمی‌تواند خالی باشد.';
    if (!/^[A-Z_][A-Z0-9_]*$/.test(clean)) {
      return 'فقط حروف انگلیسی، عدد و خط زیر (_) مجاز است.';
    }
    const dup = isa.some((e) => e.opcode !== opcode && e.mnemonic.toUpperCase() === clean);
    if (dup) return `نام «${clean}» قبلاً برای دستور دیگری استفاده شده است.`;
    setIsa((prev) => prev.map((e) => (e.opcode === opcode ? { ...e, mnemonic: clean } : e)));
    return null;
  };

  const handleCompileAndLoad = () => {
    if (!compiled.ok) {
      sound.error();
      showToast('کد اسمبلی خطا دارد! پیام‌های خطای فارسی زیر ویرایشگر را ببین.', 'error');
      return;
    }
    setClockRunning(false);
    setRomWords(compiled.words);
    const fresh = evaluateCircuitInteractive(circuit, createEmptySimState(), {
      romProgram: compiled.words,
      customControlUnit,
    });
    setSimState(fresh);
    setCycleCount(0);
    setNarration(null);
    sound.snap();
    showToast(`${compiled.words.length} دستور باینری در حافظه ROM بارگذاری شد! حالا کلاک بزن.`, 'success');
  };

  const handleLoadPreset = (presetId: 'add' | 'countdown' | 'multiply') => {
    const preset = PRESET_PROGRAMS.find((p) => p.id === presetId);
    if (!preset) return;
    const code = preset.buildCode(isa);
    setAsmCode(code);
    setActivePresetId(presetId);
    const res = assembleProgram(code, isa);
    if (res.ok) {
      setClockRunning(false);
      setRomWords(res.words);
      const fresh = evaluateCircuitInteractive(circuit, createEmptySimState(), {
        romProgram: res.words,
        customControlUnit,
      });
      setSimState(fresh);
      setCycleCount(0);
      setNarration(null);
      showToast(`«${preset.title}» کامپایل و در ROM بارگذاری شد!`, 'success');
    }
  };

  // Automated Hardware Verifier for ALL 14 Levels (100% genuine electrical simulation!)
  const handleRunTests = () => {
    if (!currentLevel) return;
    setClockRunning(false);

    // 1. Combinational Levels (1..8, 11, 12)
    if (currentLevel.testKind === 'combinational' && currentLevel.combTests) {
      if (currentLevel.id === 1) {
        const hasSw = circuit.nodes.some((n) => n.type === 'SWITCH_1');
        const hasLed = circuit.nodes.some((n) => n.type === 'LED_1');
        if (!hasSw || !hasLed) {
          sound.error();
          setTestSummary({
            passed: false,
            message: 'ابتدا یک «کلید برق ۱ بیتی» و یک «لامپ ۱ بیتی» روی تخته بگذار و با سیم به هم وصل کن.',
          });
          setTestResults([]);
          return;
        }
      }

      const rows: TestRowResult[] = currentLevel.combTests.map((tc, idx) => {
        const testCircuit = injectInputsIntoCircuit(circuit, tc.inputs);
        const st = evaluateCircuitInteractive(testCircuit, createEmptySimState(), {
          romProgram: [],
          customControlUnit,
        });
        const actual = readPortOutputs(testCircuit, st);
        const passed = Object.entries(tc.expected).every(([k, v]) => actual[k] === v);
        return {
          index: idx,
          label: tc.label,
          inputs: tc.inputs,
          expected: tc.expected,
          actual,
          passed,
        };
      });

      const allPass = rows.every((r) => r.passed);
      setTestResults(rows);
      if (allPass) {
        if (currentLevel.id === 12) {
          setCustomControlUnit(convertLevel12ToControlUnitBlueprint(circuit));
        }
        setCompletedLevels((prev) => (prev.includes(currentLevel.id) ? prev : [...prev, currentLevel.id]));
        setTestSummary({
          passed: true,
          message: 'تبریک! تمام ردیف‌های جدول درستی با موفقیت ۱۰۰٪ روی مدار واقعی تو قبول شدند!',
        });
        setVictoryLevel(currentLevel.id);
        sound.victory();
      } else {
        const failCount = rows.filter((r) => !r.passed).length;
        setTestSummary({
          passed: false,
          message: `${failCount} تست خطا داشت! روی دکمه «اعمال این ورودی روی مدار» در ردیف قرمز کلیک کن تا برق همان حالت را زنده روی سیم‌ها ببینی.`,
        });
        sound.error();
      }
      return;
    }

    // 2. Sequential Levels (9, 10)
    if (currentLevel.testKind === 'sequential' && currentLevel.seqTests) {
      let st = createEmptySimState();
      const rows: TestRowResult[] = [];
      for (let i = 0; i < currentLevel.seqTests.length; i++) {
        const step = currentLevel.seqTests[i];
        const testCircuit = injectInputsIntoCircuit(circuit, step.inputs);
        if (step.tickClock) {
          st = stepClockCycle(testCircuit, st, { romProgram: [], customControlUnit }).nextState;
        } else {
          st = evaluateCircuitInteractive(testCircuit, st, { romProgram: [], customControlUnit });
        }
        const actual = readPortOutputs(testCircuit, st);
        const passed = Object.entries(step.expected).every(([k, v]) => actual[k] === v);
        rows.push({
          index: i,
          label: step.label,
          inputs: step.inputs,
          expected: step.expected,
          actual,
          passed,
          isSequential: true,
          stepIndex: i,
        });
      }

      const allPass = rows.every((r) => r.passed);
      setTestResults(rows);
      if (allPass) {
        setCompletedLevels((prev) => (prev.includes(currentLevel.id) ? prev : [...prev, currentLevel.id]));
        setTestSummary({
          passed: true,
          message: 'فوق‌العاده! حلقه بازخورد و حافظه همگام با کلاک دقیق و بدون خطا کار کرد!',
        });
        setVictoryLevel(currentLevel.id);
        sound.victory();
      } else {
        setTestSummary({
          passed: false,
          message: 'در یکی از گام‌های کلاک مقدار خروجی با انتظار فرق داشت. اتصالات حلقه بازخورد و پایه CLK را بررسی کن!',
        });
        sound.error();
      }
      return;
    }

    // 3. Level 13 Full CPU Hardware Diagnostic (strictly runs compiled binary on the player's actual netlist!)
    if (currentLevel.testKind === 'cpu_diagnostic') {
      const diagWords: RomWord[] = [
        { op: 1, arg: 9 }, // 0: LDI_A 9
        { op: 2, arg: 6 }, // 1: LDI_B 6
        { op: 3, arg: 0 }, // 2: ADD => A=15
        { op: 7, arg: 0 }, // 3: OUT => 15
        { op: 2, arg: 15 }, // 4: LDI_B 15
        { op: 4, arg: 0 }, // 5: SUB => A=0, Z=1
        { op: 9, arg: 8 }, // 6: JZ 8 (must jump over HLT!)
        { op: 10, arg: 0 }, // 7: HLT (fail trap if JZ broken)
        { op: 1, arg: 42 }, // 8: LDI_A 42
        { op: 7, arg: 0 }, // 9: OUT => 42
        { op: 10, arg: 0 }, // 10: HLT (pass!)
      ];

      let st = evaluateCircuitInteractive(circuit, createEmptySimState(), {
        romProgram: diagWords,
        customControlUnit,
      });

      let haltedCleanly = false;
      for (let tick = 0; tick < 25; tick++) {
        const res = stepClockCycle(circuit, st, { romProgram: diagWords, customControlUnit });
        st = res.nextState;
        if (res.halted) {
          haltedCleanly = true;
          break;
        }
      }

      const snap = inspectLiveCpu(circuit, st);
      const outHist = snap.outHistory;
      const rows: TestRowResult[] = [
        {
          index: 0,
          label: 'تست ۱: بارگذاری و جمع (9 + 6 = 15 → OUT)',
          inputs: {},
          expected: { OUT1: 15 },
          actual: { OUT1: outHist[0] ?? -1 },
          passed: outHist[0] === 15,
        },
        {
          index: 1,
          label: 'تست ۲: تفریق صفر، پرچم Z و پرش شرطی JZ (خروجی 42)',
          inputs: {},
          expected: { OUT2: 42 },
          actual: { OUT2: outHist[1] ?? -1 },
          passed: outHist[1] === 42,
        },
        {
          index: 2,
          label: 'تست ۳: توقف خودکار کلاک با دستور HLT',
          inputs: {},
          expected: { HALT: 1 },
          actual: { HALT: haltedCleanly ? 1 : 0 },
          passed: haltedCleanly,
        },
      ];

      const allPass = rows.every((r) => r.passed);
      setTestResults(rows);
      if (allPass) {
        setCompletedLevels((prev) => (prev.includes(13) ? prev : [...prev, 13]));
        setTestSummary({
          passed: true,
          message: 'شاهکار! پردازنده ۸ بیتی لگو-۸ تو تست کامل واکشی، رمزگشایی، جمع، پرش شرطی JZ و توقف HLT را ۱۰۰٪ سخت‌افزاری پاس کرد!',
        });
        setVictoryLevel(13);
        sound.victory();
      } else {
        setTestSummary({
          passed: false,
          message: 'تست عیب‌یابی سخت‌افزار کامل نشد. سیم‌کشی مادربورد (به‌خصوص کلاک، MUXهای رجیستر A، پرچم FLAG Z و PC_LD) را بررسی کن.',
        });
        sound.error();
      }
      return;
    }

    // 4. Level 14 Assembly Lab Progress Check
    if (currentLevel.testKind === 'assembly_lab') {
      const doneCount = ['add', 'countdown', 'multiply'].filter((k) => completedPresets[k]).length;
      if (doneCount === 3) {
        setCompletedLevels((prev) => (prev.includes(14) ? prev : [...prev, 14]));
        setTestSummary({ passed: true, message: 'هر ۳ برنامه اسمبلی با موفقیت روی پردازنده واقعی تو اجرا شدند!' });
        setVictoryLevel(14);
        sound.victory();
      } else {
        setTestSummary({
          passed: false,
          message: `تا الان ${doneCount} از ۳ برنامه نمونه روی سخت‌افزار اجرا شده است. به تب «اسمبلی و راوی» برو و بقیه برنامه‌ها را بارگذاری و اجرا کن!`,
        });
      }
    }
  };

  // Smart Failure Injector: applies exact failing row onto live canvas!
  const handleInjectFailure = (row: TestRowResult) => {
    if (row.isSequential && currentLevel?.seqTests && row.stepIndex !== undefined) {
      let st = createEmptySimState();
      let liveCircuit = circuit;
      for (let i = 0; i <= row.stepIndex; i++) {
        const step = currentLevel.seqTests[i];
        liveCircuit = injectInputsIntoCircuit(circuit, step.inputs);
        st = step.tickClock
          ? stepClockCycle(liveCircuit, st, { romProgram: romWords, customControlUnit }).nextState
          : evaluateCircuitInteractive(liveCircuit, st, { romProgram: romWords, customControlUnit });
      }
      setCircuit(liveCircuit);
      setSimState(st);
      showToast(`حالت خطا (گام ${row.stepIndex + 1}) روی مدار اعمال شد؛ سیم‌ها را بررسی کن!`, 'info');
    } else {
      const nextCircuit = injectInputsIntoCircuit(circuit, row.inputs);
      setCircuit(nextCircuit);
      showToast(`ورودی‌های تست «${row.label}» زنده روی کلیدهای مدار اعمال شدند!`, 'info');
    }
    sound.toggle(true);
  };

  // Palette grouped by category
  const paletteGroups = useMemo(() => {
    const allowed = mode === 'sandbox' ? ALL_SANDBOX_TYPES : currentLevel?.palette ?? [];
    const map: Partial<Record<ComponentCategory, ComponentType[]>> = {};
    for (const t of allowed) {
      const cat = COMPONENT_DEFS[t].category;
      if (!map[cat]) map[cat] = [];
      map[cat]!.push(t);
    }
    return Object.entries(map) as [ComponentCategory, ComponentType[]][];
  }, [mode, currentLevel]);

  const liveCpu = useMemo(() => inspectLiveCpu(circuit, simState), [circuit, simState]);
  const showClockBar = mode === 'sandbox' || Boolean(currentLevel?.showClockBar);

  return (
    <div dir="rtl" className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* TOP NAVIGATION BAR */}
      <header className="h-14 shrink-0 bg-slate-950 border-b border-slate-800/90 px-3 flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-gradient-to-l from-cyan-500/20 to-violet-500/20 border border-cyan-400/35 px-3 py-1.5 rounded-xl">
            <Cpu className="w-5 h-5 text-cyan-300" />
            <div className="leading-tight">
              <div className="text-xs font-extrabold text-white tracking-tight">لگو-۸ (LEGO-8)</div>
              <div className="text-[9.5px] text-cyan-300">از اولین بیت تا اسمبلی</div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => (mode === 'sandbox' ? switchToLevel(levelId, false) : null)}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                mode === 'campaign' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              کمپین آموزشی
            </button>
            <button
              onClick={switchToSandbox}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                mode === 'sandbox' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              حالت آزاد
            </button>
          </div>

          {/* Level Selector Pill */}
          {mode === 'campaign' && currentLevel && (
            <button
              onClick={() => setShowLevelSelect(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs transition"
            >
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                مرحله {currentLevel.id}/۱۴
              </span>
              <span className="font-bold text-slate-100 max-w-[200px] truncate hidden md:inline">
                {currentLevel.title}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Right Utility Actions */}
        <div className="flex items-center gap-1.5">
          {mode === 'campaign' && (
            <button
              onClick={() => setShowLesson(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-bold transition"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden xl:inline">آموزش این مرحله</span>
            </button>
          )}

          <button
            onClick={() => setShowGlossary(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 text-xs font-bold transition"
          >
            <BookMarked className="w-4 h-4" />
            <span className="hidden xl:inline">فرهنگنامه تصویری</span>
          </button>

          <button
            onClick={() => setShowBusValues((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              showBusValues
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title="نمایش مقادیر باینری و ده‌دهی روی گذرگاه‌ها"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">مقادیر سیم‌ها</span>
          </button>

          <button
            onClick={handleAutoBuild}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 border border-violet-400/40 text-violet-200 text-xs font-bold transition"
            title="چیدمان خودکار مدار استاندارد برای یادگیری و بررسی"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{mode === 'sandbox' ? 'بارگذاری CPU کامل' : 'چیدمان خودکار'}</span>
          </button>

          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200"
            title="بازگشت (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleClearWires}
            className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/25 border border-slate-700 text-slate-300 hover:text-rose-200"
            title="پاک کردن سیم‌ها و قطعات اضافی"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              sound.muted = !muted;
              setMuted(!muted);
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
            title={muted ? 'فعال کردن صدا' : 'قطع صدا'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
          </button>
        </div>
      </header>

      {/* MAIN WORKBENCH (RTL: Right = Palette, Center = PCB Canvas, Left = Mission/ISA/Assembly) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* RIGHT PANEL (RTL Start): Categorized Lego Component Palette */}
        <aside className="w-56 shrink-0 bg-slate-900/95 border-l border-slate-800 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              جعبه قطعات لگویی
            </span>
            <span className="text-[10px] text-slate-400">کلیک یا بکش</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
            {paletteGroups.map(([cat, types]) => {
              const meta = CATEGORY_META[cat];
              return (
                <div key={cat} className="space-y-1.5">
                  <div className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md inline-block ${meta.badge}`}>
                    {meta.label}
                  </div>
                  <div className="space-y-1.5">
                    {types.map((t) => {
                      const def = COMPONENT_DEFS[t];
                      return (
                        <button
                          key={t}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/lego-component', t);
                          }}
                          onClick={() => addNodeToCanvas(t)}
                          className={`w-full text-right p-2 rounded-xl border ${meta.border} bg-gradient-to-l ${meta.bg} hover:brightness-125 active:scale-[0.98] transition flex items-center justify-between gap-1.5 shadow`}
                          title={def.description}
                        >
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-bold text-slate-100 truncate">{def.faName}</div>
                            <div className="text-[9.5px] font-mono text-slate-400">{def.enName}</div>
                          </div>
                          {def.encapsulated && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold shrink-0">
                              آی‌سی
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER WORKBENCH: PCB Canvas + Floating Coach Pill + Toast */}
        <main className="flex-1 relative min-w-0 overflow-hidden">
          <CanvasBoard
            circuit={circuit}
            simState={simState}
            showBusValues={showBusValues}
            clockSpeedMs={clockSpeedMs}
            onChangeCircuit={handleCircuitChange}
            onPeekInside={(node) => setPeekNode(node)}
            onToast={showToast}
            onDropPaletteType={(type, x, y) => addNodeToCanvas(type, x, y)}
          />

          {/* Floating Step-by-Step Coach Checklist Pill */}
          {mode === 'campaign' && currentLevel && (
            <div className="absolute top-3 right-3 z-20 max-w-xs">
              <button
                onClick={() => setShowCoach((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-xs font-bold text-cyan-200 shadow-lg backdrop-blur"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>مربی گام‌به‌گام</span>
                <span className="font-mono text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded">
                  {currentLevel.coachSteps.filter((s) => s.check(circuit, simState)).length}/
                  {currentLevel.coachSteps.length}
                </span>
              </button>

              {showCoach && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur space-y-1.5">
                  {currentLevel.coachSteps.map((st) => {
                    const ok = st.check(circuit, simState);
                    return (
                      <div
                        key={st.id}
                        className={`flex items-start gap-1.5 text-[11px] leading-snug ${
                          ok ? 'text-emerald-300 line-through opacity-80' : 'text-slate-200'
                        }`}
                      >
                        {ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-500 shrink-0 mt-0.5" />
                        )}
                        <span>{st.text}</span>
                      </div>
                    );
                  })}
                  <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                    نکته: برای کشیدن سیم روی پایه خروجی (راست) و سپس ورودی (چپ) کلیک کن. برای قطع سیم روی خود سیم کلیک کن.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toast Feedback Banner */}
          {toast && (
            <div
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl border text-xs font-bold shadow-2xl backdrop-blur ${
                toast.kind === 'error'
                  ? 'bg-rose-950/95 border-rose-500/60 text-rose-100'
                  : toast.kind === 'success'
                    ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
                    : 'bg-slate-900/95 border-cyan-500/50 text-cyan-100'
              }`}
            >
              {toast.msg}
            </div>
          )}
        </main>

        {/* LEFT PANEL (RTL End): Mission & Testbench / Custom ISA / Assembly & Live Narrator */}
        <LeftPanel
          activeTab={leftTab}
          onChangeTab={setLeftTab}
          level={currentLevel}
          isSandbox={mode === 'sandbox'}
          testResults={testResults}
          testSummary={testSummary}
          onRunTests={handleRunTests}
          onInjectFailure={handleInjectFailure}
          showHint={showHint}
          onToggleHint={() => setShowHint((h) => !h)}
          isa={isa}
          onRenameMnemonic={handleRenameMnemonic}
          onResetIsa={() => setIsa(DEFAULT_ISA)}
          asmCode={asmCode}
          onChangeAsmCode={(code) => {
            setAsmCode(code);
            setActivePresetId(null);
          }}
          compiled={compiled}
          romWords={romWords}
          onCompileAndLoad={handleCompileAndLoad}
          onLoadPreset={handleLoadPreset}
          liveCpu={liveCpu}
          narration={narration}
          completedPresets={completedPresets}
        />
      </div>

      {/* BOTTOM CLOCK & EXECUTION CONTROL BAR */}
      {showClockBar && (
        <footer className="h-13 shrink-0 bg-slate-950 border-t border-slate-800 px-4 py-2 flex items-center justify-between gap-4 z-30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setClockRunning((r) => !r)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-extrabold text-xs transition ${
                clockRunning
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {clockRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              {clockRunning ? 'توقف موقت' : 'اجرای خودکار کلاک'}
            </button>

            <button
              onClick={handleStepClock}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-200 font-bold text-xs transition"
            >
              <StepForward className="w-4 h-4" />
              تک‌گام کلاک
            </button>

            <button
              onClick={handleResetSim}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ریست (صفر کردن حافظه)
            </button>
          </div>

          {/* Clock Speed Slider */}
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <span className="text-[11px] text-slate-400">آهسته (تماشای برق)</span>
            <input
              type="range"
              min={80}
              max={1400}
              step={40}
              value={1480 - clockSpeedMs}
              onChange={(e) => setClockSpeedMs(1480 - parseInt(e.target.value, 10))}
              className="w-36 accent-cyan-400"
            />
            <span className="text-[11px] text-slate-400">سریع</span>
          </div>

          {/* Live Clock Counter & Hardware Status */}
          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
              <span className="text-slate-400 font-sans ml-1.5">شمارنده کلاک:</span>
              <span className="text-cyan-300 font-bold">{cycleCount}</span>
            </div>
            {simState.halted && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 font-bold text-[11px]">
                توقف سخت‌افزاری (HALT)
              </span>
            )}
          </div>
        </footer>
      )}

      {/* MODALS */}
      {showLesson && mode === 'campaign' && currentLevel && (
        <LessonModal level={currentLevel} onClose={() => setShowLesson(false)} />
      )}

      {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

      {showLevelSelect && (
        <LevelSelectModal
          levels={CAMPAIGN_LEVELS}
          currentLevelId={levelId}
          completedLevels={completedLevels}
          onSelect={(id) => switchToLevel(id, true)}
          onClose={() => setShowLevelSelect(false)}
        />
      )}

      {victoryLevel !== null && currentLevel && (
        <VictoryModal
          level={currentLevel}
          onStay={() => setVictoryLevel(null)}
          onNext={() => {
            setVictoryLevel(null);
            switchToLevel(Math.min(14, currentLevel.id + 1), true);
          }}
        />
      )}

      {peekNode && (
        <PeekInsideModal
          rootNode={peekNode}
          rootSimState={simState.subStates[peekNode.id] ?? createEmptySimState()}
          customControlUnit={customControlUnit}
          onUpdateControlUnit={(next) => {
            setCustomControlUnit(next);
            showToast('سیم‌کشی واحد کنترل به‌روزرسانی شد! اثر آن را زنده روی پردازنده ببین.', 'info');
          }}
          onClose={() => setPeekNode(null)}
        />
      )}
    </div>
  );
}
