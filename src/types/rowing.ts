export type RowingValue = number | string | null;

export type RowingFrame = Record<string, RowingValue>;

export interface DatasetMeta {
  measurementMode: string;
  sourceName?: string;
  totalFrames: number;
}

export interface DatasetCsv {
  headers: string[];
  frames: RowingFrame[];
  meta: DatasetMeta;
}

export interface DatasetManifestItem {
  id: string;
  label: string;
  path: string;
}

export interface DatasetManifest {
  datasets: DatasetManifestItem[];
}

export interface TimePoint {
  frameNumber: number;
  elapsedSeconds: number;
}

export interface MetricSeriesPoint {
  frameNumber: number;
  value: number;
}

export interface GpsPoint {
  frameNumber: number;
  latitude: number;
  longitude: number;
}

export interface DerivedMetrics {
  spm: MetricSeriesPoint[];
  split: MetricSeriesPoint[];
  timeAxis: TimePoint[];
  gpsValidPoints: GpsPoint[];
  graphSeries: Record<string, MetricSeriesPoint[]>;
}

export interface StrokeSegment {
  id: number;
  startFrame: number;
  endFrame: number;
  catchFrame: number;
  finishFrame: number;
  entryFrame: number;
  finishThresholdFrame: number;
  exitFrame: number;
}

export interface OarStrokeMetrics {
  catchAngle: number;
  finishAngle: number;
  sweepAngle: number;
  drivePercent: number;
}

export interface StrokeMetrics {
  strokeId: number;
  left: OarStrokeMetrics | null;
  right: OarStrokeMetrics | null;
  catchFrame: number;
}

