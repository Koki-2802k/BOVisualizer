import type { RowingFrame } from '../types/rowing';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

type MetricsBarProps = {
  frame: RowingFrame | null;
};

function metricText(value: number | null, suffix = ''): string {
  if (value === null) {
    return '--';
  }
  return `${value.toFixed(1)}${suffix}`;
}

export default function MetricsBar({ frame }: MetricsBarProps) {
  const spm = frame ? toNumber(frame.SPM) : null;
  const split = frame ? toNumber(frame.SPLIT) : null;
  const leftAngle = frame ? toNumber(frame.angle_left) : null;
  const rightAngle = frame ? toNumber(frame.angle_right) : null;

  return (
    <section className="panel metrics-bar" aria-label="メトリクス">
      <span className="metric-item"><span className="label">SPM</span><strong>{metricText(spm)}</strong></span>
      <span className="metric-item"><span className="label">SPLIT</span><strong>{metricText(split)}</strong></span>
      <span className="metric-item"><span className="label">左オール</span><strong>{metricText(leftAngle, '°')}</strong></span>
      <span className="metric-item"><span className="label">右オール</span><strong>{metricText(rightAngle, '°')}</strong></span>
    </section>
  );
}
