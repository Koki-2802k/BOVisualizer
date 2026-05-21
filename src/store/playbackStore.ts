import { create } from 'zustand';
import type { DatasetCsv, DatasetManifestItem } from '../types/rowing';
import type { GraphMode } from '../components/TimeSeriesChart';

type PlaybackState = {
  datasets: DatasetManifestItem[];
  customDatasets: Record<string, DatasetCsv>;
  selectedDatasetId: string;
  isPlaying: boolean;
  fps: number;
  seekFrame: number;
  maxFrame: number;
  graphMode: GraphMode;
  setDatasets: (datasets: DatasetManifestItem[]) => void;
  setSelectedDatasetId: (datasetId: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setFps: (fps: number) => void;
  setSeekFrame: (seekFrame: number) => void;
  setMaxFrame: (maxFrame: number) => void;
  setGraphMode: (graphMode: GraphMode) => void;
  addCustomDataset: (id: string, label: string, data: DatasetCsv) => void;
  setCustomDatasets: (items: Array<{ id: string; label: string; data: DatasetCsv }>) => void;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  datasets: [],
  customDatasets: {},
  selectedDatasetId: '',
  isPlaying: false,
  fps: 30, // Default changed to 30 fps
  seekFrame: 0,
  maxFrame: 0,
  graphMode: 'acceleration',
  setDatasets: (datasets) => {
    const nextSelected = get().selectedDatasetId || datasets[0]?.id || '';
    set({
      datasets,
      selectedDatasetId: datasets.some((dataset) => dataset.id === nextSelected)
        ? nextSelected
        : datasets[0]?.id || '',
    });
  },
  setSelectedDatasetId: (selectedDatasetId) => set({ selectedDatasetId, seekFrame: 0, isPlaying: false }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setFps: (fps) => set({ fps: clamp(Math.round(fps), 1, 120) }),
  setSeekFrame: (seekFrame) => {
    const maxFrame = get().maxFrame;
    set({ seekFrame: clamp(Math.round(seekFrame), 0, maxFrame) });
  },
  setMaxFrame: (maxFrame) => {
    const safeMax = Math.max(0, Math.round(maxFrame));
    set({ maxFrame: safeMax, seekFrame: clamp(get().seekFrame, 0, safeMax) });
  },
  setGraphMode: (graphMode) => set({ graphMode }),
  addCustomDataset: (id, label, data) => {
    const newItem: DatasetManifestItem = {
      id,
      label,
      path: `custom://${id}`,
    };
    const currentDatasets = get().datasets;
    const nextDatasets = currentDatasets.some((item) => item.id === id)
      ? currentDatasets
      : [...currentDatasets, newItem];

    set((state) => ({
      datasets: nextDatasets,
      customDatasets: {
        ...state.customDatasets,
        [id]: data,
      },
      selectedDatasetId: id,
      seekFrame: 0,
      isPlaying: false,
    }));
  },
  setCustomDatasets: (items) => {
    const nextManifestItems: DatasetManifestItem[] = items.map((item) => ({
      id: item.id,
      label: item.label,
      path: `custom://${item.id}`,
    }));
    
    const nextCustomDatasets: Record<string, DatasetCsv> = {};
    items.forEach((item) => {
      nextCustomDatasets[item.id] = item.data;
    });

    set({
      datasets: nextManifestItems,
      customDatasets: nextCustomDatasets,
      selectedDatasetId: items[0]?.id || '',
      seekFrame: 0,
      isPlaying: false,
    });
  },
}));
