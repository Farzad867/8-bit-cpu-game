import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  FlaskConical,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  CompiledProgram,
  ISAEntry,
  LevelDef,
  NarrationFrame,
  RomWord,
  TestRowResult,
} from '../types';
import { DEFAULT_ISA, PRESET_PROGRAMS, toBin } from '../engine/assembler';
import { LiveCpuSnapshot } from '../engine/simulator';

export type LeftTab = 'mission' | 'isa' | 'assembly';

interface LeftPanelProps {
  activeTab: LeftTab;
  onChangeTab: (tab: LeftTab) => void;
  level: LevelDef | null; // null in Sandbox
  isSandbox: boolean;
  // Mission & Testbench
  testResults: TestRowResult[] | null;
  testSummary: { passed: boolean; message: string } | null;
  onRunTests: () => void;
  onInjectFailure: (row: TestRowResult) => void;
  showHint: boolean;
  onToggleHint: () => void;
  // Custom ISA
  isa: ISAEntry[];
  onRenameMnemonic: (opcode: number, newName: string) => string | null;
  onResetIsa: () => void;
  // Assembly & ROM & Narrator
  asmCode: string;
  onChangeAsmCode: (code: string) => void;
  compiled: CompiledProgram;
  romWords: RomWord[];
  onCompileAndLoad: () => void;
  onLoadPreset: (presetId: 'add' | 'countdown' | 'multiply') => void;
  liveCpu: LiveCpuSnapshot;
  narration: NarrationFrame | null;
  completedPresets: Record<string, boolean>;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  activeTab,
  onChangeTab,
  level,
  isSandbox,
  testResults,
  testSummary,
  onRunTests,
  onInjectFailure,
  showHint,
  onToggleHint,
  isa,
  onRenameMnemonic,
  onResetIsa,
  asmCode,
  onChangeAsmCode,
  compiled,
  romWords,
  onCompileAndLoad,
  onLoadPreset,
  liveCpu,
  narration,
  completedPresets,
}) => {
  const [isaError, setIsaError] = React.useState<string | null>(null);
  const showIsa = isSandbox || Boolean(level?.showIsaTab);
  const showAsm = isSandbox || Boolean(level?.showAssemblyTab);
  const activeSourceLine = compiled.addrToLine[liveCpu.pc];

  return (
    <aside className="w-[375px] shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Contextual Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 p-1.5 gap-1">
        <button
          onClick={() => onChangeTab('mission')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'mission'
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
              : 'text-slate-400 hover:bg-slate-800/70'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {isSandbox ? 'وضعیت مدار' : 'ماموریت و تست'}
        </button>

        {showIsa && (
          <button
            onClick={() => onChangeTab('isa')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'isa'
                ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                : 'text-slate-400 hover:bg-slate-800/70'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            میز دستورات
          </button>
        )}

        {showAsm && (
          <button
            onClick={() => onChangeTab('assembly')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'assembly'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                : 'text-slate-400 hover:bg-slate-800/70'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            اسمبلی و راوی
          </button>
        )}
      </div>

      {/* TAB 1: MISSION & SMART TESTBENCH */}
      {activeTab === 'mission' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          {isSandbox ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/30">
                <h3 className="text-sm font-bold text-cyan-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  آزمایشگاه آزاد (Sandbox)
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  در این حالت تمام قطعات لگویی پردازنده باز هستند! می‌توانی هر مدار ترکیبی، حافظه یا پردازنده سفارشی بسازی و برنامه‌های اسمبلی خودت را رویش اجرا کنی.
                </p>
              </div>
              {liveCpu.hasCpuNodes && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-amber-300">نمایشگر زنده رجیسترهای مادربورد</div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-center">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">PC</div>
                      <div className="text-cyan-300 font-bold text-base">{liveCpu.pc}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">REG A</div>
                      <div className="text-emerald-300 font-bold text-base">{liveCpu.regA}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">REG B</div>
                      <div className="text-amber-300 font-bold text-base">{liveCpu.regB}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">REG C</div>
                      <div className="text-violet-300 font-bold text-base">{liveCpu.regC}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">FLAG Z</div>
                      <div className="text-rose-300 font-bold text-base">{liveCpu.flagZ}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">OUT</div>
                      <div className="text-emerald-400 font-bold text-base">{liveCpu.outVal}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            level && (
              <>
                {/* Objective Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-400">{level.chapterTitle}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      مرحله {level.id} از ۱۴
                    </span>
                  </div>
                  <h2 className="text-sm font-extrabold text-white">{level.title}</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">{level.shortGoal}</p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={onRunTests}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-l from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {level.testKind === 'assembly_lab' ? 'بررسی پیشرفت آزمایشگاه' : 'تست مدار'}
                    </button>
                    <button
                      onClick={onToggleHint}
                      className="flex items-center gap-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-bold transition"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      راهنما
                    </button>
                  </div>

                  {showHint && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11.5px] text-amber-100 leading-relaxed">
                      💡 <strong>راهنما:</strong> {level.hint}
                    </div>
                  )}
                </div>

                {/* Level 14 Preset Progress Tracker */}
                {level.testKind === 'assembly_lab' && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" />
                      چالش‌های عملی روی سخت‌افزار خودت:
                    </div>
                    {PRESET_PROGRAMS.map((pr) => {
                      const done = Boolean(completedPresets[pr.id]);
                      return (
                        <div
                          key={pr.id}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                            done
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                            )}
                            <div>
                              <div className="font-bold text-[11.5px]">{pr.title}</div>
                              <div className="text-[10px] text-slate-400">{pr.subtitle}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              onLoadPreset(pr.id);
                              onChangeTab('assembly');
                            }}
                            className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 text-[10.5px] font-bold shrink-0"
                          >
                            بارگذاری
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Test Summary Banner */}
                {testSummary && (
                  <div
                    className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                      testSummary.passed
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'
                        : 'bg-rose-950/50 border-rose-500/50 text-rose-100'
                    }`}
                  >
                    {testSummary.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>{testSummary.message}</div>
                  </div>
                )}

                {/* Smart Truth-Table / Sequential Testbench Results */}
                {testResults && testResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>جدول نتایج تست خودکار:</span>
                      <span className="font-mono text-[11px] text-cyan-300">
                        {testResults.filter((r) => r.passed).length} / {testResults.length} قبول
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {testResults.map((row) => (
                        <div
                          key={row.index}
                          className={`p-2.5 rounded-xl border text-[11px] transition ${
                            row.passed
                              ? 'bg-emerald-950/25 border-emerald-500/30'
                              : 'bg-rose-950/35 border-rose-500/50 shadow-md shadow-rose-950/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-100 flex items-center gap-1.5">
                              {row.passed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              {row.label}
                            </span>
                            {!row.passed && (
                              <button
                                onClick={() => onInjectFailure(row)}
                                className="px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10px] transition shrink-0"
                              >
                                اعمال این ورودی روی مدار
                              </button>
                            )}
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5 font-mono text-[10px]" dir="ltr">
                            <div className="bg-slate-950/70 px-2 py-1 rounded text-emerald-300">
                              EXP:{' '}
                              {Object.entries(row.expected)
                                .map(([k, v]) => `${k}=${v}`)
                                .join(' ')}
                            </div>
                            <div
                              className={`bg-slate-950/70 px-2 py-1 rounded ${
                                row.passed ? 'text-cyan-300' : 'text-rose-300 font-bold'
                              }`}
                            >
                              GOT:{' '}
                              {Object.entries(row.actual)
                                .map(([k, v]) => `${k}=${v}`)
                                .join(' ')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}

      {/* TAB 2: CUSTOM INSTRUCTION ARCHITECT TABLE */}
      {activeTab === 'isa' && showIsa && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-rose-200">میز طراحی دستورات خودت (ISA)</h3>
              <button
                onClick={() => {
                  onResetIsa();
                  setIsaError(null);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200"
              >
                <RotateCcw className="w-3 h-3" />
                نام‌های پیش‌فرض
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              هر دستور دقیقاً به کد باینری ۴ بیتی‌اش در واحد کنترل متصل است. می‌توانی نام اسمبلی هر دستور را تغییر دهی (مثلاً <span className="font-mono text-amber-300">ADD → JAM</span> یا <span className="font-mono text-amber-300">OUT → CHAP</span>) و با گویش اختراعی خودت کد بنویسی!
            </p>
            {isaError && (
              <div className="text-[11px] text-rose-300 bg-rose-950/80 border border-rose-500/40 rounded px-2 py-1">
                ⚠️ {isaError}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {isa.map((entry) => (
              <div
                key={entry.opcode}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 font-mono text-[11px] font-bold text-rose-200">
                      {toBin(entry.opcode, 4)}
                    </span>
                    <input
                      type="text"
                      dir="ltr"
                      value={entry.mnemonic}
                      onChange={(e) => {
                        const err = onRenameMnemonic(entry.opcode, e.target.value);
                        setIsaError(err);
                      }}
                      className="w-24 px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 font-mono text-xs font-bold text-cyan-200 uppercase focus:outline-none focus:border-cyan-300"
                    />
                    {entry.hasArg && (
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {entry.argKind === 'addr' ? 'LABEL' : 'NUM'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    پیش‌فرض: {DEFAULT_ISA[entry.opcode].mnemonic}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{entry.hardwareSummary}</p>
                {entry.controlWires.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5" dir="ltr">
                    {entry.controlWires.map((cw) => (
                      <span
                        key={cw}
                        className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      >
                        {cw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ASSEMBLY EDITOR + COMPILED BINARY ROM + LIVE PERSIAN NARRATOR */}
      {activeTab === 'assembly' && showAsm && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Preset Switcher */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PROGRAMS.map((pr, idx) => (
              <button
                key={pr.id}
                onClick={() => onLoadPreset(pr.id)}
                className="flex-1 min-w-[95px] px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10.5px] font-bold text-slate-200 transition text-center"
              >
                {idx === 0 ? '۱. جمع واقعی' : idx === 1 ? '۲. شمارش معکوس' : '۳. ضرب حلقه‌ای'}
              </button>
            ))}
          </div>

          {/* LTR Monospace Code Editor with Active Line Highlight */}
          <div className="rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px]">
              <span className="font-bold text-amber-300">ویرایشگر اسمبلی لگو-۸</span>
              {activeSourceLine && (
                <span className="font-mono text-[10px] text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded">
                  PC={liveCpu.pc} ← خط {activeSourceLine}
                </span>
              )}
            </div>
            <div className="relative flex" dir="ltr">
              {/* Line Numbers Gutter */}
              <div className="w-8 bg-slate-900/90 border-r border-slate-800 py-2 text-right pr-1.5 font-mono text-[11px] leading-5 text-slate-500 select-none">
                {asmCode.split(/\r?\n/).map((_, idx) => {
                  const ln = idx + 1;
                  const isActive = ln === activeSourceLine;
                  return (
                    <div
                      key={ln}
                      className={isActive ? 'text-cyan-300 font-bold bg-cyan-500/20 rounded-l px-1' : ''}
                    >
                      {ln}
                    </div>
                  );
                })}
              </div>
              <textarea
                dir="ltr"
                spellCheck={false}
                value={asmCode}
                onChange={(e) => onChangeAsmCode(e.target.value)}
                rows={11}
                className="flex-1 bg-transparent p-2 font-mono text-[11.5px] leading-5 text-slate-100 focus:outline-none resize-y whitespace-pre overflow-x-auto"
              />
            </div>

            {/* Compiler Errors */}
            {compiled.errors.length > 0 && (
              <div className="p-2 bg-rose-950/70 border-t border-rose-500/40 space-y-1">
                {compiled.errors.map((err, i) => (
                  <div key={i} className="text-[11px] text-rose-200 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-2 bg-slate-900/90 border-t border-slate-800">
              <button
                onClick={onCompileAndLoad}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-l from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow transition"
              >
                کامپایل به باینری (۰ و ۱) و بارگذاری در ROM
              </button>
            </div>
          </div>

          {/* Live Persian Execution Narrator */}
          <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/40 to-slate-950 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-cyan-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                راوی زنده پردازنده (گزارش واقعی سیم‌ها)
              </h3>
              {narration && (
                <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                  کلاک #{narration.cycle}
                </span>
              )}
            </div>

            {narration ? (
              <div className="space-y-1.5 text-[11.5px] leading-relaxed">
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                  <span className="text-cyan-400 font-bold">۱. واکشی (Fetch): </span>
                  {narration.fetchText}
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                  <span className="text-rose-400 font-bold">۲. رمزگشایی (Decode): </span>
                  {narration.decodeText}
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200">
                  <span className="text-emerald-400 font-bold">۳. اجرا (Execute): </span>
                  {narration.executeText}
                </div>
                {narration.warningText && (
                  <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200">
                    ⚠️ {narration.warningText}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                کد را در ROM بارگذاری کن و سپس در نوار پایین دکمه <strong>«تک‌گام کلاک»</strong> یا <strong>«اجرا ▶»</strong> را بزن تا لحظه‌به‌لحظه ببینی سیم‌های واقعی پردازنده‌ات چطور دستورها را اجرا می‌کنند!
              </p>
            )}

            {/* Live Hardware Output History */}
            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">خروجی‌های ثبت‌شده نمایشگر:</span>
              <span className="font-mono font-bold text-emerald-300" dir="ltr">
                {liveCpu.outHistory.length > 0 ? `[ ${liveCpu.outHistory.join(', ')} ]` : '—'}
              </span>
            </div>
          </div>

          {/* Compiled Binary ROM Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-bold text-rose-300">حافظه باینری ROM (صفر و یک واقعی)</span>
              <span className="font-mono text-[10px] text-slate-400">{romWords.length} دستور</span>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/70 font-mono text-[10.5px]" dir="ltr">
              {romWords.length === 0 ? (
                <div className="p-3 text-center text-slate-500 font-sans" dir="rtl">
                  هنوز برنامه‌ای در ROM بارگذاری نشده است.
                </div>
              ) : (
                romWords.map((word, idx) => {
                  const isCurrent = idx === liveCpu.pc;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-2.5 py-1 ${
                        isCurrent ? 'bg-cyan-500/20 text-cyan-200 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <span className="w-7 text-slate-500">{String(idx).padStart(2, '0')}:</span>
                      <span className="text-rose-300">{toBin(word.op, 4)}</span>
                      <span className="text-amber-300">{toBin(word.arg, 8)}</span>
                      <span className="text-slate-400 truncate max-w-[105px] text-right">
                        {word.source ?? ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
