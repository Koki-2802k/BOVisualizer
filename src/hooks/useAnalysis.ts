import { useEffect, useMemo, useState } from 'react';
import { usePlaybackStore } from '../store/playbackStore';
import { getAnalysis, getAnalysisResult } from '../domain/analysisRepository';
import { loadAllManifestDatasets } from '../data/datasetLoader';
import type { RowingFrame, DerivedMetrics } from '../types/rowing';
import type { StrokeSegment } from '../types/strokeDetect';
import type { StrokeMetricRow } from '../types/analysis';
import type { VelocityResult } from '../domain/analyzers';
import type { DatasetState } from './useDataset';
import type { TrajectoryPoint } from '../utils/trajectory';

const EMPTY_STROKES: StrokeSegment[] = [];
const EMPTY_TRAJECTORY: TrajectoryPoint[] = [];
const EMPTY_STROKE_METRICS: StrokeMetricRow[] = [];
const EMPTY_MANIFEST_FRAMES: Array<{ id: string; label: string; frames: RowingFrame[] }> = [];

interface ManifestFramesState {
  manifestKey: string;
  datasets: Array<{ id: string; label: string; frames: RowingFrame[] }>;
}

export interface UseAnalysisResult {
  frames: RowingFrame[];
  trajectory: TrajectoryPoint[];
  strokes: StrokeSegment[];
  strokeMetrics: StrokeMetricRow[];
  metrics: DerivedMetrics | null;
  /** 加速度積分による速度（実測値とのフォールバック判定込み） */
  velocity: VelocityResult | null;
  allStrokeMetrics: StrokeMetricRow[] | undefined;
  hasAnyStrokes: boolean;
  loading: boolean;
  error: string | null;
}

export function useAnalysis(datasetState: DatasetState): UseAnalysisResult {
  const {
    customDatasets,
    datasets,
    setMaxFrame,
  } = usePlaybackStore();

  const frames = useMemo(() => {
    return datasetState.dataset?.frames ?? [];
  }, [datasetState.dataset]);

  // maxFrame をストアに同期（再生クランプに使用）
  useEffect(() => {
    setMaxFrame(Math.max(frames.length - 1, 0));
  }, [frames.length, setMaxFrame]);

  const analysis = useMemo(
    () => (frames.length > 0 ? getAnalysis(frames) : null),
    [frames],
  );

  // strokes は状態ではなく、データセット参照ごとにキャッシュされた導出値。
  const strokes = analysis?.strokes ?? EMPTY_STROKES;
  const trajectory = analysis?.trajectory ?? EMPTY_TRAJECTORY;
  const strokeMetrics = analysis
    ? getAnalysisResult(analysis, 'strokeMetrics') ?? EMPTY_STROKE_METRICS
    : EMPTY_STROKE_METRICS;

  // 横断分析用にマニフェストの全フレームを非同期ロード
  const [manifestFramesState, setManifestFramesState] = useState<ManifestFramesState | null>(null);
  const manifestKey = useMemo(
    () => datasetState.manifest.map(({ id, path }) => `${id}:${path}`).join('|'),
    [datasetState.manifest],
  );
  const hasCustomDatasets = Object.keys(customDatasets).length > 0;

  useEffect(() => {
    const manifest = datasetState.manifest;
    if (manifest.length === 0 || hasCustomDatasets) return;

    let cancelled = false;

    async function loadAll() {
      try {
        const results = await loadAllManifestDatasets(manifest);
        if (!cancelled) {
          setManifestFramesState({ manifestKey, datasets: results });
        }
      } catch {
        // 読み込み失敗は無視
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [datasetState.manifest, hasCustomDatasets, manifestKey]);

  const allManifestFrames = !hasCustomDatasets && manifestFramesState?.manifestKey === manifestKey
    ? manifestFramesState.datasets
    : EMPTY_MANIFEST_FRAMES;

  // 全データセット横断データを集計
  const allStrokeMetrics = useMemo<StrokeMetricRow[] | undefined>(() => {
    const customEntries = Object.entries(customDatasets);

    if (customEntries.length > 0) {
      const analyzedDatasets = customEntries
        .map(([id, data]) => {
          const datasetFrames = data.frames ?? [];
          if (datasetFrames.length < 10) return null;
          const datasetLabel = datasets.find((d) => d.id === id)?.label ?? id;
          const analysis = getAnalysis(datasetFrames);
          return {
            id,
            label: datasetLabel,
            rows: getAnalysisResult(analysis, 'strokeMetrics') ?? EMPTY_STROKE_METRICS,
          };
        })
        .filter((dataset): dataset is NonNullable<typeof dataset> => dataset !== null)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
        );
      let globalIndex = 0;
      const result = analyzedDatasets.flatMap(({ id, label, rows }) =>
        rows.map((row) => ({
          ...row,
          strokeIndex: globalIndex++,
          datasetId: id,
          datasetLabel: label,
        })),
      );
      return result.length > 0 ? result : undefined;
    }

    if (allManifestFrames.length === 0) return undefined;

    const analyzedDatasets = allManifestFrames
      .map(({ id, label, frames: mFrames }) => {
        if (mFrames.length < 10) return null;
        const analysis = getAnalysis(mFrames);
        return {
          id,
          label,
          rows: getAnalysisResult(analysis, 'strokeMetrics') ?? EMPTY_STROKE_METRICS,
        };
      })
      .filter((dataset): dataset is NonNullable<typeof dataset> => dataset !== null)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
      );
    let globalIndex = 0;
    const result = analyzedDatasets.flatMap(({ id, label, rows }) =>
      rows.map((row) => ({
        ...row,
        strokeIndex: globalIndex++,
        datasetId: id,
        datasetLabel: label,
      })),
    );
    return result.length > 0 ? result : undefined;
  }, [customDatasets, datasets, allManifestFrames]);

  const hasAnyStrokes = useMemo(() => {
    return (
      (allStrokeMetrics && allStrokeMetrics.length > 0) ||
      strokes.length > 0
    );
  }, [allStrokeMetrics, strokes]);

  const metrics = analysis?.metrics ?? null;

  // 加速度積分による速度（getAnalysis は frames 参照でキャッシュ済み）
  const velocity: VelocityResult | null = analysis
    ? getAnalysisResult(analysis, 'velocity') ?? null
    : null;

  const error =
    datasetState.error ||
    (datasets.length === 0
      ? '表示できるデータセットがありません。フォルダを選択するか、ファイルを確認してください。'
      : null);
  const loading = datasetState.loading;

  return {
    frames,
    trajectory,
    strokes,
    strokeMetrics,
    metrics,
    velocity,
    allStrokeMetrics,
    hasAnyStrokes,
    loading,
    error,
  };
}
