/**
 * SymmetryChart.tsx — 左右対称性（バランス）分析パネル（機能 4）+ 艇速周期変動（機能 5）
 *
 * レイアウト:
 *   上段: 概要カード（平均差・標準偏差）— 横一列（flexShrink: 0）
 *   中段: ストローク別差分テーブル（コンパクト数値表）
 *   下段: 艇速プロファイル キャンバスチャート（機能5; flex: 1 で残余高さを占有）
 *
 * スタイル方針:
 *   - キャンバス描画は TimeSeriesChart / OarTrajectoryChart と同一パターン
 *     （ResizeObserver + devicePixelRatio + latestRenderStateRef）
 *   - 同一フォント (Arial, sans-serif)・同一カラーパレット (#e2e8f0 グリッド / #64748b ラベル / #2563eb 青)
 *   - 外部ライブラリ不要
 */

import { useEffect, useRef, useMemo, memo } from 'react';
import type { CSSProperties } from 'react';
import type { SymmetryResult, StrokeSymmetry } from '../domain/analyzers/symmetryAnalyzer';
import type { VelocityResult } from '../domain/analyzers/velocityAnalyzer';

// ───────────────────────────────────────────────────────────────────────────
// 定数
// ───────────────────────────────────────────────────────────────────────────

const COLORS = {
  catch:  '#3b82f6',
  finish: '#ea580c',
  sweep:  '#16a34a',
  timing: '#8b5cf6',
  roll:   '#ef4444',
} as const;

const CANVAS = {
  bg:          '#ffffff',
  grid:        '#e2e8f0',
  axis:        '#64748b',
  label:       '#475569',
  text:        '#0f172a',
  strokeLine:  'rgba(148,163,184,0.45)',
  meanLine:    '#2563eb',
} as const;

const PAD = { top: 28, right: 16, bottom: 36, left: 50 } as const;

// ───────────────────────────────────────────────────────────────────────────
// ヘルパー
// ───────────────────────────────────────────────────────────────────────────

function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function stdDev(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x !== null);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
}

function fmt(v: number | null, digits = 1, unit = '°'): string {
  if (v === null) return '--';
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}${unit}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Canvas ユーティリティ（TimeSeriesChart と同一パターン）
// ───────────────────────────────────────────────────────────────────────────

type CanvasSize = { w: number; h: number };
type SizeRef = { current: CanvasSize };

function resizeCanvas(
  canvas: HTMLCanvasElement,
  box: { width: number; height: number },
  sizeRef: SizeRef,
): boolean {
  const w = Math.max(1, Math.round(box.width));
  const h = Math.max(1, Math.round(box.height));
  if (sizeRef.current.w === w && sizeRef.current.h === h) return false;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = `${w}px`;
  canvas.style.height = `${h}px`;
  sizeRef.current = { w, h };
  return true;
}

function resolveBox(
  wrapper: HTMLDivElement,
  sizeRef: SizeRef,
): { width: number; height: number } | null {
  const { w, h } = sizeRef.current;
  if (w > 0 && h > 0) return { width: w, height: h };
  const r = wrapper.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { width: Math.round(r.width), height: Math.round(r.height) };
}

// ───────────────────────────────────────────────────────────────────────────
// 速度プロファイル キャンバス描画
// ───────────────────────────────────────────────────────────────────────────

function drawVelocityCanvas(
  canvas: HTMLCanvasElement,
  box: { width: number; height: number },
  velocity: VelocityResult,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = box.width;
  const H = box.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CANVAS.bg;
  ctx.fillRect(0, 0, W, H);

  const plotW = Math.max(1, W - PAD.left - PAD.right);
  const plotH = Math.max(1, H - PAD.top - PAD.bottom);

  const { perStroke, meanProfile, profilePoints, maxSpeed } = velocity;
  const yMax = Math.max(maxSpeed, 0.5);

  // 座標変換
  const toX = (pct: number) => PAD.left + (pct / 100) * plotW;
  const toY = (v: number) => PAD.top + (1 - Math.min(v, yMax) / yMax) * plotH;

  // ─── グリッド ───────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = CANVAS.grid;
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);

  const xTicks = [0, 25, 50, 75, 100];
  for (const pct of xTicks) {
    const cx = toX(pct);
    ctx.beginPath();
    ctx.moveTo(cx, PAD.top);
    ctx.lineTo(cx, PAD.top + plotH);
    ctx.stroke();
  }

  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const v  = (yMax * i) / ySteps;
    const cy = toY(v);
    ctx.beginPath();
    ctx.moveTo(PAD.left, cy);
    ctx.lineTo(PAD.left + plotW, cy);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();

  // ─── 軸線 ───────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = CANVAS.axis;
  ctx.lineWidth   = 1.25;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();
  ctx.restore();

  // ─── X軸ラベル ─────────────────────────────────────────
  ctx.fillStyle    = CANVAS.label;
  ctx.font         = '10px Arial, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  for (const pct of xTicks) {
    ctx.fillText(`${pct}%`, toX(pct), PAD.top + plotH + 4);
  }
  ctx.textBaseline = 'bottom';
  ctx.fillText('ストローク位相 [%]', PAD.left + plotW / 2, H - 2);

  // ─── Y軸ラベル ─────────────────────────────────────────
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= ySteps; i++) {
    const v  = (yMax * i) / ySteps;
    ctx.fillText(v.toFixed(1), PAD.left - 4, toY(v));
  }

  // Y軸単位（縦書き）
  ctx.save();
  ctx.translate(11, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('速度 [m/s]', 0, 0);
  ctx.restore();

  // ─── タイトル ───────────────────────────────────────────
  ctx.fillStyle    = CANVAS.label;
  ctx.font         = 'bold 11px Arial, sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('艇速プロファイル（ストローク正規化）', PAD.left, 4);

  // ─── 各ストロークのプロファイル（薄い線）────────────────
  ctx.save();
  ctx.strokeStyle = CANVAS.strokeLine;
  ctx.lineWidth   = 1;
  ctx.lineJoin    = 'round';

  for (const stroke of perStroke) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < profilePoints; i++) {
      const v = stroke.normalizedProfile[i];
      if (v === null || !Number.isFinite(v)) { started = false; continue; }
      const cx = toX((i / (profilePoints - 1)) * 100);
      const cy = toY(v);
      if (!started) { ctx.moveTo(cx, cy); started = true; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ─── 平均プロファイル（太い青線）────────────────────────
  ctx.save();
  ctx.strokeStyle = CANVAS.meanLine;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < profilePoints; i++) {
    const v = meanProfile[i];
    if (v === null || !Number.isFinite(v)) { started = false; continue; }
    const cx = toX((i / (profilePoints - 1)) * 100);
    const cy = toY(v);
    if (!started) { ctx.moveTo(cx, cy); started = true; }
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.restore();

  // ─── 凡例 ───────────────────────────────────────────────
  const legX = PAD.left + plotW - 110;
  const legY = PAD.top + 8;

  ctx.save();
  ctx.strokeStyle = CANVAS.strokeLine;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(legX, legY + 5);
  ctx.lineTo(legX + 18, legY + 5);
  ctx.stroke();
  ctx.fillStyle    = CANVAS.label;
  ctx.font         = '10px Arial, sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('各ストローク', legX + 22, legY + 5);

  ctx.strokeStyle = CANVAS.meanLine;
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(legX, legY + 19);
  ctx.lineTo(legX + 18, legY + 19);
  ctx.stroke();
  ctx.fillText('平均', legX + 22, legY + 19);
  ctx.restore();
}

// ───────────────────────────────────────────────────────────────────────────
// 速度プロファイル キャンバスコンポーネント
// ───────────────────────────────────────────────────────────────────────────

const VelocityCanvas = memo(function VelocityCanvas({ velocity }: { velocity: VelocityResult }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sizeRef    = useRef<CanvasSize>({ w: 0, h: 0 });
  const rafRef     = useRef<number | null>(null);

  // 最新の velocity を ref に保持（ResizeObserver のクロージャで古い値を参照しないため）
  const latestRef = useRef(velocity);
  latestRef.current = velocity;

  const cancelRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const drawLatest = () => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const box = resolveBox(wrapper, sizeRef);
    if (!box) {
      // wrapper がまだレイアウトされていない場合は次フレームに先送り
      cancelRaf();
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        drawLatest();
      });
      return;
    }

    resizeCanvas(canvas, box, sizeRef);
    drawVelocityCanvas(canvas, box, latestRef.current);
  };

  // ResizeObserver — マウント時に 1 度だけ登録
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    drawLatest();

    if (typeof ResizeObserver === 'undefined') return () => cancelRaf();

    const observer = new ResizeObserver(() => {
      sizeRef.current = { w: 0, h: 0 }; // キャッシュ破棄して再計測
      drawLatest();
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      cancelRaf();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // velocity データ変化時に再描画
  useEffect(() => {
    cancelRaf();
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawLatest();
    });
    return cancelRaf;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [velocity]);

  return (
    <div ref={wrapperRef} style={{ flex: 1, minHeight: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 概要カード
// ───────────────────────────────────────────────────────────────────────────

type SummaryCardProps = {
  label: string;
  avg: number | null;
  std: number | null;
  unit: string;
  color: string;
};

const SummaryCard = memo(function SummaryCard({ label, avg: a, std: s, unit, color }: SummaryCardProps) {
  const absAvg  = a !== null ? Math.abs(a) : null;
  const balanced = absAvg !== null && absAvg < 3;
  return (
    <div style={{
      flex: '1 1 130px',
      background: '#f8fafc',
      border: `1px solid ${balanced ? '#bbf7d0' : '#e2e8f0'}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: '8px',
      padding: '8px 12px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: 700, color, marginTop: '2px' }}>
        {fmt(a, 1, unit)}
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
        σ {s !== null ? `${s.toFixed(1)}${unit}` : '--'}
        {balanced && <span style={{ color: '#16a34a', marginLeft: '6px' }}>✓ 均衡</span>}
      </div>
    </div>
  );
});

// ───────────────────────────────────────────────────────────────────────────
// ストローク別差分テーブル
// ───────────────────────────────────────────────────────────────────────────

const DiffTable = memo(function DiffTable({ perStroke }: { perStroke: StrokeSymmetry[] }) {
  const thStyle: CSSProperties = {
    padding: '3px 6px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748b',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  };
  const tdStyle = (v: number | null): CSSProperties => ({
    padding: '2px 6px',
    fontSize: '11px',
    textAlign: 'right',
    color: v !== null && Math.abs(v) >= 5 ? '#dc2626' : '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      overflow: 'auto',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      background: '#ffffff',
    }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'center' }}>St</th>
            <th style={{ ...thStyle, color: COLORS.catch  }}>Δキャッチ角</th>
            <th style={{ ...thStyle, color: COLORS.finish }}>Δフィニッシュ角</th>
            <th style={{ ...thStyle, color: COLORS.sweep  }}>Δスイープ</th>
            <th style={{ ...thStyle, color: COLORS.timing }}>Δ入水時刻</th>
            <th style={{ ...thStyle, color: COLORS.roll   }}>ロール角</th>
          </tr>
        </thead>
        <tbody>
          {perStroke.map((s) => (
            <tr key={s.strokeIndex}>
              <td style={{ ...tdStyle(null), textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                {s.strokeIndex + 1}
              </td>
              <td style={tdStyle(s.catchAngleDiff)}>{fmt(s.catchAngleDiff)}</td>
              <td style={tdStyle(s.finishAngleDiff)}>{fmt(s.finishAngleDiff)}</td>
              <td style={tdStyle(s.sweepDiff)}>{fmt(s.sweepDiff)}</td>
              <td style={tdStyle(s.catchTimingDiff)}>{fmt(s.catchTimingDiff, 0, 'f')}</td>
              <td style={tdStyle(s.boatRollAtCatch)}>{fmt(s.boatRollAtCatch)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ───────────────────────────────────────────────────────────────────────────
// メインコンポーネント
// ───────────────────────────────────────────────────────────────────────────

type Props = {
  symmetry: SymmetryResult;
  velocity?: VelocityResult | null;
  isExpanded?: boolean;
};

export default function SymmetryChart({ symmetry, velocity, isExpanded: _isExpanded = false }: Props) {
  const { perStroke } = symmetry;

  const {
    catchDiffs, finishDiffs, sweepDiffs, catchTimings,
  } = useMemo(() => ({
    catchDiffs:   perStroke.map((s) => s.catchAngleDiff),
    finishDiffs:  perStroke.map((s) => s.finishAngleDiff),
    sweepDiffs:   perStroke.map((s) => s.sweepDiff),
    catchTimings: perStroke.map((s) => s.catchTimingDiff),
  }), [perStroke]);

  const summaries = useMemo(() => [
    { label: 'キャッチ角差',    avg: avg(catchDiffs),   std: stdDev(catchDiffs),   unit: '°', color: COLORS.catch  },
    { label: 'フィニッシュ角差', avg: avg(finishDiffs),  std: stdDev(finishDiffs),  unit: '°', color: COLORS.finish },
    { label: 'スイープ差',      avg: avg(sweepDiffs),   std: stdDev(sweepDiffs),   unit: '°', color: COLORS.sweep  },
    { label: '入水タイミング差', avg: avg(catchTimings), std: stdDev(catchTimings), unit: 'f', color: COLORS.timing },
  ], [catchDiffs, finishDiffs, sweepDiffs, catchTimings]);

  if (perStroke.length === 0) {
    return (
      <div className="panel-empty" style={{ flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: 0, fontSize: '18px' }}>ストロークが検出されていません。</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>解析モードをオンにしてデータをロードしてください。</p>
      </div>
    );
  }

  const hasVelocity = velocity !== null && velocity !== undefined && velocity.perStroke.length > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      color: '#0f172a',
      gap: '6px',
    }}>

      {/* ① 概要カード（縮まない） */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', marginBottom: '5px' }}>
          左右差 概要（左 − 右　正 = 左が大 / 遅い）
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {summaries.map((s) => (
            <SummaryCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* ② ストローク別差分テーブル（縮まない・最大30%まで） */}
      <div style={{ flexShrink: 0, maxHeight: '30%', overflow: 'hidden' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', marginBottom: '4px' }}>
          ストローク別差分（左 − 右 / ≥5° で赤）
        </div>
        <DiffTable perStroke={perStroke} />
      </div>

      {/* ③ 艇速プロファイル（機能5）— キャンバス; 残余高さを占有 */}
      {hasVelocity ? (
        <VelocityCanvas velocity={velocity!} />
      ) : (
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          fontSize: '12px',
          color: '#94a3b8',
        }}>
          速度データなし（speed 列が必要です）
        </div>
      )}

      {/* 補足 */}
      <div style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
        ※ 差分は左 − 右。角度 [°] / タイミング [frames]。速度プロファイルはストローク長を 0–100% に正規化して重ね描き。
      </div>
    </div>
  );
}
