import { useCallback, useState } from 'react';
import type { StrokeMetricRow } from '../types/analysis';

interface MetricsSnapshot {
  collectionKey: string;
  strokeMetrics: StrokeMetricRow[];
  allStrokeMetrics: StrokeMetricRow[] | undefined;
}

interface MetricsSnapshotInput {
  collectionKey: string;
  strokeMetrics: StrokeMetricRow[];
  allStrokeMetrics: StrokeMetricRow[] | undefined;
}

export function useMetricsSnapshot({
  collectionKey,
  strokeMetrics,
  allStrokeMetrics,
}: MetricsSnapshotInput) {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);

  const captureSnapshot = useCallback(() => {
    setSnapshot({ collectionKey, strokeMetrics, allStrokeMetrics });
  }, [allStrokeMetrics, collectionKey, strokeMetrics]);

  const activeSnapshot = snapshot?.collectionKey === collectionKey ? snapshot : null;
  return {
    captureSnapshot,
    snapshotStrokeMetrics: activeSnapshot?.strokeMetrics ?? strokeMetrics,
    snapshotAllStrokeMetrics: activeSnapshot?.allStrokeMetrics ?? allStrokeMetrics,
  };
}
