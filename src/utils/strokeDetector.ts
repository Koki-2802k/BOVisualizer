import { extractZXYEulerYDeg, makeSensorQuaternion } from './coordTransform';
import type { RowingFrame, StrokeSegment, StrokeMetrics, OarStrokeMetrics } from '../types/rowing';

const isFiniteNum = (val: unknown): boolean =>
  (typeof val === 'number' && Number.isFinite(val)) ||
  (typeof val === 'string' && val.trim().length > 0 && !Number.isNaN(Number(val)) && Number.isFinite(Number(val)));

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

// Helper to extract and smooth oar angles
export function getSmoothedAngles(frames: RowingFrame[], oarSide: 'left' | 'right'): number[] {
  const angles = frames.map((frame) => {
    const hasLeftQ =
      frame.wol != null && frame.xol != null && frame.yol != null && frame.zol != null &&
      isFiniteNum(frame.wol) && isFiniteNum(frame.xol) && isFiniteNum(frame.yol) && isFiniteNum(frame.zol);
    const hasRightQ =
      frame.wor != null && frame.xor != null && frame.yor != null && frame.zor != null &&
      isFiniteNum(frame.wor) && isFiniteNum(frame.xor) && isFiniteNum(frame.yor) && isFiniteNum(frame.zor);

    if (oarSide === 'left') {
      return hasLeftQ
        ? extractZXYEulerYDeg(
            makeSensorQuaternion(
              Number(frame.wol),
              Number(frame.xol),
              Number(frame.yol),
              Number(frame.zol),
            ),
          )
        : (asNumber(frame.angle_left) ?? 0);
    } else {
      return hasRightQ
        ? extractZXYEulerYDeg(
            makeSensorQuaternion(
              Number(frame.wor),
              Number(frame.xor),
              Number(frame.yor),
              Number(frame.zor),
            ),
          )
        : (asNumber(frame.angle_right) ?? 0);
    }
  });

  const smoothed: number[] = [];
  for (let i = 0; i < angles.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(angles.length - 1, i + 2); j++) {
      sum += angles[j];
      count++;
    }
    smoothed.push(sum / count);
  }
  return smoothed;
}

export function detectStrokes(frames: RowingFrame[], oarSide: 'left' | 'right'): StrokeSegment[] {
  if (frames.length < 20) {
    return [];
  }

  const smoothed = getSmoothedAngles(frames, oarSide);

  // 3. Estimate sampling rate (FPS) and period using SPM
  let spmSum = 0;
  let spmCount = 0;
  for (const f of frames) {
    const val = asNumber(f.SPM);
    if (val !== null && val > 0) {
      spmSum += val;
      spmCount++;
    }
  }
  const averageSpm = spmCount > 0 ? spmSum / spmCount : 28;

  let timeDiffSum = 0;
  let timeDiffCount = 0;
  for (let i = 1; i < frames.length; i++) {
    const t1 = frames[i - 1].time;
    const t2 = frames[i].time;
    if (typeof t1 === 'string' && typeof t2 === 'string') {
      const diff = Date.parse(t2) - Date.parse(t1);
      if (!Number.isNaN(diff) && diff > 0) {
        timeDiffSum += diff / 1000;
        timeDiffCount++;
      }
    }
  }
  const fps = timeDiffCount > 0 ? 1 / (timeDiffSum / timeDiffCount) : 30;

  const estimatedPeriod = (60 / averageSpm) * fps;
  const minPeakDistance = Math.round(estimatedPeriod * 0.5);
  const windowSize = Math.round(estimatedPeriod * 0.2);
  const win = Math.max(5, Math.min(30, windowSize));

  // 4. Find local extrema
  const isLocalMax = (arr: number[], idx: number, w: number): boolean => {
    const val = arr[idx];
    for (let i = Math.max(0, idx - w); i <= Math.min(arr.length - 1, idx + w); i++) {
      if (i !== idx && arr[i] > val) {
        return false;
      }
    }
    return true;
  };

  const isLocalMin = (arr: number[], idx: number, w: number): boolean => {
    const val = arr[idx];
    for (let i = Math.max(0, idx - w); i <= Math.min(arr.length - 1, idx + w); i++) {
      if (i !== idx && arr[i] < val) {
        return false;
      }
    }
    return true;
  };

  const catchCandidates: number[] = [];
  for (let i = 0; i < smoothed.length; i++) {
    const isCatch = oarSide === 'left' ? isLocalMax(smoothed, i, win) : isLocalMin(smoothed, i, win);
    if (isCatch) {
      catchCandidates.push(i);
    }
  }

  // Filter candidates to ensure they are at least minPeakDistance apart
  const catches: number[] = [];
  let lastCatch = -1;
  for (let i = 0; i < catchCandidates.length; i++) {
    const cand = catchCandidates[i];
    if (lastCatch === -1 || cand - lastCatch >= minPeakDistance) {
      let bestCand = cand;
      let j = i + 1;
      while (j < catchCandidates.length && catchCandidates[j] - cand < minPeakDistance) {
        const other = catchCandidates[j];
        const isBetter = oarSide === 'left'
          ? smoothed[other] > smoothed[bestCand]
          : smoothed[other] < smoothed[bestCand];
        if (isBetter) {
          bestCand = other;
        }
        j++;
      }
      catches.push(bestCand);
      lastCatch = bestCand;
      i = j - 1;
    }
  }

  // 5. Segment into strokes and divide phases
  const segments: StrokeSegment[] = [];
  for (let k = 0; k < catches.length - 1; k++) {
    const c1 = catches[k];
    const c2 = catches[k + 1];

    let finishIdx = -1;
    let bestVal = oarSide === 'left' ? Infinity : -Infinity;

    const searchStart = c1 + Math.round((c2 - c1) * 0.2);
    const searchEnd = c1 + Math.round((c2 - c1) * 0.8);

    for (let idx = searchStart; idx <= searchEnd; idx++) {
      const val = smoothed[idx];
      const isBetter = oarSide === 'left' ? val < bestVal : val > bestVal;
      if (isBetter) {
        bestVal = val;
        finishIdx = idx;
      }
    }

    if (finishIdx !== -1) {
      const nDrive = finishIdx - c1;
      const nRec = c2 - finishIdx;

      // Safely calculate bounds, preventing layout issues on short segments
      const entryFrame = Math.min(c1 + Math.round(0.15 * nDrive), finishIdx - 1);
      const finishThresholdFrame = Math.max(finishIdx - Math.round(0.15 * nDrive), entryFrame + 1);
      const exitFrame = Math.min(finishIdx + Math.round(0.15 * nRec), c2 - 1);

      segments.push({
        id: segments.length + 1,
        startFrame: c1,
        endFrame: c2,
        catchFrame: c1,
        finishFrame: finishIdx,
        entryFrame,
        finishThresholdFrame,
        exitFrame,
      });
    }
  }

  return segments;
}

export function computeStrokeMetrics(frames: RowingFrame[]): StrokeMetrics[] {
  if (frames.length < 20) {
    return [];
  }

  const leftStrokes = detectStrokes(frames, 'left');
  const rightStrokes = detectStrokes(frames, 'right');

  const smoothedLeft = getSmoothedAngles(frames, 'left');
  const smoothedRight = getSmoothedAngles(frames, 'right');

  const calculateSingleMetrics = (
    stroke: StrokeSegment,
    smoothed: number[]
  ): OarStrokeMetrics => {
    const catchAngle = smoothed[stroke.catchFrame];
    const finishAngle = smoothed[stroke.finishFrame];
    const sweepAngle = Math.abs(catchAngle - finishAngle);

    const totalDuration = stroke.endFrame - stroke.startFrame;
    const driveDuration = stroke.finishFrame - stroke.startFrame;
    const drivePercent = totalDuration > 0 ? (driveDuration / totalDuration) * 100 : 0;

    return {
      catchAngle,
      finishAngle,
      sweepAngle,
      drivePercent,
    };
  };

  const maxDiff = 20;
  const strokeMetricsList: StrokeMetrics[] = [];
  const matchedRightIds = new Set<number>();

  leftStrokes.forEach((l, idx) => {
    let bestRight: StrokeSegment | null = null;
    let bestDiff = Infinity;

    rightStrokes.forEach((r) => {
      const diff = Math.abs(l.catchFrame - r.catchFrame);
      if (diff < maxDiff && diff < bestDiff) {
        bestDiff = diff;
        bestRight = r;
      }
    });

    const leftMetrics = calculateSingleMetrics(l, smoothedLeft);
    let rightMetrics: OarStrokeMetrics | null = null;

    if (bestRight) {
      rightMetrics = calculateSingleMetrics(bestRight, smoothedRight);
      matchedRightIds.add((bestRight as StrokeSegment).id);
    }

    strokeMetricsList.push({
      strokeId: idx + 1,
      left: leftMetrics,
      right: rightMetrics,
      catchFrame: l.catchFrame,
    });
  });

  // Append unmatched right strokes
  rightStrokes.forEach((r) => {
    if (!matchedRightIds.has(r.id)) {
      const rightMetrics = calculateSingleMetrics(r, smoothedRight);
      strokeMetricsList.push({
        strokeId: strokeMetricsList.length + 1,
        left: null,
        right: rightMetrics,
        catchFrame: r.catchFrame,
      });
    }
  });

  // Sort by catch frame and re-index
  return strokeMetricsList
    .sort((a, b) => a.catchFrame - b.catchFrame)
    .map((item, idx) => ({
      ...item,
      strokeId: idx + 1,
    }));
}
