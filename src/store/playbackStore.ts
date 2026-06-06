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
import { createPlaybackSlice, type PlaybackSlice } from './slices/playbackSlice';
import { createDatasetSlice, type DatasetSlice } from './slices/datasetSlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';

export type { PlaybackSlice } from './slices/playbackSlice';
export type { DatasetSlice } from './slices/datasetSlice';
export type { ViewSlice } from './slices/viewSlice';

/** 合成された全状態の型 */
export type PlaybackState = PlaybackSlice & DatasetSlice & ViewSlice;

export const usePlaybackStore = create<PlaybackState>()((...args) => ({
  ...createPlaybackSlice(...args),
  ...createDatasetSlice(...args),
  ...createViewSlice(...args),
}));
