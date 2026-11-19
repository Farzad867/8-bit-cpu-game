import React, { useMemo, useRef, useState } from 'react';
import { Eye, Trash2, Zap } from 'lucide-react';
import { BitWidth, CircuitGraph, CircuitNode, ComponentType, PinDef, Signal, SimState, Wire } from '../types';
import { CATEGORY_META, COMPONENT_DEFS, getNodeHeight, getNodePins, getPinOffset } from '../engine/components';
import { toBin } from '../engine/assembler';
import { sound } from '../utils/sound';

interface CanvasBoardProps {
  circuit: CircuitGraph;
  simState: SimState;
  showBusValues: boolean;
  clockSpeedMs: number;
  readOnly?: boolean;
  allowWireToggle?: boolean;
  onChangeCircuit?: (next: CircuitGraph, pushUndo?: boolean) => void;
  onPeekInside?: (node: CircuitNode) => void;
  onToast?: (msg: string, kind?: 'info' | 'error' | 'success') => void;
  onDropPaletteType?: (type: ComponentType, x: number, y: number) => void;
}

interface PendingWire {
  fromNodeId: string;
  fromPinId: string;
  width: BitWidth;
  x1: number;
  y1: number;
  mx: number;
  my: number;
}

interface TooltipInfo {
  title: string;
  subtitle?: string;
  desc: string;
  liveText?: string;
  x: number;
  y: number;
}

const GRID = 16;
const snap = (v: number) => Math.round(v / GRID) * GRID;

export const CanvasBoard: React.FC<CanvasBoardProps> = ({
  circuit,
  simState,
  showBusValues,
  clockSpeedMs,
  readOnly = false,
  allowWireToggle = false,
  onChangeCircuit,
  onPeekInside,
  onToast,
  onDropPaletteType,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 24, y: 20 });
  const [zoom, setZoom] = useState(0.92);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingWire, setPendingWire] = useState<PendingWire | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const clientToBoard = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const getPinAbsPos = (node: CircuitNode, pinId: string, side: 'left' | 'right') => {
    const off = getPinOffset(node, pinId, side);
    return { x: node.x + off.dx, y: node.y + off.dy };
  };

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.target === e.currentTarget)) {
      setSelectedNodeId(null);
      setPendingWire(null);
      setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
    }
  };

  const handleBoardMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      setPan({
        x: panning.origX + (e.clientX - panning.startX),
        y: panning.origY + (e.clientY - panning.startY),
      });
      return;
    }
    if (draggingNode && !readOnly && onChangeCircuit) {
      const dx = (e.clientX - draggingNode.startClientX) / zoom;
      const dy = (e.clientY - draggingNode.startClientY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setDraggingNode((prev) => (prev ? { ...prev, moved: true } : null));
      }
      const nx = snap(draggingNode.origX + dx);
      const ny = snap(draggingNode.origY + dy);
      onChangeCircuit(
        {
          ...circuit,
          nodes: circuit.nodes.map((n) => (n.id === draggingNode.id ? { ...n, x: nx, y: ny } : n)),
        },
        false
      );
      return;
    }
    if (pendingWire) {
      const pt = clientToBoard(e.clientX, e.clientY);
      setPendingWire((prev) => (prev ? { ...prev, mx: pt.x, my: pt.y } : null));
    }
  };

  const handleBoardMouseUp = () => {
    if (draggingNode?.moved) {
      sound.snap();
    }
    setPanning(null);
    setDraggingNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((z) => Math.max(0.42, Math.min(1.85, Number((z * factor).toFixed(3)))));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly || !onDropPaletteType) return;
    const type = e.dataTransfer.getData('application/lego-component') as ComponentType;
    if (!type || !COMPONENT_DEFS[type]) return;
    const pt = clientToBoard(e.clientX, e.clientY);
    onDropPaletteType(type, snap(pt.x - 50), snap(pt.y - 30));
  };

  const startWireFromOutput = (e: React.MouseEvent, node: CircuitNode, pin: PinDef) => {
    e.stopPropagation();
    if (readOnly) return;
    const pos = getPinAbsPos(node, pin.id, 'right');
    setPendingWire({
      fromNodeId: node.id,
      fromPinId: pin.id,
      width: pin.width,
      x1: pos.x,
      y1: pos.y,
      mx: pos.x,
      my: pos.y,
    });
  };

  const finishWireAtInput = (e: React.MouseEvent, node: CircuitNode, pin: PinDef) => {
    e.stopPropagation();
    if (readOnly || !onChangeCircuit) return;
    if (!pendingWire) {
      // Allow disconnecting existing wire on input pin click if no wire pending
      const existing = circuit.wires.find((w) => w.toNodeId === node.id && w.toPinId === pin.id);
      if (existing) {
        onChangeCircuit(
          { ...circuit, wires: circuit.wires.filter((w) => w.id !== existing.id) },
          true
        );
        sound.toggle(false);
      }
      return;
    }

    if (pendingWire.fromNodeId === node.id && node.type !== 'DFF') {
      // Allow self-loop only if valid, otherwise warn if connecting output directly to same combinational gate
    }

    if (pendingWire.width !== pin.width) {
      sound.error();
      onToast?.(
        `عرض سیم سازگار نیست! سیم مبدا ${pendingWire.width} بیتی است اما پایه مقصد ${pin.width} بیتی است. از جداکننده (Splitter) یا ادغام‌کننده (Merger) استفاده کن.`,
        'error'
      );
      setPendingWire(null);
      return;
    }

    const dup = circuit.wires.some(
      (w) =>
        w.fromNodeId === pendingWire.fromNodeId &&
        w.fromPinId === pendingWire.fromPinId &&
        w.toNodeId === node.id &&
        w.toPinId === pin.id
    );
    if (!dup) {
      // Replace any previous single driver on this input pin cleanly
      const filtered = circuit.wires.filter((w) => !(w.toNodeId === node.id && w.toPinId === pin.id));
      const newWire: Wire = {
        id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromNodeId: pendingWire.fromNodeId,
        fromPinId: pendingWire.fromPinId,
        toNodeId: node.id,
        toPinId: pin.id,
      };
      onChangeCircuit({ ...circuit, wires: [...filtered, newWire] }, true);
      sound.wire();
    }
    setPendingWire(null);
  };

  const deleteWire = (wireId: string) => {
    if ((readOnly && !allowWireToggle) || !onChangeCircuit) return;
    onChangeCircuit({ ...circuit, wires: circuit.wires.filter((w) => w.id !== wireId) }, true);
    sound.toggle(false);
  };

  const deleteNode = (nodeId: string) => {
    if (readOnly || !onChangeCircuit) return;
    const node = circuit.nodes.find((n) => n.id === nodeId);
    if (!node || node.locked) {
      onToast?.('این قطعه جزو پایه‌های ثابت این مرحله است و قابل حذف نیست.', 'info');
      return;
    }
    onChangeCircuit(
      {
        nodes: circuit.nodes.filter((n) => n.id !== nodeId),
        wires: circuit.wires.filter((w) => w.fromNodeId !== nodeId && w.toNodeId !== nodeId),
      },
      true
    );
    setSelectedNodeId(null);
    sound.toggle(false);
  };

  const updateNodeValue = (nodeId: string, nextVal: number) => {
    if (readOnly || !onChangeCircuit) return;
    onChangeCircuit(
      {
        ...circuit,
        nodes: circuit.nodes.map((n) => (n.id === nodeId ? { ...n, value: nextVal } : n)),
      },
      false
    );
  };

  const pulseDurationSec = useMemo(() => {
    const s = Math.max(0.25, Math.min(2.2, clockSpeedMs / 350));
    return `${s.toFixed(2)}s`;
  }, [clockSpeedMs]);

  const formatSignalLive = (sig?: Signal) => {
    if (!sig) return '0';
    if (sig.floating) return 'Z (شناور / بدون سیم)';
    if (sig.width === 1) return sig.value ? '1 (روشن ⚡)' : '0 (خاموش)';
    return `${sig.value} (باینری: ${toBin(sig.value, sig.width)})`;
  };

  const renderBezier = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(42, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="relative w-full h-full overflow-hidden pcb-grid select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleBoardMouseDown}
      onMouseMove={handleBoardMouseMove}
      onMouseUp={handleBoardMouseUp}
      onWheel={handleWheel}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault();
        setPendingWire(null);
      }}
    >
      {/* Zoom & Pan helper controls */}
      <div
        dir="rtl"
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/70 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur"
      >
        <button
          onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.12).toFixed(2)))}
          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
          title="بزرگ‌نمایی"
        >
          +
        </button>
        <span className="font-mono text-[11px] w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.max(0.45, +(z - 0.12).toFixed(2)))}
          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
          title="کوچک‌نمایی"
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(0.92);
            setPan({ x: 24, y: 20 });
          }}
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 mr-1"
        >
          تنظیم دید
        </button>
      </div>

      {/* World transform layer */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* SVG Wires Layer */}
        <svg className="overflow-visible absolute top-0 left-0 w-1 h-1 pointer-events-none" style={{ zIndex: 5 }}>
          {circuit.wires.map((wire) => {
            const fromNode = circuit.nodes.find((n) => n.id === wire.fromNodeId);
            const toNode = circuit.nodes.find((n) => n.id === wire.toNodeId);
            if (!fromNode || !toNode) return null;
            const p1 = getPinAbsPos(fromNode, wire.fromPinId, 'right');
            const p2 = getPinAbsPos(toNode, wire.toPinId, 'left');
            const sig = simState.nodeOutputs[wire.fromNodeId]?.[wire.fromPinId];
            const width = sig?.width ?? 1;
            const val = sig?.value ?? 0;
            const active = val > 0;
            const d = renderBezier(p1.x, p1.y, p2.x, p2.y);

            const colorActive = width === 8 ? '#fbbf24' : width === 4 ? '#f472b6' : '#22d3ee';
            const colorIdle = width > 1 ? '#475569' : '#334155';
            const strokeW = width === 8 ? 4.5 : width === 4 ? 3.6 : 2.6;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g key={wire.id} className="pointer-events-auto group">
                {/* Invisible wider hit target for deleting/hovering */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className={readOnly && !allowWireToggle ? 'cursor-default' : 'cursor-pointer'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!readOnly || allowWireToggle) deleteWire(wire.id);
                  }}
                  onMouseEnter={(e) =>
                    setTooltip({
                      title: width > 1 ? `گذرگاه ${width} بیتی` : 'سیم ۱ بیتی',
                      desc:
                        !readOnly || allowWireToggle
                          ? 'برای قطع کردن این سیم روی آن کلیک کن.'
                          : 'جریان زنده سیگنال در زیرمدار.',
                      liveText: formatSignalLive(sig),
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
                {/* Neon Glow Halo */}
                {active && (
                  <path
                    d={d}
                    fill="none"
                    stroke={colorActive}
                    strokeWidth={strokeW + 5}
                    opacity={0.28}
                    strokeLinecap="round"
                  />
                )}
                {/* Main Wire Stroke */}
                <path
                  d={d}
                  fill="none"
                  stroke={active ? colorActive : colorIdle}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  className="transition-colors duration-100 group-hover:stroke-rose-400"
                />
                {/* Animated Electric Pulse */}
                {active && (
                  <path
                    d={d}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={Math.max(1.6, strokeW - 1.5)}
                    strokeDasharray="5 19"
                    strokeLinecap="round"
                    className="wire-pulse"
                    style={{ animationDuration: pulseDurationSec }}
                  />
                )}
                {/* Bus Live Value Pill */}
                {showBusValues && width > 1 && (
                  <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                    <rect
                      x={width === 8 ? -38 : -24}
                      y={-10}
                      width={width === 8 ? 76 : 48}
                      height={19}
                      rx={6}
                      fill="#0f172a"
                      fillOpacity={0.92}
                      stroke={active ? colorActive : '#475569'}
                      strokeWidth={1}
                    />
                    <text
                      textAnchor="middle"
                      y={3}
                      fill={active ? colorActive : '#94a3b8'}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                    >
                      {width === 8 ? `${val}|${toBin(val, 8).slice(4)}` : toBin(val, 4)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Pending Wire being drawn */}
          {pendingWire && (
            <path
              d={renderBezier(pendingWire.x1, pendingWire.y1, pendingWire.mx, pendingWire.my)}
              fill="none"
              stroke={pendingWire.width === 8 ? '#fbbf24' : pendingWire.width === 4 ? '#f472b6' : '#38bdf8'}
              strokeWidth={pendingWire.width > 1 ? 4 : 2.5}
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Lego Blocks Layer */}
        {circuit.nodes.map((node) => {
          const def = COMPONENT_DEFS[node.type];
          const cat = CATEGORY_META[def.category];
          const h = getNodeHeight(node);
          const { inputs, outputs } = getNodePins(node);
          const isSelected = selectedNodeId === node.id;

          // Live display helpers
          const switchOn = node.type === 'SWITCH_1' && Boolean(node.value);
          const ledOn =
            node.type === 'LED_1' && (simState.nodeInputs[node.id]?.['IN']?.value ?? 0) === 1;
          const disp8Val =
            node.type === 'DISPLAY_8'
              ? simState.nodeInputs[node.id]?.['IN']?.value ?? 0
              : node.type === 'OUT_DISPLAY'
                ? simState.outDisplays[node.id]?.latched ?? 0
                : node.type === 'REG_8'
                  ? simState.nodeOutputs[node.id]?.['Q']?.value ?? 0
                  : node.type === 'PC_8'
                    ? simState.nodeOutputs[node.id]?.['ADDR']?.value ?? 0
                    : node.type === 'ALU_8'
                      ? simState.nodeOutputs[node.id]?.['RES']?.value ?? 0
                      : node.type === 'ROM_16'
                        ? simState.nodeOutputs[node.id]?.['OP']?.value ?? 0
                        : null;

          const studCount = Math.max(2, Math.floor(def.width / 34));

          return (
            <div
              key={node.id}
              style={{
                left: node.x,
                top: node.y,
                width: def.width,
                height: h,
                zIndex: isSelected ? 15 : 10,
              }}
              className={`absolute pointer-events-auto rounded-xl border-2 bg-gradient-to-b ${cat.bg} ${
                isSelected ? 'border-cyan-300 ring-2 ring-cyan-400/40' : cat.border
              } shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-shadow`}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedNodeId(node.id);
                if (!readOnly) {
                  setDraggingNode({
                    id: node.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origX: node.x,
                    origY: node.y,
                    moved: false,
                  });
                }
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  title: node.label || def.faName,
                  subtitle: def.enName,
                  desc: def.description,
                  liveText:
                    disp8Val !== null
                      ? `${disp8Val} (باینری: ${toBin(disp8Val, node.type === 'ROM_16' ? 4 : 8)})`
                      : node.type === 'SWITCH_1'
                        ? switchOn
                          ? '1 (روشن)'
                          : '0 (خاموش)'
                        : undefined,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Tactile 3D Lego Studs along top rim */}
              <div className="absolute -top-2 left-3 right-3 flex justify-around pointer-events-none">
                {Array.from({ length: studCount }).map((_, idx) => (
                  <span key={idx} className={`w-4 h-2 rounded-t-sm ${cat.stud} lego-stud`} />
                ))}
              </div>

              {/* Header */}
              <div
                dir="rtl"
                className="flex items-center justify-between px-2 pt-1.5 pb-1 border-b border-white/10 gap-1"
              >
                <div className="truncate text-[10.5px] font-bold text-slate-100 leading-tight">
                  {node.label || def.faName}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {def.encapsulated && onPeekInside && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPeekInside(node);
                      }}
                      className="p-0.5 rounded bg-cyan-500/20 hover:bg-cyan-400/40 text-cyan-200 transition"
                      title="مشاهده داخل قطعه (Peek Inside)"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  )}
                  {!readOnly && !node.locked && isSelected && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                      className="p-0.5 rounded bg-rose-500/25 hover:bg-rose-500/50 text-rose-200"
                      title="حذف قطعه"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Body Content */}
              <div className="flex flex-col items-center justify-center px-2 pt-1 gap-1">
                {/* 1-bit Switch */}
                {node.type === 'SWITCH_1' && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = node.value ? 0 : 1;
                      updateNodeValue(node.id, next);
                      sound.toggle(next === 1);
                    }}
                    className={`mt-1 w-14 h-6 rounded-full border flex items-center px-1 transition-all ${
                      switchOn
                        ? 'bg-emerald-500/35 border-emerald-300 justify-end shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                        : 'bg-slate-800 border-slate-600 justify-start'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center ${
                        switchOn ? 'bg-emerald-300 text-slate-950' : 'bg-slate-500 text-slate-950'
                      }`}
                    >
                      {switchOn ? '1' : '0'}
                    </span>
                  </button>
                )}

                {/* 1-bit LED */}
                {node.type === 'LED_1' && (
                  <div
                    className={`mt-1 w-7 h-7 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      ledOn
                        ? 'bg-amber-300 border-amber-100 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.9)]'
                        : 'bg-slate-800 border-slate-600 text-slate-500'
                    }`}
                  >
                    {ledOn ? '1' : '0'}
                  </div>
                )}

                {/* 4-bit or 8-bit interactive input */}
                {(node.type === 'INPUT_4' || node.type === 'INPUT_8' || node.type === 'CONST_8') && (
                  <div
                    className="flex flex-col items-center gap-1 mt-0.5"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={node.type === 'INPUT_4' ? 15 : 255}
                        value={node.value ?? 0}
                        disabled={readOnly}
                        onChange={(e) => {
                          const max = node.type === 'INPUT_4' ? 15 : 255;
                          const v = Math.max(0, Math.min(max, parseInt(e.target.value || '0', 10) || 0));
                          updateNodeValue(node.id, v);
                        }}
                        className="w-14 bg-slate-950/90 border border-emerald-500/50 rounded px-1 py-0.5 text-center font-mono text-xs text-emerald-300 font-bold"
                      />
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: node.type === 'INPUT_4' ? 4 : 8 }).map((_, idx, arr) => {
                        const bitIdx = arr.length - 1 - idx;
                        const bitOn = (((node.value ?? 0) >> bitIdx) & 1) === 1;
                        return (
                          <button
                            key={bitIdx}
                            type="button"
                            disabled={readOnly}
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = (node.value ?? 0) ^ (1 << bitIdx);
                              updateNodeValue(node.id, next);
                              sound.toggle(!bitOn);
                            }}
                            className={`w-3.5 h-3.5 rounded-sm font-mono text-[8px] font-bold flex items-center justify-center transition ${
                              bitOn
                                ? 'bg-amber-400 text-slate-950 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {bitOn ? '1' : '0'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Live 8-bit Display / Register / PC / ALU / OUT_DISPLAY Readout */}
                {(node.type === 'DISPLAY_8' ||
                  node.type === 'OUT_DISPLAY' ||
                  node.type === 'REG_8' ||
                  node.type === 'PC_8' ||
                  node.type === 'ALU_8') &&
                  disp8Val !== null && (
                    <div className="flex flex-col items-center gap-0.5 mt-0.5 pointer-events-none">
                      <span
                        className={`font-mono text-base font-extrabold leading-none ${
                          node.type === 'OUT_DISPLAY'
                            ? 'text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]'
                            : 'text-amber-300'
                        }`}
                      >
                        {disp8Val}
                      </span>
                      <div className="flex gap-0.5">
                        {toBin(disp8Val, 8)
                          .split('')
                          .map((b, i) => (
                            <span
                              key={i}
                              className={`w-2.5 h-2.5 rounded-full ${
                                b === '1'
                                  ? 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.9)]'
                                  : 'bg-slate-800 border border-slate-700'
                              }`}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                {/* Clock indicator */}
                {node.type === 'CLOCK' && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] font-mono">
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        simState.halted
                          ? 'text-rose-400'
                          : simState.clockHigh
                            ? 'text-cyan-300 animate-pulse'
                            : 'text-violet-300'
                      }`}
                    />
                    <span className={simState.halted ? 'text-rose-300 font-bold' : 'text-violet-200'}>
                      {simState.halted ? 'HALT' : simState.clockHigh ? 'HIGH' : 'READY'}
                    </span>
                  </div>
                )}

                {/* ROM Live Readout */}
                {node.type === 'ROM_16' && (
                  <div className="text-[10px] font-mono text-rose-200 text-center mt-0.5 pointer-events-none">
                    <div>ADDR: {simState.nodeInputs[node.id]?.['ADDR']?.value ?? 0}</div>
                    <div className="text-amber-300 font-bold">
                      OP:{toBin(simState.nodeOutputs[node.id]?.['OP']?.value ?? 0, 4)}
                    </div>
                  </div>
                )}

                {/* DFF / DFF_EN 1-bit live Q badge */}
                {(node.type === 'DFF' || node.type === 'DFF_EN') && (
                  <div className="mt-1 px-2 py-0.5 rounded bg-slate-950/80 border border-violet-400/40 font-mono text-[11px] font-bold text-violet-200 pointer-events-none">
                    Q = {simState.nodeOutputs[node.id]?.['Q']?.value ?? 0}
                  </div>
                )}

                {/* English code subtitle for gates & chips */}
                {![
                  'SWITCH_1',
                  'LED_1',
                  'INPUT_4',
                  'INPUT_8',
                  'CONST_8',
                  'DISPLAY_8',
                  'OUT_DISPLAY',
                  'REG_8',
                  'PC_8',
                  'ALU_8',
                  'CLOCK',
                  'ROM_16',
                  'DFF',
                  'DFF_EN',
                ].includes(node.type) && (
                  <span className="text-[9.5px] font-mono text-slate-400 mt-1 pointer-events-none">
                    {def.enName}
                  </span>
                )}
              </div>

              {/* Input Pins (Left side) */}
              {inputs.map((pin) => {
                const off = getPinOffset(node, pin.id, 'left');
                const sig = simState.nodeInputs[node.id]?.[pin.id];
                const high = (sig?.value ?? 0) > 0;
                const isBus = pin.width > 1;
                return (
                  <div
                    key={pin.id}
                    style={{ top: off.dy - 7, left: -7 }}
                    className="absolute flex items-center gap-1"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => finishWireAtInput(e, node, pin)}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setTooltip({
                        title: `پایه ورودی ${pin.label} (${pin.width} بیتی)`,
                        desc: pin.tooltip,
                        liveText: formatSignalLive(sig),
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 cursor-crosshair transition-transform hover:scale-125 ${
                        high
                          ? isBus
                            ? 'bg-amber-400 border-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                            : 'bg-cyan-400 border-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.9)]'
                          : isBus
                            ? 'bg-slate-800 border-amber-400/70'
                            : 'bg-slate-800 border-slate-400'
                      }`}
                    />
                    <span className="text-[9px] font-mono text-slate-300 pointer-events-none bg-slate-950/60 px-0.5 rounded">
                      {pin.label}
                    </span>
                  </div>
                );
              })}

              {/* Output Pins (Right side) */}
              {outputs.map((pin) => {
                const off = getPinOffset(node, pin.id, 'right');
                const sig = simState.nodeOutputs[node.id]?.[pin.id];
                const high = (sig?.value ?? 0) > 0;
                const isBus = pin.width > 1;
                return (
                  <div
                    key={pin.id}
                    style={{ top: off.dy - 7, right: -7 }}
                    className="absolute flex items-center flex-row-reverse gap-1"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => startWireFromOutput(e, node, pin)}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setTooltip({
                        title: `پایه خروجی ${pin.label} (${pin.width} بیتی)`,
                        desc: pin.tooltip + (readOnly ? '' : ' — برای کشیدن سیم کلیک کن!'),
                        liveText: formatSignalLive(sig),
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 cursor-crosshair transition-transform hover:scale-125 ${
                        high
                          ? isBus
                            ? 'bg-amber-400 border-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                            : 'bg-cyan-400 border-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.9)]'
                          : isBus
                            ? 'bg-slate-800 border-amber-400/70'
                            : 'bg-slate-800 border-cyan-400/80'
                      }`}
                    />
                    <span className="text-[9px] font-mono text-slate-300 pointer-events-none bg-slate-950/60 px-0.5 rounded">
                      {pin.label}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Interactive Persian Pin & Block Inspector Tooltip */}
      {tooltip && (
        <div
          dir="rtl"
          style={{
            left: Math.min(window.innerWidth - 290, tooltip.x + 14),
            top: Math.max(12, tooltip.y - 84),
          }}
          className="fixed z-50 w-64 pointer-events-none bg-slate-900/95 border border-cyan-400/40 rounded-xl p-2.5 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-cyan-200">{tooltip.title}</span>
            {tooltip.subtitle && (
              <span className="text-[10px] font-mono text-slate-400">{tooltip.subtitle}</span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{tooltip.desc}</p>
          {tooltip.liveText && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-700/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">مقدار زنده:</span>
              <span className="font-mono font-bold text-amber-300" dir="ltr">
                {tooltip.liveText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
