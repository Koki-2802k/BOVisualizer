import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { RowingFrame } from "../types/rowing";
import { buildOarTrajectory } from "../utils/trajectory";
import { usePlaybackStore } from "../store/playbackStore";

type Props = {
  frames: RowingFrame[];
  currentIndex: number;
};

type OarSide = "right" | "left";

const TRAJECTORY_DOMAIN = {
  x: [-200, 200] as const,
  z: [-90, 20] as const,
};

const COLOR_BY_ANGLE = {
  normal: "#111827",
  ideal: "#dc2626",
  background: "#ffffff",
  grid: "#d7d7d7",
  axis: "#6b7280",
  water: "#2563eb",
  highlight: "#0f172a",
  accent: "#0f766e",
} as const;

const PLOT_PADDING = {
  top: 38,
  right: 24,
  bottom: 40,
  left: 54,
} as const;

const SYMBOL_HALF_LENGTH = 14;
const SYMBOL_STROKE_WIDTH = 2.5;
const HIGHLIGHT_HALF_LENGTH = 20;
const HIGHLIGHT_STROKE_WIDTH = 4;

const isIdealAngle = (angle: number): boolean => {
  const com = Math.abs(Math.trunc(angle)) % 180;
  return com > 40 && com < 140;
};

const formatAngle = (angle: number): string => {
  return `${angle.toFixed(1)}°`;
};

type CanvasBox = {
  width: number;
  height: number;
};

type CanvasSize = {
  w: number;
  h: number;
};

const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { align?: CanvasTextAlign; baseline?: CanvasTextBaseline; size?: number; color?: string; bold?: boolean } = {},
) => {
  ctx.save();
  ctx.fillStyle = options.color ?? "#111827";
  const weight = options.bold ? "bold " : "";
  ctx.font = `${weight}${options.size ?? 12}px Arial, sans-serif`;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
};

const drawArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.strokeStyle = COLOR_BY_ANGLE.accent;
  ctx.fillStyle = COLOR_BY_ANGLE.accent;
  ctx.lineWidth = 4;

  // Shaft (stick): ends at 12 to overlap inside the arrowhead (which starts at 10)
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(12, 0);
  ctx.stroke();

  // Arrowhead (triangle): larger size (tip at 32, back edge at 10, half-width 12)
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(10, -12);
  ctx.lineTo(10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawRotatedSymbol = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number,
  color: string,
  halfLength: number,
  strokeWidth: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-angleDeg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-halfLength, 0);
  ctx.lineTo(halfLength, 0);
  ctx.stroke();
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

const drawCanvas = (
  canvas: HTMLCanvasElement,
  box: CanvasBox,
  points: Array<{
    x: number;
    z: number;
    angle: number;
  }>,
  currentIndex: number,
  currentAngle: number,
  oarSide: OarSide,
) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = COLOR_BY_ANGLE.background;
  ctx.fillRect(0, 0, box.width, box.height);

  const plotWidth = box.width - PLOT_PADDING.left - PLOT_PADDING.right;
  const plotHeight = box.height - PLOT_PADDING.top - PLOT_PADDING.bottom;
  const scaleX = plotWidth / (TRAJECTORY_DOMAIN.x[1] - TRAJECTORY_DOMAIN.x[0]);
  const scaleZ = plotHeight / (TRAJECTORY_DOMAIN.z[1] - TRAJECTORY_DOMAIN.z[0]);

  const worldToCanvas = (xCm: number, zCm: number) => ({
    x: PLOT_PADDING.left + (xCm - TRAJECTORY_DOMAIN.x[0]) * scaleX,
    y: PLOT_PADDING.top + (TRAJECTORY_DOMAIN.z[1] - zCm) * scaleZ,
  });

  ctx.save();
  ctx.strokeStyle = COLOR_BY_ANGLE.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let x = TRAJECTORY_DOMAIN.x[0]; x <= TRAJECTORY_DOMAIN.x[1]; x += 100) {
    const { x: px } = worldToCanvas(x, TRAJECTORY_DOMAIN.z[0]);
    ctx.beginPath();
    ctx.moveTo(px, PLOT_PADDING.top);
    ctx.lineTo(px, box.height - PLOT_PADDING.bottom);
    ctx.stroke();
    drawText(ctx, `${x}`, px, box.height - PLOT_PADDING.bottom + 18, {
      align: "center",
      baseline: "top",
      size: 18,
      bold: true,
      color: "#374151",
    });
  }

  for (let z = TRAJECTORY_DOMAIN.z[0]; z <= TRAJECTORY_DOMAIN.z[1]; z += 20) {
    const { y: py } = worldToCanvas(TRAJECTORY_DOMAIN.x[0], z);
    ctx.beginPath();
    ctx.moveTo(PLOT_PADDING.left, py);
    ctx.lineTo(box.width - PLOT_PADDING.right, py);
    ctx.stroke();
    drawText(ctx, `${z}`, PLOT_PADDING.left - 8, py, {
      align: "right",
      baseline: "middle",
      size: 18,
      bold: true,
      color: "#374151",
    });
  }

  ctx.setLineDash([]);
  ctx.restore();

  const axisZero = worldToCanvas(0, 0);
  const waterLine = worldToCanvas(0, -30);

  ctx.save();
  ctx.strokeStyle = COLOR_BY_ANGLE.axis;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(PLOT_PADDING.left, axisZero.y);
  ctx.lineTo(box.width - PLOT_PADDING.right, axisZero.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(axisZero.x, PLOT_PADDING.top);
  ctx.lineTo(axisZero.x, box.height - PLOT_PADDING.bottom);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = COLOR_BY_ANGLE.water;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PLOT_PADDING.left, waterLine.y);
  ctx.lineTo(box.width - PLOT_PADDING.right, waterLine.y);
  ctx.stroke();
  drawText(ctx, "水面", box.width - PLOT_PADDING.right, waterLine.y - 6, {
    align: "right",
    baseline: "bottom",
    size: 14,
    bold: true,
    color: COLOR_BY_ANGLE.water,
  });
  ctx.restore();

  if (oarSide === "left") {
    const leftDirection = worldToCanvas(-170, -65);
    const leftDirectionLabel = worldToCanvas(-170, -78);
    drawArrow(ctx, leftDirection.x, leftDirection.y, 180);
    drawText(ctx, "Direction", leftDirectionLabel.x, leftDirectionLabel.y, {
      align: "center",
      baseline: "middle",
      size: 14,
      bold: true,
      color: "#111111",
    });
  } else {
    const rightDirection = worldToCanvas(170, -65);
    const rightDirectionLabel = worldToCanvas(170, -78);
    drawArrow(ctx, rightDirection.x, rightDirection.y, 0);
    drawText(ctx, "Direction", rightDirectionLabel.x, rightDirectionLabel.y, {
      align: "center",
      baseline: "middle",
      size: 14,
      bold: true,
      color: "#111111",
    });
  }

  const labelText = "Angle: ";
  const valueText = formatAngle(currentAngle);
  const valueColor = isIdealAngle(currentAngle) ? COLOR_BY_ANGLE.ideal : "#111111";

  ctx.save();
  ctx.font = "bold 24px Arial, sans-serif";
  const labelWidth = ctx.measureText(labelText).width;
  ctx.restore();

  drawText(ctx, labelText, PLOT_PADDING.left, 24, {
    align: "left",
    baseline: "middle",
    size: 24,
    bold: true,
    color: "#111111",
  });

  drawText(ctx, valueText, PLOT_PADDING.left + labelWidth, 24, {
    align: "left",
    baseline: "middle",
    size: 24,
    bold: true,
    color: valueColor,
  });

  points.slice(0, currentIndex + 1).forEach((point, index) => {
    const { x, y } = worldToCanvas(point.x, point.z);
    const isCurrent = index === currentIndex;
    const strokeColor = isCurrent ? COLOR_BY_ANGLE.highlight : isIdealAngle(point.angle) ? COLOR_BY_ANGLE.ideal : COLOR_BY_ANGLE.normal;
    const halfLength = isCurrent ? HIGHLIGHT_HALF_LENGTH : SYMBOL_HALF_LENGTH;
    const strokeWidth = isCurrent ? HIGHLIGHT_STROKE_WIDTH : SYMBOL_STROKE_WIDTH;
    drawRotatedSymbol(ctx, x, y, point.angle, strokeColor, halfLength, strokeWidth);
    if (isCurrent) {
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
};

export default function OarTrajectoryChart({ frames, currentIndex }: Props) {
  const { oarSide } = usePlaybackStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasSizeRef = useRef<CanvasSize>({ w: 0, h: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const points = useMemo(() => buildOarTrajectory(frames), [frames]);
  const hasTrajectory = frames.length > 0 && points.length > 0;

  const activeData = useMemo(
    () =>
      points.map((point) => ({
        x: oarSide === "right" ? point.rightX : point.leftX,
        z: oarSide === "right" ? point.rightZ : point.leftZ,
        angle: oarSide === "right" ? point.rightAngleDeg : point.leftAngleDeg,
        frameNumber: point.frameNumber,
      })),
    [oarSide, points],
  );
  const safeIndex = Math.max(0, Math.min(currentIndex, points.length - 1));
  const currentAngle = activeData[safeIndex]?.angle ?? 0;
  const latestRenderStateRef = useRef({
    activeData,
    safeIndex,
    currentAngle,
    oarSide,
  });
  latestRenderStateRef.current = {
    activeData,
    safeIndex,
    currentAngle,
    oarSide,
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

    const { activeData: latestActiveData, safeIndex: latestSafeIndex, currentAngle: latestCurrentAngle, oarSide: latestOarSide } = latestRenderStateRef.current;
    resizeCanvas(canvas, box, canvasSizeRef);
    drawCanvas(canvas, box, latestActiveData, latestSafeIndex, latestCurrentAngle, latestOarSide);
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
      // キャッシュを破棄して必ず再計測させる
      canvasSizeRef.current = { w: 0, h: 0 };
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
    drawCanvas(canvas, box, activeData, safeIndex, currentAngle, oarSide);
  }, [activeData, currentAngle, safeIndex, oarSide]);

  if (!hasTrajectory) {
    return (
      <div className="panel-empty" style={{ flexDirection: "column", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>オール軌跡</h3>
        <p style={{ margin: 0, fontSize: "22px" }}>軌跡データがありません。</p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ width: "100%", flex: 1, minHeight: 0 }}>
      <canvas
        ref={canvasRef}
        aria-label={`${oarSide === "right" ? "右オール" : "左オール"}の軌跡キャンバス`}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
