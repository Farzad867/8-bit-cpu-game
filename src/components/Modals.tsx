import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Cpu,
  GraduationCap,
  Lock,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { LevelDef } from '../types';
import { GLOSSARY_ITEMS } from '../data/glossary';

export const LessonModal: React.FC<{
  level: LevelDef;
  onClose: () => void;
}> = ({ level, onClose }) => {
  const [step, setStep] = useState(0);
  const { lesson } = level;

  const cards = [
    {
      badge: 'کارت ۱ از ۳ • داستان و مثال روزمره',
      title: lesson.storyTitle,
      body: lesson.storyText,
      diagram: null as string | null,
      accent: 'from-cyan-500/20 to-sky-500/10 border-cyan-400/40',
    },
    {
      badge: 'کارت ۲ از ۳ • چطور کار می‌کند؟',
      title: lesson.howTitle,
      body: lesson.howText,
      diagram: lesson.howDiagram,
      accent: 'from-amber-500/20 to-orange-500/10 border-amber-400/40',
    },
    {
      badge: 'کارت ۳ از ۳ • ماموریت تو در این مرحله',
      title: lesson.missionTitle,
      body: lesson.missionText,
      diagram: `🎁 جایزه تکمیل مرحله:\n${lesson.unlocksText}`,
      accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-400/40',
    },
  ];

  const card = cards[step];

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[11px] text-cyan-300 font-bold">درسنامه کوتاه مرحله {level.id}</div>
              <div className="text-sm font-extrabold text-white">{level.title}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Progress Pills */}
          <div className="flex gap-2">
            {cards.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setStep(idx)}
                className={`h-1.5 flex-1 rounded-full transition ${
                  idx === step ? 'bg-cyan-400' : idx < step ? 'bg-emerald-500/70' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className={`p-4 rounded-xl bg-gradient-to-br border ${card.accent} space-y-3`}>
            <span className="inline-block text-[11px] font-bold text-cyan-200 bg-slate-950/70 px-2.5 py-0.5 rounded-full">
              {card.badge}
            </span>
            <h3 className="text-base font-extrabold text-white">{card.title}</h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-7">{card.body}</p>
            {card.diagram && (
              <pre
                dir="ltr"
                className="p-3 rounded-xl bg-slate-950/90 border border-slate-700/70 font-mono text-[11.5px] leading-6 text-amber-200 overflow-x-auto whitespace-pre-wrap"
              >
                {card.diagram}
              </pre>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-t border-slate-800">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-bold text-slate-200"
          >
            <ArrowRight className="w-4 h-4" />
            کارت قبلی
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold"
            >
              کارت بعدی
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-xs font-extrabold shadow-lg shadow-cyan-500/20"
            >
              <Sparkles className="w-4 h-4" />
              بزن بریم بسازیم!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const GlossaryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const filtered = GLOSSARY_ITEMS.filter(
    (g) =>
      g.termFa.includes(query) ||
      g.termEn.toLowerCase().includes(query.toLowerCase()) ||
      g.explanation.includes(query)
  );

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[84vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white">فرهنگنامه تصویری پردازنده</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="جستجوی اصطلاح (مثلاً بایت، کلاک، آپ‌کد)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-56 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            />
            <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-cyan-200">{item.termFa}</h4>
                <span className="font-mono text-[10.5px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                  {item.termEn}
                </span>
              </div>
              <div className="text-[11.5px] text-amber-200 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                💡 {item.analogy}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{item.explanation}</p>
              <pre
                dir="ltr"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[10.5px] text-emerald-300 whitespace-pre-wrap"
              >
                {item.visualExample}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const LevelSelectModal: React.FC<{
  levels: LevelDef[];
  currentLevelId: number;
  completedLevels: number[];
  onSelect: (levelId: number) => void;
  onClose: () => void;
}> = ({ levels, currentLevelId, completedLevels, onSelect, onClose }) => {
  const chapters = Array.from(new Set(levels.map((l) => l.chapter)));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[84vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-extrabold text-white">
              نقشه مسیر کمپین ساخت پردازنده ({completedLevels.length} از ۱۴ تکمیل شده)
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chapters.map((ch) => {
            const chLevels = levels.filter((l) => l.chapter === ch);
            return (
              <div key={ch} className="space-y-2">
                <h4 className="text-xs font-extrabold text-cyan-300 px-1">{chLevels[0].chapterTitle}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {chLevels.map((lv) => {
                    const done = completedLevels.includes(lv.id);
                    const active = lv.id === currentLevelId;
                    return (
                      <button
                        key={lv.id}
                        onClick={() => {
                          onSelect(lv.id);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border text-right transition flex items-start justify-between gap-2 ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : done
                              ? 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400 text-slate-100'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-600 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-bold text-slate-400">مرحله {lv.id}</div>
                          <div className="text-xs font-extrabold mt-0.5">{lv.title}</div>
                        </div>
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : active ? (
                          <BookOpen className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const VictoryModal: React.FC<{
  level: LevelDef;
  onNext: () => void;
  onStay: () => void;
}> = ({ level, onNext, onStay }) => (
  <div
    dir="rtl"
    className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
  >
    <div className="w-full max-w-md bg-slate-900 border border-emerald-400/50 rounded-2xl p-6 text-center space-y-4 shadow-2xl shadow-emerald-950/60">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
        <Trophy className="w-8 h-8 text-amber-300" />
      </div>
      <h3 className="text-lg font-extrabold text-white">آفرین! مرحله {level.id} با موفقیت قبول شد!</h3>
      <p className="text-xs text-slate-300 leading-relaxed">{level.lesson.unlocksText}</p>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onStay}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
        >
          ماندن و بررسی مدار
        </button>
        {level.id < 14 && (
          <button
            onClick={onNext}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-xs font-extrabold"
          >
            مرحله بعدی ←
          </button>
        )}
      </div>
    </div>
  </div>
);
