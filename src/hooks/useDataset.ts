import { useEffect, useState } from 'react';
import type { DatasetCsv, DatasetManifestItem } from '../types/rowing';
import { usePlaybackStore } from '../store/playbackStore';
import { fetchManifest, fetchDatasetCsv } from '../data/datasetLoader';

export interface DatasetState {
  manifest: DatasetManifestItem[];
  dataset: DatasetCsv | null;
  loading: boolean;
  error: string | null;
}

type ManifestLoadState =
  | { status: 'loading'; manifest: DatasetManifestItem[]; error: null }
  | { status: 'ready'; manifest: DatasetManifestItem[]; error: null }
  | { status: 'error'; manifest: DatasetManifestItem[]; error: string };

interface RemoteDatasetLoadState {
  datasetId: string;
  dataset: DatasetCsv | null;
  error: string | null;
}

export function useDataset(selectedDatasetId: string): DatasetState {
  const { customDatasets } = usePlaybackStore();
  const [manifestState, setManifestState] = useState<ManifestLoadState>({
    status: 'loading',
    manifest: [],
    error: null,
  });
  const [remoteDatasetState, setRemoteDatasetState] = useState<RemoteDatasetLoadState | null>(null);

  // マニフェストリストの初回読み込み
  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        const manifest = await fetchManifest();
        if (!cancelled) setManifestState({ status: 'ready', manifest, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'manifest load failed';
        if (!cancelled) setManifestState({ status: 'error', manifest: [], error: message });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const customDataset = customDatasets[selectedDatasetId] ?? null;
  const remoteTarget = manifestState.manifest.find((item) => item.id === selectedDatasetId)
    ?? manifestState.manifest[0]
    ?? null;

  // 選択されたマニフェストデータセットの読み込み。カスタム選択中はメモリ値を直接返す。
  useEffect(() => {
    if (customDataset || !remoteTarget) return;

    let cancelled = false;
    async function run(): Promise<void> {
      try {
        const dataset = await fetchDatasetCsv(remoteTarget);
        if (!cancelled) {
          setRemoteDatasetState({ datasetId: remoteTarget.id, dataset, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setRemoteDatasetState({
            datasetId: remoteTarget.id,
            dataset: null,
            error: err instanceof Error ? err.message : 'dataset load failed',
          });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [customDataset, remoteTarget]);

  if (customDataset) {
    return {
      manifest: manifestState.manifest,
      dataset: customDataset,
      loading: false,
      error: null,
    };
  }

  if (manifestState.status !== 'ready' || !remoteTarget) {
    return {
      manifest: manifestState.manifest,
      dataset: null,
      loading: manifestState.status === 'loading',
      error: manifestState.error,
    };
  }

  const remoteReady = remoteDatasetState?.datasetId === remoteTarget.id;
  return {
    manifest: manifestState.manifest,
    dataset: remoteReady ? remoteDatasetState.dataset : null,
    loading: !remoteReady,
    error: remoteReady ? remoteDatasetState.error : null,
  };
}
