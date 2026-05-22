import { useEffect, useState } from 'react';
import type { DatasetCsv, DatasetManifest, DatasetManifestItem } from '../types/rowing';
import { parseRowingCsv } from '../utils/csvParser';

type DatasetState = {
  manifest: DatasetManifestItem[];
  dataset: DatasetCsv | null;
  loading: boolean;
  error: string | null;
};

export function useDataset(selectedDatasetId: string): DatasetState {
  const [manifest, setManifest] = useState<DatasetManifestItem[]>([]);
  const [dataset, setDataset] = useState<DatasetCsv | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`);
        if (!response.ok) {
          throw new Error(`manifest fetch failed: ${response.status}`);
        }
        const json = (await response.json()) as DatasetManifest;
        if (cancelled) {
          return;
        }
        if (!json || !Array.isArray(json.datasets) || json.datasets.length === 0) {
          throw new Error('マニフェストファイルに有効なデータセットが定義されていません。');
        }
        setManifest(json.datasets);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'manifest load failed';
        setError(message);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (manifest.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function run(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const target = manifest.find((item) => item.id === selectedDatasetId) ?? manifest[0];
        if (!target) {
          throw new Error('dataset not found');
        }
        const path = target.path.startsWith('/') ? target.path.slice(1) : target.path;
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) {
          throw new Error(`dataset fetch failed: ${response.status}`);
        }
        const csv = await response.text();
        if (cancelled) {
          return;
        }
        setDataset(parseRowingCsv(csv));
        setLoading(false);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'dataset load failed';
        setError(message);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [manifest, selectedDatasetId]);

  return { manifest, dataset, loading, error };
}
