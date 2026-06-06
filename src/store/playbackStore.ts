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
  directoryHandle: FileSystemDirectoryHandle | null;
  autoReloadEnabled: boolean;
  autoReloadInterval: number;
  initialOarSide: 'right' | 'left';
  initialGraphMode: GraphMode;
  oarSide: 'right' | 'left';
  playOnSwitch: boolean;
  setDatasets: (datasets: DatasetManifestItem[]) => void;
  setSelectedDatasetId: (datasetId: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setFps: (fps: number) => void;
  setSeekFrame: (seekFrame: number) => void;
  setMaxFrame: (maxFrame: number) => void;
  setGraphMode: (graphMode: GraphMode) => void;
  setInitialOarSide: (side: 'right' | 'left') => void;
  setInitialGraphMode: (mode: GraphMode) => void;
  setOarSide: (side: 'right' | 'left') => void;
  setPlayOnSwitch: (play: boolean) => void;
  addCustomDataset: (id: string, label: string, data: DatasetCsv) => void;
  setCustomDatasets: (items: Array<{ id: string; label: string; data: DatasetCsv }>) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setAutoReloadEnabled: (enabled: boolean) => void;
  setAutoReloadInterval: (interval: number) => void;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const sortDatasets = (datasets: DatasetManifestItem[]): DatasetManifestItem[] => {
  return [...datasets].sort((a, b) => {
    const cmp = a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) {
      return cmp;
    }
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  datasets: [],
  customDatasets: {},
  selectedDatasetId: '',
  isPlaying: false,
  fps: 30, // Default changed to 30 fps
  seekFrame: 0,
  maxFrame: 0,
  graphMode: 'acceleration',
  directoryHandle: null,
  initialOarSide: 'right',
  initialGraphMode: 'acceleration',
  oarSide: 'right',
  playOnSwitch: false,
  setInitialOarSide: (initialOarSide) => set({ initialOarSide }),
  setInitialGraphMode: (initialGraphMode) => set({ initialGraphMode }),
  setOarSide: (oarSide) => set({ oarSide }),
  setPlayOnSwitch: (playOnSwitch) => set({ playOnSwitch }),
  setDatasets: (datasets) => {
    const sorted = sortDatasets(datasets);
    const nextSelected = get().selectedDatasetId || sorted[0]?.id || '';
    const changed = get().selectedDatasetId !== nextSelected;
    set({
      datasets: sorted,
      selectedDatasetId: sorted.some((dataset) => dataset.id === nextSelected)
        ? nextSelected
        : sorted[0]?.id || '',
      ...(changed && {
        oarSide: get().initialOarSide,
        graphMode: get().initialGraphMode,
        isPlaying: get().playOnSwitch,
      }),
    });
  },
  setSelectedDatasetId: (selectedDatasetId) =>
    set({
      selectedDatasetId,
      seekFrame: 0,
      isPlaying: get().playOnSwitch,
      oarSide: get().initialOarSide,
      graphMode: get().initialGraphMode,
    }),
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
      : sortDatasets([...currentDatasets, newItem]);

    set((state) => ({
      datasets: nextDatasets,
      customDatasets: {
        ...state.customDatasets,
        [id]: data,
      },
      selectedDatasetId: id,
      seekFrame: 0,
      isPlaying: state.playOnSwitch,
      oarSide: state.initialOarSide,
      graphMode: state.initialGraphMode,
    }));
  },
  setCustomDatasets: (items) => {
    const nextManifestItems: DatasetManifestItem[] = items.map((item) => ({
      id: item.id,
      label: item.label,
      path: `custom://${item.id}`,
    }));
    const sorted = sortDatasets(nextManifestItems);
    
    const nextCustomDatasets: Record<string, DatasetCsv> = {};
    items.forEach((item) => {
      nextCustomDatasets[item.id] = item.data;
    });

    const prevSelected = get().selectedDatasetId;
    const hasPrev = sorted.some((d) => d.id === prevSelected);

    set({
      datasets: sorted,
      customDatasets: nextCustomDatasets,
      selectedDatasetId: hasPrev ? prevSelected : (sorted[0]?.id || ''),
      seekFrame: hasPrev ? get().seekFrame : 0,
      isPlaying: hasPrev ? get().isPlaying : get().playOnSwitch,
      ...(!hasPrev && {
        oarSide: get().initialOarSide,
        graphMode: get().initialGraphMode,
      }),
    });
  },
  setDirectoryHandle: (directoryHandle) => set({ directoryHandle }),
  autoReloadEnabled: false,
  autoReloadInterval: 30,
  setAutoReloadEnabled: (autoReloadEnabled) => set({ autoReloadEnabled }),
  setAutoReloadInterval: (autoReloadInterval) => set({ autoReloadInterval: clamp(autoReloadInterval, 2, 60) }),
}));
