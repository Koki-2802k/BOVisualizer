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
