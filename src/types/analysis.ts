import type { RowingFrame } from './rowing';
import type { StrokeSegment } from './strokeDetect';

export interface DatasetStrokeData {
  id: string;
  label: string;
  frames: RowingFrame[];
  strokes: StrokeSegment[];
}

export interface StrokeMetricRow {
  strokeIndex: number;
  startFrame: number;
  endFrame: number;
  leftCatch: number;
  leftFinish: number;
  rightCatch: number;
  rightFinish: number;
  catchAngleDiff: number;
  finishAngleDiff: number;
  leftIdealRatio: number;
  rightIdealRatio: number;
  datasetId?: string;
  datasetLabel?: string;
}
