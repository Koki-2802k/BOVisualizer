/**
 * datasetSlice.ts — データセット管理スライス
 *
 * 責務: datasets / selectedDatasetId / customDatasets / directoryHandle /
 *       autoReloadEnabled / autoReloadInterval の保持と操作。
 *
 * データセット切り替え時には再生状態・View設定のリセットが必要なため、
 * get() を通じて他スライスの状態を読み取り、set() で横断更新を行う。
 */
import type { StateCreator } from 'zustand';
import type { DatasetCsv, DatasetManifestItem } from '../../types/rowing';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sortDatasets = (datasets: DatasetManifestItem[]): DatasetManifestItem[] =>
  [...datasets].sort((a, b) => {
    const cmp = a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
  });

export type DatasetSlice = {
  datasets: DatasetManifestItem[];
  selectedDatasetId: string;
  customDatasets: Record<string, DatasetCsv>;
  directoryHandle: FileSystemDirectoryHandle | null;
  autoReloadEnabled: boolean;
  autoReloadInterval: number;
  setDatasets: (datasets: DatasetManifestItem[]) => void;
  setSelectedDatasetId: (datasetId: string) => void;
  addCustomDataset: (id: string, label: string, data: DatasetCsv) => void;
  setCustomDatasets: (items: Array<{ id: string; label: string; data: DatasetCsv }>) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setAutoReloadEnabled: (enabled: boolean) => void;
  setAutoReloadInterval: (interval: number) => void;
};

/** get() で取得する他スライスの状態（型安全のため最小限を定義） */
type CrossSliceState = {
  seekFrame: number;
  isPlaying: boolean;
  oarSide: 'right' | 'left';
  graphMode: string;
  initialOarSide: 'right' | 'left';
  initialGraphMode: string;
  playOnSwitch: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createDatasetSlice: StateCreator<any, [], [], DatasetSlice> = (set, get) => ({
  datasets: [],
  selectedDatasetId: '',
  customDatasets: {},
  directoryHandle: null,
  autoReloadEnabled: false,
  autoReloadInterval: 30,

  setDatasets: (datasets) => {
    const sorted = sortDatasets(datasets);
    const { selectedDatasetId, initialOarSide, initialGraphMode, playOnSwitch } =
      get() as DatasetSlice & CrossSliceState;
    const nextSelected = selectedDatasetId || sorted[0]?.id || '';
    const hasNext = sorted.some((d) => d.id === nextSelected);
    const changed = selectedDatasetId !== nextSelected;
    set({
      datasets: sorted,
      selectedDatasetId: hasNext ? nextSelected : sorted[0]?.id || '',
      ...(changed && {
        oarSide: initialOarSide,
        graphMode: initialGraphMode,
        isPlaying: playOnSwitch,
      }),
    });
  },

  setSelectedDatasetId: (selectedDatasetId) => {
    const { initialOarSide, initialGraphMode, playOnSwitch } = get() as CrossSliceState;
    set({
      selectedDatasetId,
      seekFrame: 0,
      isPlaying: playOnSwitch,
      oarSide: initialOarSide,
      graphMode: initialGraphMode,
    });
  },

  addCustomDataset: (id, label, data) => {
    const { datasets, customDatasets, initialOarSide, initialGraphMode, playOnSwitch } =
      get() as DatasetSlice & CrossSliceState;
    const newItem: DatasetManifestItem = { id, label, path: `custom://${id}` };
    const nextDatasets = datasets.some((item) => item.id === id)
      ? datasets
      : sortDatasets([...datasets, newItem]);
    set({
      datasets: nextDatasets,
      customDatasets: { ...customDatasets, [id]: data },
      selectedDatasetId: id,
      seekFrame: 0,
      isPlaying: playOnSwitch,
      oarSide: initialOarSide,
      graphMode: initialGraphMode,
    });
  },

  setCustomDatasets: (items) => {
    const { selectedDatasetId, seekFrame, isPlaying, initialOarSide, initialGraphMode, playOnSwitch } =
      get() as DatasetSlice & CrossSliceState;
    const sorted = sortDatasets(
      items.map((item) => ({ id: item.id, label: item.label, path: `custom://${item.id}` })),
    );
    const nextCustomDatasets: Record<string, DatasetCsv> = {};
    items.forEach((item) => { nextCustomDatasets[item.id] = item.data; });
    const hasPrev = sorted.some((d) => d.id === selectedDatasetId);
    set({
      datasets: sorted,
      customDatasets: nextCustomDatasets,
      selectedDatasetId: hasPrev ? selectedDatasetId : sorted[0]?.id || '',
      seekFrame: hasPrev ? seekFrame : 0,
      isPlaying: hasPrev ? isPlaying : playOnSwitch,
      ...(!hasPrev && {
        oarSide: initialOarSide,
        graphMode: initialGraphMode,
      }),
    });
  },

  setDirectoryHandle: (directoryHandle) => set({ directoryHandle }),
  setAutoReloadEnabled: (autoReloadEnabled) => set({ autoReloadEnabled }),
  setAutoReloadInterval: (autoReloadInterval) =>
    set({ autoReloadInterval: clamp(autoReloadInterval, 2, 60) }),
});
