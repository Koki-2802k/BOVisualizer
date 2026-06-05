import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '../store/playbackStore';

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

// Sub-component for rendering tiny inline canvas sparkline graphs
export function Sparkline({ data, width = 60, height = 18, color = '#2563eb' }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    data.forEach((val, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - 2 - ((val - min) / range) * (height - 4);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }, [data, width, height, color]);

  if (data.length === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        margin: '2px auto 0',
        opacity: 0.85,
      }}
      title="セッションの傾向値トレンド"
    />
  );
}

function formatAngle(val: number | undefined | null): string {
  if (val === undefined || val === null) return '--';
  return `${val.toFixed(1)}°`;
}

function formatPercent(val: number | undefined | null): string {
  if (val === undefined || val === null) return '--';
  return `${Math.round(val)}%`;
}

export default function StrokeMetricsTable() {
  const { strokeMetrics, seekFrame, setSeekFrame } = usePlaybackStore();

  // Determine active stroke
  let activeStrokeId = -1;
  for (const item of strokeMetrics) {
    // We highlight the stroke if seekFrame lies within that stroke's vicinity
    // (since strokeMetrics are aligned, we can match on closest catchFrame)
    if (seekFrame >= item.catchFrame) {
      activeStrokeId = item.strokeId;
    }
  }

  // Collect data arrays for sparklines
  const filterVal = (vals: (number | null | undefined)[]): number[] =>
    vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const leftCatches = filterVal(strokeMetrics.map((s) => s.left?.catchAngle));
  const leftFinishes = filterVal(strokeMetrics.map((s) => s.left?.finishAngle));
  const leftSweeps = filterVal(strokeMetrics.map((s) => s.left?.sweepAngle));
  const leftRhythms = filterVal(strokeMetrics.map((s) => s.left?.drivePercent));

  const rightCatches = filterVal(strokeMetrics.map((s) => s.right?.catchAngle));
  const rightFinishes = filterVal(strokeMetrics.map((s) => s.right?.finishAngle));
  const rightSweeps = filterVal(strokeMetrics.map((s) => s.right?.sweepAngle));
  const rightRhythms = filterVal(strokeMetrics.map((s) => s.right?.drivePercent));

  if (!strokeMetrics || strokeMetrics.length === 0) {
    return (
      <div className="panel-empty" style={{ flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>ストローク別メトリクス解析</h3>
        <p style={{ margin: 0, fontSize: '14px' }}>有効なストロークデータがありません。3Dシーン上でオールの動作を再生してください。</p>
      </div>
    );
  }

  return (
    <>
      <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, flexShrink: 0 }}>
        ストローク別メトリクス解析 <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>(クリックで行ジャンプ)</span>
      </h3>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <table className="stroke-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 5, borderBottom: '2px solid #cbd5e1' }}>
            <tr>
              <th rowSpan={2} style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1', fontWeight: 700, verticalAlign: 'middle', backgroundColor: '#f1f5f9', width: '50px' }}>#</th>
              <th colSpan={4} style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1', color: '#1d4ed8', fontWeight: 700, backgroundColor: '#eff6ff' }}>左オール (Port Side)</th>
              <th colSpan={4} style={{ padding: '4px 8px', color: '#16a34a', fontWeight: 700, backgroundColor: '#f0fdf4' }}>右オール (Starboard Side)</th>
            </tr>
            <tr style={{ borderTop: '1px solid #cbd5e1', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.02em', backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                キャッチ
                <Sparkline data={leftCatches} color="#3b82f6" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                フィニッシュ
                <Sparkline data={leftFinishes} color="#3b82f6" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                アーク
                <Sparkline data={leftSweeps} color="#3b82f6" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #cbd5e1' }}>
                リズム
                <Sparkline data={leftRhythms} color="#3b82f6" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                キャッチ
                <Sparkline data={rightCatches} color="#22c55e" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                フィニッシュ
                <Sparkline data={rightFinishes} color="#22c55e" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                アーク
                <Sparkline data={rightSweeps} color="#22c55e" />
              </th>
              <th style={{ padding: '4px 6px', fontWeight: 600, color: '#334155' }}>
                リズム
                <Sparkline data={rightRhythms} color="#22c55e" />
              </th>
            </tr>
          </thead>
          <tbody>
            {strokeMetrics.map((item) => {
              const isActive = item.strokeId === activeStrokeId;
              return (
                <tr
                  key={item.strokeId}
                  onClick={() => setSeekFrame(item.catchFrame)}
                  className={isActive ? 'row-active' : ''}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isActive ? '#f0f9ff' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{
                    padding: '6px 8px',
                    borderRight: '1px solid #e2e8f0',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0284c7' : '#64748b',
                    backgroundColor: isActive ? '#e0f2fe' : '#f8fafc',
                    borderLeft: isActive ? '3px solid #0284c7' : 'none',
                  }}>
                    {item.strokeId}
                  </td>
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #f1f5f9', color: '#1e3a8a' }}>{formatAngle(item.left?.catchAngle)}</td>
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #f1f5f9', color: '#1e3a8a' }}>{formatAngle(item.left?.finishAngle)}</td>
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #f1f5f9', color: '#1d4ed8', fontWeight: isActive ? 600 : 500 }}>{formatAngle(item.left?.sweepAngle)}</td>
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #e2e8f0', color: '#475569' }}>{formatPercent(item.left?.drivePercent)}</td>
                  
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #f1f5f9', color: '#064e3b' }}>{formatAngle(item.right?.catchAngle)}</td>
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #f1f5f9', color: '#064e3b' }}>{formatAngle(item.right?.finishAngle)}</td>
                  <td style={{ padding: '6px 6px', borderRight: '1px solid #f1f5f9', color: '#16a34a', fontWeight: isActive ? 600 : 500 }}>{formatAngle(item.right?.sweepAngle)}</td>
                  <td style={{ padding: '6px 6px', color: '#475569' }}>{formatPercent(item.right?.drivePercent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
