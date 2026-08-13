import type { StrokeMetricRow } from '../../types/analysis';
import type { StrokeSegment } from '../../types/strokeDetect';
import { isIdealAngle } from '../../utils/oarAngle';
import type { TrajectoryPoint } from '../../utils/trajectory';
import type { Analyzer } from './types';

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

export function computeStrokeMetricRow(
  trajectory: TrajectoryPoint[],
  stroke: StrokeSegment,
): StrokeMetricRow {
  const { startFrame, endFrame } = stroke;
  const strokeTrajectory = trajectory.slice(startFrame, endFrame + 1);
  const leftAngles = strokeTrajectory.map(({ leftAngleDeg }) => leftAngleDeg);
  const rightAngles = strokeTrajectory.map(({ rightAngleDeg }) => rightAngleDeg);
  const minLeft = leftAngles.length > 0 ? Math.min(...leftAngles) : 0;
  const maxLeft = leftAngles.length > 0 ? Math.max(...leftAngles) : 0;
  const minRight = rightAngles.length > 0 ? Math.min(...rightAngles) : 0;
  const maxRight = rightAngles.length > 0 ? Math.max(...rightAngles) : 0;
  const catchPhase = stroke.phases.find(({ phase }) => phase === 'catch');
  const finishPhase = stroke.phases.find(({ phase }) => phase === 'finish');

  let leftCatch = maxLeft;
  let leftFinish = minLeft;
  let rightCatch = maxRight;
  let rightFinish = minRight;

  if (catchPhase && finishPhase) {
    const catchStart = Math.max(0, catchPhase.startFrame - startFrame);
    const catchEnd = Math.min(strokeTrajectory.length - 1, catchPhase.endFrame - startFrame);
    const finishStart = Math.max(0, finishPhase.startFrame - startFrame);
    const finishEnd = Math.min(strokeTrajectory.length - 1, finishPhase.endFrame - startFrame);
    const leftCatchAverage = average(leftAngles.slice(catchStart, catchEnd + 1));
    const rightCatchAverage = average(rightAngles.slice(catchStart, catchEnd + 1));
    const leftFinishAverage = average(leftAngles.slice(finishStart, finishEnd + 1));
    const rightFinishAverage = average(rightAngles.slice(finishStart, finishEnd + 1));

    leftCatch = leftCatchAverage > leftFinishAverage ? maxLeft : minLeft;
    leftFinish = leftCatchAverage > leftFinishAverage ? minLeft : maxLeft;
    rightCatch = rightCatchAverage > rightFinishAverage ? maxRight : minRight;
    rightFinish = rightCatchAverage > rightFinishAverage ? minRight : maxRight;
  }

  const driveStart = catchPhase?.startFrame ?? startFrame;
  const driveEnd = finishPhase?.endFrame ?? endFrame;
  const driveTrajectory = trajectory.slice(driveStart, driveEnd + 1);
  const driveFrameCount = Math.max(driveTrajectory.length, 1);

  return {
    strokeIndex: stroke.strokeIndex,
    startFrame,
    endFrame,
    leftCatch,
    leftFinish,
    rightCatch,
    rightFinish,
    // 右オール角は左と符号が反転するため、対称性は和で評価する。
    catchAngleDiff: leftCatch + rightCatch,
    finishAngleDiff: leftFinish + rightFinish,
    leftIdealRatio: Math.round(
      (driveTrajectory.filter(({ leftAngleDeg }) => isIdealAngle(leftAngleDeg)).length /
        driveFrameCount) * 100,
    ),
    rightIdealRatio: Math.round(
      (driveTrajectory.filter(({ rightAngleDeg }) => isIdealAngle(rightAngleDeg)).length /
        driveFrameCount) * 100,
    ),
  };
}

export const strokeMetricsAnalyzer: Analyzer<StrokeMetricRow[]> = {
  id: 'strokeMetrics',
  label: 'ストロークメトリクス',
  compute({ trajectory, strokes = [] }) {
    return strokes.map((stroke) => computeStrokeMetricRow(trajectory, stroke));
  },
};
