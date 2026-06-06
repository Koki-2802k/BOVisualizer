import { useEffect, useMemo, useState } from 'react';
import { usePlaybackStore } from '../store/playbackStore';
import { detectStrokes } from '../utils/strokeDetect';
import { deriveMetrics } from '../utils/metrics';
import { parseRowingCsv } from '../utils/csvParser';
import { getAnalysis } from '../domain/analysisRepository';
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
    selectedDatasetId,
    customDatasets,
    datasets,
    strokes,
    setStrokes,
    setMaxFrame,
  } = usePlaybackStore();

  const isCustom = selectedDatasetId in customDatasets;

  const frames = useMemo(() => {
    if (isCustom) {
      return customDatasets[selectedDatasetId]?.frames ?? [];
    }
    return datasetState.dataset?.frames ?? [];
  }, [isCustom, selectedDatasetId, customDatasets, datasetState.dataset]);

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

    async function loadAllManifest() {
      const results: Array<{ id: string; label: string; frames: RowingFrame[] }> = [];
      for (const item of manifest) {
        try {
          const path = item.path.startsWith('/') ? item.path.slice(1) : item.path;
          const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
          if (!response.ok) continue;
          const csv = await response.text();
          if (cancelled) return;
          const parsed = parseRowingCsv(csv);
          results.push({ id: item.id, label: item.label, frames: parsed.frames ?? [] });
        } catch {
          // ignore load failures
        }
      }
      if (!cancelled) {
        setAllManifestFrames(results);
      }
    }

    void loadAllManifest();
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

  const activeDataset = isCustom ? customDatasets[selectedDatasetId] : datasetState.dataset;
  const metrics = useMemo(
    () => (activeDataset ? deriveMetrics(activeDataset) : null),
    [activeDataset],
  );

  const error = !isCustom
    ? datasetState.error
    : datasets.length === 0
    ? '表示できるデータセットがありません。フォルダを選択するか、ファイルを確認してください。'
    : null;
  const loading = !isCustom ? datasetState.loading : false;

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
