import { useEffect, useState } from 'react';
import type { DatasetCsv, DatasetManifestItem } from '../types/rowing';
import { usePlaybackStore } from '../store/playbackStore';
import { fetchManifest, fetchDatasetCsv } from '../data/datasetLoader';

type DatasetState = {
  manifest: DatasetManifestItem[];
  dataset: DatasetCsv | null;
  loading: boolean;
  error: string | null;
};

export function useDataset(selectedDatasetId: string): DatasetState {
  const { customDatasets } = usePlaybackStore();
  const [manifest, setManifest] = useState<DatasetManifestItem[]>([]);
  const [dataset, setDataset] = useState<DatasetCsv | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // マニフェストリストの初回読み込み
  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const datasets = await fetchManifest();
        if (cancelled) {
          return;
        }
        setManifest(datasets);
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

  // 選択されたデータセットの読み込み（カスタムまたはマニフェスト）
  useEffect(() => {
    // カスタムデータセットが選択されている場合は、メモリから即座に取得して終了
    if (selectedDatasetId in customDatasets) {
      setDataset(customDatasets[selectedDatasetId]);
      setLoading(false);
      setError(null);
      return;
    }

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
        const data = await fetchDatasetCsv(target);
        if (cancelled) {
          return;
        }
        setDataset(data);
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
  }, [manifest, selectedDatasetId, customDatasets]);

  return { manifest, dataset, loading, error };
}
