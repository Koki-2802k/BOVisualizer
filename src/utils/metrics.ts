import type {
  DatasetCsv,
  DerivedMetrics,
  GpsPoint,
  MetricSeriesPoint,
  TimePoint,
} from '../types/rowing';
import type { NormalizedFrame, MetricKey } from '../domain/schema';
import { METRIC_COLUMNS } from '../domain/schema';
import { getAnalysis } from '../domain/analysisRepository';

// ───────────────────────────────────────────────────────────────────────────
// 内部ビルダー（NormalizedFrame を使用）
// ───────────────────────────────────────────────────────────────────────────

const buildMetricSeries = (frames: NormalizedFrame[], key: MetricKey): MetricSeriesPoint[] =>
  frames
    .map((frame) => ({
      frameNumber: frame.csvNumber ?? frame.arrayIndex,
      value: frame.metrics[key],
    }))
    .filter((point): point is MetricSeriesPoint => point.value !== null);

const buildTimeAxis = (frames: NormalizedFrame[]): TimePoint[] => {
  let startMs: number | null = null;
  // time_s が 0 始まりでないデータに対応するため、先頭フレームの値を引いて正規化する
  const startSec = frames[0]?.timeSec ?? null;

  return frames.map((frame, index) => {
    // time_s (経過秒) を優先
    if (frame.timeSec !== null) {
      return {
        frameNumber: frame.csvNumber ?? index,
        elapsedSeconds: startSec !== null ? frame.timeSec - startSec : frame.timeSec,
      };
    }

    // ISO 日時文字列から経過秒を計算
    if (frame.timeStr !== null) {
      const nowMs = Date.parse(frame.timeStr);
      if (!Number.isNaN(nowMs)) {
        if (startMs === null) startMs = nowMs;
        return {
          frameNumber: frame.csvNumber ?? index,
          elapsedSeconds: (nowMs - startMs) / 1000,
        };
      }
    }

    // フォールバック: インデックス / 60fps
    return {
      frameNumber: frame.csvNumber ?? index,
      elapsedSeconds: index / 60,
    };
  });
};

const buildGpsValidPoints = (frames: NormalizedFrame[]): GpsPoint[] =>
  frames
    .filter(
      (frame): frame is NormalizedFrame & { gpsLat: number; gpsLon: number } =>
        frame.gpsLat !== null && frame.gpsLon !== null,
    )
    .map((frame) => ({
      // frameNumber はフレーム配列のインデックス（再生位置 uiFrame と一致させる）。
      // CSV の 'number' 列は実測値で開始値が 0 でないため、再生位置と突き合わせると不一致になる。
      frameNumber: frame.arrayIndex,
      latitude: frame.gpsLat,
      longitude: frame.gpsLon,
    }));

// ───────────────────────────────────────────────────────────────────────────
// 公開 API
// ───────────────────────────────────────────────────────────────────────────

/** 公開ラッパー — 外部コンポーネントは DatasetCsv を渡す。 */
export const deriveMetrics = (dataset: DatasetCsv): DerivedMetrics => {
  return getAnalysis(dataset.frames).metrics;
};

/**
 * 内部計算用。NormalizedFrame[] を直接受け取りメトリクスを導出する。
 * graphSeries は METRIC_COLUMNS から自動生成されるため、列追加は schema.ts の 1 行のみ。
 */
export const deriveMetricsInternal = (frames: NormalizedFrame[]): DerivedMetrics => {
  return {
    spm: buildMetricSeries(frames, 'SPM'),
    split: buildMetricSeries(frames, 'SPLIT'),
    timeAxis: buildTimeAxis(frames),
    gpsValidPoints: buildGpsValidPoints(frames),
    graphSeries: Object.fromEntries(
      METRIC_COLUMNS.map((key) => [key, buildMetricSeries(frames, key)]),
    ) as Record<string, MetricSeriesPoint[]>,
  };
};
