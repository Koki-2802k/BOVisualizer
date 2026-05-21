import type {
  DatasetCsv,
  DerivedMetrics,
  GpsPoint,
  MetricSeriesPoint,
  RowingFrame,
  TimePoint,
} from '../types/rowing';

const numericValue = (frame: RowingFrame, key: string): number | null => {
  const value = frame[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const buildMetricSeries = (frames: RowingFrame[], key: string): MetricSeriesPoint[] =>
  frames
    .map((frame) => ({
      frameNumber: numericValue(frame, 'number') ?? 0,
      value: numericValue(frame, key),
    }))
    .filter((point): point is MetricSeriesPoint => point.value !== null);

const buildTimeAxis = (frames: RowingFrame[]): TimePoint[] => {
  let startMs: number | null = null;

  return frames.map((frame, index) => {
    const raw = frame.time;
    const nowMs = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;

    if (!Number.isNaN(nowMs) && startMs === null) {
      startMs = nowMs;
    }

    const elapsedSeconds = startMs !== null && !Number.isNaN(nowMs) ? (nowMs - startMs) / 1000 : index / 60;

    return {
      frameNumber: numericValue(frame, 'number') ?? index,
      elapsedSeconds,
    };
  });
};

const buildGpsValidPoints = (frames: RowingFrame[]): GpsPoint[] =>
  frames
    .map((frame, index) => {
      const latitude = numericValue(frame, 'latitude');
      const longitude = numericValue(frame, 'longitude');
      if (latitude === null || longitude === null) {
        return null;
      }
      if (latitude === 0 && longitude === 0) {
        return null;
      }
      return {
        frameNumber: numericValue(frame, 'number') ?? index,
        latitude,
        longitude,
      };
    })
    .filter((point): point is GpsPoint => point !== null);

export const deriveMetrics = (dataset: DatasetCsv): DerivedMetrics => {
  const { frames } = dataset;

  return {
    spm: buildMetricSeries(frames, 'SPM'),
    split: buildMetricSeries(frames, 'SPLIT'),
    timeAxis: buildTimeAxis(frames),
    gpsValidPoints: buildGpsValidPoints(frames),
    graphSeries: {
      speed: buildMetricSeries(frames, 'speed'),
      accx: buildMetricSeries(frames, 'accx'),
      accy: buildMetricSeries(frames, 'accy'),
      accz: buildMetricSeries(frames, 'accz'),
      gyrox: buildMetricSeries(frames, 'gyrox'),
      gyroy: buildMetricSeries(frames, 'gyroy'),
      gyroz: buildMetricSeries(frames, 'gyroz'),
    },
  };
};
