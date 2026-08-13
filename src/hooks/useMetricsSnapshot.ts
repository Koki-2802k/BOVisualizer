import { useCallback, useState } from 'react';
import type { DatasetStrokeData } from '../types/analysis';
import type { RowingFrame } from '../types/rowing';
import type { StrokeSegment } from '../types/strokeDetect';

interface MetricsSnapshot {
  collectionKey: string;
  frames: RowingFrame[];
  strokes: StrokeSegment[];
  allDatasetsData: DatasetStrokeData[] | undefined;
}

interface MetricsSnapshotInput {
  collectionKey: string;
  frames: RowingFrame[];
  strokes: StrokeSegment[];
  allDatasetsData: DatasetStrokeData[] | undefined;
}

export function useMetricsSnapshot({
  collectionKey,
  frames,
  strokes,
  allDatasetsData,
}: MetricsSnapshotInput) {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);

  const captureSnapshot = useCallback(() => {
    setSnapshot({ collectionKey, frames, strokes, allDatasetsData });
  }, [allDatasetsData, collectionKey, frames, strokes]);

  const activeSnapshot = snapshot?.collectionKey === collectionKey ? snapshot : null;
  return {
    captureSnapshot,
    snapshotFrames: activeSnapshot?.frames ?? frames,
    snapshotStrokes: activeSnapshot?.strokes ?? strokes,
    snapshotAllDatasetsData: activeSnapshot?.allDatasetsData ?? allDatasetsData,
  };
}
