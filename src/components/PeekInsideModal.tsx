import React, { useState } from 'react';
import { ArrowRight, Cpu, RotateCcw, Wrench, X } from 'lucide-react';
import { CircuitGraph, CircuitNode, SimState } from '../types';
import { COMPONENT_DEFS } from '../engine/components';
import { buildDefaultControlUnitGraph, getSubCircuitBlueprint } from '../engine/subcircuits';
import { createEmptySimState } from '../engine/simulator';
import { CanvasBoard } from './CanvasBoard';

interface PeekFrame {
  node: CircuitNode;
  simState: SimState;
}

interface PeekInsideModalProps {
  rootNode: CircuitNode;
  rootSimState: SimState;
  customControlUnit: CircuitGraph;
  onUpdateControlUnit: (next: CircuitGraph) => void;
  onClose: () => void;
}

export const PeekInsideModal: React.FC<PeekInsideModalProps> = ({
  rootNode,
  rootSimState,
  customControlUnit,
  onUpdateControlUnit,
  onClose,
}) => {
  const [stack, setStack] = useState<PeekFrame[]>([{ node: rootNode, simState: rootSimState }]);
  const current = stack[stack.length - 1];
  const isControlUnit = current.node.type === 'CONTROL_UNIT';
  const blueprint = getSubCircuitBlueprint(current.node.type, customControlUnit);
  const def = COMPONENT_DEFS[current.node.type];

  if (!blueprint) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[82vh] bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {stack.length > 1 && (
              <button
                onClick={() => setStack((prev) => prev.slice(0, -1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-200"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                بازگشت به لایه بالا
              </button>
            )}
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                مشاهده داخل قطعه: {current.node.label || def.faName}{' '}
                <span className="font-mono text-xs text-cyan-300">({def.enName})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isControlUnit
                  ? 'این مدار دقیق واحد کنترل خودت است! می‌توانی همین‌جا روی هر سیمی (مثلاً سیم JZ) کلیک کنی تا قطع شود و ببینی روی پردازنده واقعاً چه اتفاقی می‌افتد!'
                  : 'برق زنده داخل این آی‌سی کپسوله‌شده را می‌بینی. روی آیکون 👁 قطعات داخلی هم می‌توانی کلیک کنی تا عمیق‌تر بروی!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isControlUnit && (
              <button
                onClick={() => onUpdateControlUnit(buildDefaultControlUnitGraph())}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-medium"
                title="بازگردانی سیم‌کشی کامل واحد کنترل"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ترمیم سیم‌کشی سالم
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Hint Banner for Control Unit */}
        {isControlUnit && (
          <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-500/25 text-[11.5px] text-rose-200 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>آزمایش واقعی سخت‌افزار:</strong> روی سیم خروجی گیت <span className="font-mono">AND (شرط پرش JZ)</span> یا سیم <span className="font-mono">OP9</span> کلیک کن تا قطع شود؛ بعد این پنجره را ببند و برنامه شمارش معکوس را اجرا کن — می‌بینی حلقه واقعاً از کار می‌افتد!
            </span>
          </div>
        )}

        {/* Sub-circuit live PCB board */}
        <div className="flex-1 relative">
          <CanvasBoard
            circuit={blueprint}
            simState={current.simState}
            showBusValues={true}
            clockSpeedMs={600}
            readOnly={!isControlUnit}
            allowWireToggle={isControlUnit}
            onChangeCircuit={isControlUnit ? (next) => onUpdateControlUnit(next) : undefined}
            onPeekInside={(innerNode) => {
              const innerSim = current.simState.subStates[innerNode.id] ?? createEmptySimState();
              setStack((prev) => [...prev, { node: innerNode, simState: innerSim }]);
            }}
          />
        </div>
      </div>
    </div>
  );
};
