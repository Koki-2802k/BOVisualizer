import { useEffect, useMemo, useState } from 'react';
import { usePlaybackStore } from '../store/playbackStore';
import { detectStrokes } from '../utils/strokeDetect';
import { deriveMetrics } from '../utils/metrics';
import { getAnalysis } from '../domain/analysisRepository';
import { loadAllManifestDatasets } from '../data/datasetLoader';
import type { RowingFrame, DerivedMetrics } from '../types/rowing';
import type { DatasetStrokeData } from '../components/StrokeMetricsTable';

export interface UseAnalysisResult {
  frames: RowingFrame[];
  strokes: any[]; // StrokeSegment[]
  metrics: DerivedMetrics | null;
  allDatasetsData: DatasetStrokeData[] | undefined;
  hasAnyStrokes: boolean;
  loading: boolean;
  error: string | null;
}

export function useAnalysis(datasetState: any): UseAnalysisResult {
  const {
    customDatasets,
    datasets,
    strokes,
    setStrokes,
    setMaxFrame,
  } = usePlaybackStore();

  const frames = useMemo(() => {
    return datasetState.dataset?.frames ?? [];
  }, [datasetState.dataset]);

  // Sync maxFrame to store when frames length changes
  useEffect(() => {
    setMaxFrame(Math.max(frames.length - 1, 0));
  }, [frames.length, setMaxFrame]);

  // Sync strokes to store when frames change
  useEffect(() => {
    if (frames.length < 10) {
      setStrokes([]);
      return;
    }
    const detected = detectStrokes(frames);
    setStrokes(detected);
  }, [frames, setStrokes]);

  // Load manifest frames asynchronously for horizontal analysis
  const [allManifestFrames, setAllManifestFrames] = useState<
    Array<{ id: string; label: string; frames: RowingFrame[] }>
  >([]);

  useEffect(() => {
    const manifest = datasetState.manifest;
    if (manifest.length === 0) return;

    // Skip async manifest load if using custom datasets
    if (Object.keys(customDatasets).length > 0) {
      setAllManifestFrames([]);
      return;
    }

    let cancelled = false;

    async function loadAll() {
      try {
        const results = await loadAllManifestDatasets(manifest);
        if (!cancelled) {
          setAllManifestFrames(results);
        }
      } catch {
        // ignore load failures
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [datasetState.manifest, customDatasets]);

  // Compile allDatasetsData
  const allDatasetsData = useMemo<DatasetStrokeData[] | undefined>(() => {
    const customEntries = Object.entries(customDatasets);

    if (customEntries.length > 0) {
      const result = customEntries
        .map(([id, data]) => {
          const datasetFrames = data.frames ?? [];
          if (datasetFrames.length < 10) return null;
          const datasetLabel = datasets.find((d) => d.id === id)?.label ?? id;
          const analysis = getAnalysis(datasetFrames);
          return { id, label: datasetLabel, frames: datasetFrames, strokes: analysis.strokes };
        })
        .filter((d): d is DatasetStrokeData => d !== null)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
        );
      return result.length > 0 ? result : undefined;
    }

    if (allManifestFrames.length === 0) return undefined;

    const result = allManifestFrames
      .map(({ id, label, frames: mFrames }) => {
        if (mFrames.length < 10) return null;
        const analysis = getAnalysis(mFrames);
        return { id, label, frames: mFrames, strokes: analysis.strokes };
      })
      .filter((d): d is DatasetStrokeData => d !== null)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
      );
    return result.length > 0 ? result : undefined;
  }, [customDatasets, datasets, allManifestFrames]);

  const hasAnyStrokes = useMemo(() => {
    return (
      (allDatasetsData && allDatasetsData.some((d) => d.strokes.length > 0)) ||
      strokes.length > 0
    );
  }, [allDatasetsData, strokes]);

  const activeDataset = datasetState.dataset;
  const metrics = useMemo(
    () => (activeDataset ? deriveMetrics(activeDataset) : null),
    [activeDataset],
  );

  const error = datasetState.error || (datasets.length === 0 ? '表示できるデータセットがありません。フォルダを選択するか、ファイルを確認してください。' : null);
  const loading = datasetState.loading;

  return {
    frames,
    strokes,
    metrics,
    allDatasetsData,
    hasAnyStrokes,
    loading,
    error,
  };
}
