import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { RowingFrame } from "../types/rowing";
import type { StrokeSegment } from "../types/strokeDetect";

export type GraphMode = "acceleration" | "gyro" | "speed";

type Props = {
  frames: RowingFrame[];
  currentIndex: number;
  mode: GraphMode;
  /** 検出済みストロークセグメント一覧（解析モード時に使用） */
  strokes?: StrokeSegment[];
  /** 解析モード有効時に位相帯・凡例を表示する */
  analysisMode?: boolean;
};

type CanvasBox = {
  width: number;
  height: number;
};

type CanvasSize = {
  w: number;
  h: number;
};

type TimeSeriesPoint = {
  time: number;
  accx: number | null;
  gyrox: number | null;
  gyroy: number | null;
  gyroz: number | null;
  speed: number | null;
};

const TIME_AXIS_FALLBACK_HZ = 60;

const Y_DOMAINS: Record<GraphMode, [number, number]> = {
  acceleration: [-5, 10],
  speed: [0, 5],
  gyro: [-15, 20],
};

const LINE_COLORS = {
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  grid: "#e2e8f0",
  axis: "#64748b",
  text: "#0f172a",
  label: "#475569",
} as const;

const PADDING = {
  left: 64,
  right: 24,
  top: 18,
  bottom: 44,
} as const;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

function buildTimeSeriesData(frames: RowingFrame[], mode: GraphMode) {
  let startMs: number | null = null;
  const points = frames.map((frame, index) => {
    const rawTime = frame.time_s ?? frame.time;
    let time = index / TIME_AXIS_FALLBACK_HZ;
    if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
      time = rawTime;
    } else if (typeof rawTime === "string") {
      const parsedMs = Date.parse(rawTime);
      if (!Number.isNaN(parsedMs)) {
        if (startMs === null) startMs = parsedMs;
        time = (parsedMs - startMs) / 1000;
      }
    }
    return {
      time,
      accx: toNumber(frame.accx),
      gyrox: toNumber(frame.gyrox),
      gyroy: toNumber(frame.gyroy),
      gyroz: toNumber(frame.gyroz),
      speed: toNumber(frame.speed),
    };
  });
  return { points, yDomain: Y_DOMAINS[mode] };
}

const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { align?: CanvasTextAlign; baseline?: CanvasTextBaseline; size?: number; color?: string; bold?: boolean } = {},
) => {
  ctx.save();
  ctx.fillStyle = options.color ?? LINE_COLORS.text;
  const weight = options.bold ? "bold " : "";
  ctx.font = `${weight}${options.size ?? 12}px Arial, sans-serif`;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
};

const resizeCanvas = (canvas: HTMLCanvasElement, box: CanvasBox, canvasSize: RefObject<CanvasSize>) => {
  const nextWidth = Math.max(1, Math.round(box.width));
  const nextHeight = Math.max(1, Math.round(box.height));
  if (canvasSize.current.w === nextWidth && canvasSize.current.h === nextHeight) {
    return false;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(nextWidth * dpr));
  canvas.height = Math.max(1, Math.round(nextHeight * dpr));
  canvas.style.width = `${nextWidth}px`;
  canvas.style.height = `${nextHeight}px`;
  canvasSize.current = { w: nextWidth, h: nextHeight };
  return true;
};

const measureCanvasBox = (wrapper: HTMLDivElement): CanvasBox | null => {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
};

const resolveCanvasBox = (wrapper: HTMLDivElement, canvasSize: RefObject<CanvasSize>): CanvasBox | null => {
  const { w, h } = canvasSize.current;
  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }

  return measureCanvasBox(wrapper);
};

const getModeSeries = (point: TimeSeriesPoint, mode: GraphMode) => {
  if (mode === "acceleration") {
    return [{ key: "accx", value: point.accx, color: LINE_COLORS.blue, label: "accx" }];
  }
  if (mode === "gyro") {
    return [
      { key: "gyrox", value: point.gyrox, color: LINE_COLORS.blue, label: "gyrox" },
      { key: "gyroy", value: point.gyroy, color: LINE_COLORS.green, label: "gyroy" },
      { key: "gyroz", value: point.gyroz, color: LINE_COLORS.red, label: "gyroz" },
    ];
  }
  return [{ key: "speed", value: point.speed, color: LINE_COLORS.blue, label: "speed" }];
};

const getUnit = (mode: GraphMode): string => {
  if (mode === "acceleration") return " m/s²";
  if (mode === "gyro") return " deg/s";
  return " m/s";
};

const drawPolyline = (
  ctx: CanvasRenderingContext2D,
  points: TimeSeriesPoint[],
  mode: GraphMode,
  worldToCanvas: (time: number, value: number) => { x: number; y: number },
) => {
  const series = getModeSeries(points[0], mode);
  series.forEach((item) => {
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let started = false;
    points.forEach((point) => {
      const rawValue = point[item.key as keyof TimeSeriesPoint];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        started = false;
        return;
      }
      const { x, y } = worldToCanvas(point.time, rawValue);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
        return;
      }
      ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  });
};

// 位相色定義
const PHASE_COLORS: Record<string, string> = {
  catch: 'rgba(59,130,246,0.12)',
  drive: 'rgba(34,197,94,0.12)',
  finish: 'rgba(249,115,22,0.12)',
  recovery: 'rgba(148,163,184,0.10)',
};

const PHASE_LABELS: Record<string, string> = {
  catch: 'キャッチ',
  drive: 'ドライブ',
  finish: 'フィニッシュ',
  recovery: 'リカバリー',
};

const PHASE_BORDER_COLORS: Record<string, string> = {
  catch: 'rgba(59,130,246,0.35)',
  drive: 'rgba(34,197,94,0.35)',
  finish: 'rgba(249,115,22,0.35)',
  recovery: 'rgba(148,163,184,0.30)',
};

const drawTimeSeriesCanvas = (
  canvas: HTMLCanvasElement,
  box: CanvasBox,
  points: TimeSeriesPoint[],
  currentIndex: number,
  mode: GraphMode,
  yDomain: [number, number],
  strokes: StrokeSegment[] = [],
  analysisMode: boolean = false,
) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, box.width, box.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, box.width, box.height);

  const plotWidth = Math.max(1, box.width - PADDING.left - PADDING.right);
  const plotHeight = Math.max(1, box.height - PADDING.top - PADDING.bottom);

  const minTime = points[0]?.time ?? 0;
  const maxTime = points[points.length - 1]?.time ?? 0;
  const timeSpan = maxTime - minTime || 1;
  const ySpan = yDomain[1] - yDomain[0] || 1;

  const worldToCanvas = (time: number, value: number) => ({
    x: PADDING.left + ((time - minTime) / timeSpan) * plotWidth,
    y: PADDING.top + ((yDomain[1] - value) / ySpan) * plotHeight,
  });

  const timeTickCount = 5;
  const yTickCount = 5;

  ctx.save();
  ctx.strokeStyle = LINE_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let i = 0; i <= timeTickCount; i += 1) {
    const value = minTime + (timeSpan * i) / timeTickCount;
    const { x } = worldToCanvas(value, yDomain[0]);
    ctx.beginPath();
    ctx.moveTo(x, PADDING.top);
    ctx.lineTo(x, box.height - PADDING.bottom);
    ctx.stroke();
    drawText(ctx, value.toFixed(1), x, box.height - PADDING.bottom + 18, {
      align: "center",
      baseline: "top",
      size: 18,
      bold: true,
      color: "#374151",
    });
  }

  for (let i = 0; i <= yTickCount; i += 1) {
    const value = yDomain[0] + (ySpan * i) / yTickCount;
    const { y: py } = worldToCanvas(minTime, value);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, py);
    ctx.lineTo(box.width - PADDING.right, py);
    ctx.stroke();
    drawText(ctx, value.toFixed(1), PADDING.left - 8, py, {
      align: "right",
      baseline: "middle",
      size: 18,
      bold: true,
      color: "#374151",
    });
  }

  ctx.setLineDash([]);
  ctx.restore();

  // 位相帯描画（解析モード時のみ） ← グリッドの直後、軸線・折れ線より前に描画して解析要素を下層に置く
  if (analysisMode && strokes.length > 0) {
    strokes.forEach((stroke) => {
      stroke.phases.forEach((seg) => {
        const startPt = points[Math.min(seg.startFrame, points.length - 1)];
        const endPt = points[Math.min(seg.endFrame, points.length - 1)];
        if (!startPt || !endPt) return;

        const x1 = PADDING.left + ((startPt.time - minTime) / timeSpan) * plotWidth;
        const x2 = PADDING.left + ((endPt.time - minTime) / timeSpan) * plotWidth;
        const bandWidth = Math.max(1, x2 - x1);

        ctx.save();
        ctx.fillStyle = PHASE_COLORS[seg.phase] ?? 'rgba(128,128,128,0.08)';
        ctx.fillRect(x1, PADDING.top, bandWidth, plotHeight);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = PHASE_BORDER_COLORS[seg.phase] ?? 'rgba(128,128,128,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, PADDING.top);
        ctx.lineTo(x1, PADDING.top + plotHeight);
        ctx.stroke();
        ctx.restore();
      });
    });
  }

  ctx.save();
  ctx.strokeStyle = LINE_COLORS.axis;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(PADDING.left, PADDING.top);
  ctx.lineTo(PADDING.left, box.height - PADDING.bottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(PADDING.left, box.height - PADDING.bottom);
  ctx.lineTo(box.width - PADDING.right, box.height - PADDING.bottom);
  ctx.stroke();
  ctx.restore();

  drawPolyline(ctx, points, mode, worldToCanvas);

  // 位相帯描画（解析モード時のみ、折れ線の下層に描画） ← 展開済みの重複ブロックは削除

  const safeIndex = Math.max(0, Math.min(currentIndex, points.length - 1));
  const currentPoint = points[safeIndex];
  if (currentPoint) {
    const { x: cursorX } = worldToCanvas(currentPoint.time, yDomain[0]);
    ctx.save();
    ctx.strokeStyle = LINE_COLORS.red;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, PADDING.top);
    ctx.lineTo(cursorX, box.height - PADDING.bottom);
    ctx.stroke();
    ctx.restore();

    const series = getModeSeries(currentPoint, mode);
    series.forEach((item) => {
      const val = currentPoint[item.key as keyof TimeSeriesPoint];
      if (typeof val === "number" && Number.isFinite(val)) {
        const { x, y } = worldToCanvas(currentPoint.time, val);
        ctx.save();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const isNearRight = x > box.width - PADDING.right - 100;
        const textX = isNearRight ? x - 10 : x + 10;
        const textY = y - 10;
        const textAlign = isNearRight ? "right" : "left";
        const tagText = `${val.toFixed(1)}${getUnit(mode)}`;

        drawText(ctx, tagText, textX, textY, {
          align: textAlign,
          baseline: "bottom",
          size: 24,
          bold: true,
          color: item.color,
        });
      }
    });
  }

  if (mode === "gyro") {
    const legend = [
      { label: "gyrox", color: LINE_COLORS.blue },
      { label: "gyroy", color: LINE_COLORS.green },
      { label: "gyroz", color: LINE_COLORS.red },
    ];
    const startX = box.width - PADDING.right - 84;
    let legendY = PADDING.top + 12;
    legend.forEach((item) => {
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.fillRect(startX, legendY - 7, 10, 10);
      ctx.restore();
      drawText(ctx, item.label, startX + 18, legendY, {
        align: "left",
        baseline: "middle",
        size: 14,
        bold: true,
        color: LINE_COLORS.text,
      });
      legendY += 20;
    });
  }

  // 位相凡例（解析モード時のみ、右上に小さく表示）
  if (analysisMode && strokes.length > 0) {
    const phaseOrder: Array<keyof typeof PHASE_COLORS> = ['catch', 'drive', 'finish', 'recovery'];
    const legendItemH = 18;
    const legendPadX = 10;
    const legendPadY = 6;
    // gyro 凡例の下に配置するため、gyro モードのときは少し下にずらす
    const baseY = mode === 'gyro' ? PADDING.top + 80 : PADDING.top + 12;

    phaseOrder.forEach((phase, idx) => {
      const iy = baseY + idx * legendItemH + legendPadY;
      const ix = box.width - PADDING.right - 96 - legendPadX;

      // 色帯プレビュー
      ctx.save();
      ctx.fillStyle = PHASE_COLORS[phase] ?? 'rgba(128,128,128,0.12)';
      ctx.strokeStyle = PHASE_BORDER_COLORS[phase] ?? 'rgba(128,128,128,0.3)';
      ctx.lineWidth = 1;
      ctx.fillRect(ix, iy - 7, 14, 12);
      ctx.strokeRect(ix, iy - 7, 14, 12);
      ctx.restore();

      drawText(ctx, PHASE_LABELS[phase] ?? phase, ix + 18, iy, {
        align: 'left',
        baseline: 'middle',
        size: 12,
        bold: false,
        color: LINE_COLORS.label,
      });
    });
  }

  drawText(ctx, "Time (s)", PADDING.left + plotWidth / 2, box.height - 6, {
    align: "center",
    baseline: "bottom",
    size: 14,
    bold: true,
    color: LINE_COLORS.text,
  });
};

export default function TimeSeriesChart({ frames, currentIndex, mode, strokes = [], analysisMode = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasSizeRef = useRef<CanvasSize>({ w: 0, h: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const { points, yDomain } = useMemo(() => buildTimeSeriesData(frames, mode), [frames, mode]);

  const safeIndex = Math.max(0, Math.min(currentIndex, points.length - 1));
  const latestRenderStateRef = useRef({
    points,
    safeIndex,
    mode,
    yDomain,
    strokes,
    analysisMode,
  });
  latestRenderStateRef.current = {
    points,
    safeIndex,
    mode,
    yDomain,
    strokes,
    analysisMode,
  };

  const cancelScheduledDraw = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const scheduleDraw = (draw: () => void) => {
    cancelScheduledDraw();
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      draw();
    });
  };

  const drawLatest = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) {
      return;
    }

    const box = resolveCanvasBox(wrapper, canvasSizeRef);
    if (!box) {
      scheduleDraw(drawLatest);
      return;
    }

    const { points: latestPoints, safeIndex: latestSafeIndex, mode: latestMode, yDomain: latestYDomain, strokes: latestStrokes, analysisMode: latestAnalysisMode } = latestRenderStateRef.current;
    resizeCanvas(canvas, box, canvasSizeRef);
    drawTimeSeriesCanvas(canvas, box, latestPoints, latestSafeIndex, latestMode, latestYDomain, latestStrokes, latestAnalysisMode);
  };

  useEffect(() => {
    if (!canvasRef.current || !wrapperRef.current) {
      return;
    }

    drawLatest();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        cancelScheduledDraw();
      };
    }

    const observer = new ResizeObserver(() => {
      drawLatest();
    });
    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
      cancelScheduledDraw();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) {
      return;
    }

    const box = resolveCanvasBox(wrapper, canvasSizeRef);
    if (!box) {
      scheduleDraw(drawLatest);
      return;
    }

    resizeCanvas(canvas, box, canvasSizeRef);
    drawTimeSeriesCanvas(canvas, box, points, safeIndex, mode, yDomain, strokes, analysisMode);
  }, [points, safeIndex, mode, yDomain, strokes, analysisMode]);

  if (frames.length === 0 || points.length === 0) {
    return (
      <div className="panel-empty" style={{ flexDirection: "column", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>時系列グラフ</h3>
        <p style={{ margin: 0, fontSize: "22px" }}>時系列データがありません。</p>
      </div>
    );
  }

  return (
    <>
      <h3 style={{ margin: "0 0 4px", fontSize: "16px", flexShrink: 0 }}>時系列グラフ</h3>
      <div ref={wrapperRef} style={{ width: "100%", flex: 1, minHeight: 0, position: "relative" }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    </>
  );
}
