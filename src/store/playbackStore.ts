/**
 * playbackStore.ts — 合成ストア
 *
 * 3 つのスライスを結合した単一の Zustand ストアを公開する。
 * 各スライスの責務:
 *   PlaybackSlice  … isPlaying / fps / seekFrame / maxFrame
 *   DatasetSlice   … datasets / selectedDatasetId / customDatasets / directoryHandle / autoReload
 *   ViewSlice      … oarSide / graphMode / initialOarSide / initialGraphMode /
 *                    playOnSwitch / analysisMode / showStrokePhases / showStrokeMetrics
 *
 * ※ strokes は「状態」ではなく frames からの「導出値」のため、
 *    ストアから除外し useAnalysis.ts 内の useMemo で算出する。
 */
import { create } from 'zustand';
import { createPlaybackSlice } from './slices/playbackSlice';
import { createDatasetSlice } from './slices/datasetSlice';
import { createViewSlice } from './slices/viewSlice';
import type { PlaybackState } from './types';

export type {
  CustomDatasetInput,
  DatasetSlice,
  PlaybackSlice,
  PlaybackState,
  ViewSlice,
} from './types';

export const usePlaybackStore = create<PlaybackState>()((...args) => ({
  ...createPlaybackSlice(...args),
  ...createDatasetSlice(...args),
  ...createViewSlice(...args),
}));
