/**
 * viewSlice.ts — UI表示設定スライス
 *
 * 責務: oarSide / graphMode / initialOarSide / initialGraphMode /
 *       playOnSwitch / analysisMode / showStrokePhases / showStrokeMetrics の保持。
 * 他スライスへの依存なし。
 */
import type { StateCreator } from 'zustand';
import type { PlaybackState, ViewSlice } from '../types';

export type { SpeedSource } from '../../types/view';

export const createViewSlice: StateCreator<PlaybackState, [], [], ViewSlice> = (set) => ({
  oarSide: 'right',
  graphMode: 'acceleration',
  initialOarSide: 'right',
  initialGraphMode: 'acceleration',
  playOnSwitch: false,
  analysisMode: true,
  showStrokePhases: true,
  showStrokeMetrics: true,
  speedSource: 'integrated',

  setOarSide: (oarSide) => set({ oarSide }),
  setGraphMode: (graphMode) => set({ graphMode }),
  setInitialOarSide: (initialOarSide) => set({ initialOarSide }),
  setInitialGraphMode: (initialGraphMode) => set({ initialGraphMode }),
  setPlayOnSwitch: (playOnSwitch) => set({ playOnSwitch }),
  setAnalysisMode: (analysisMode) => set({ analysisMode }),
  setShowStrokePhases: (showStrokePhases) => set({ showStrokePhases }),
  setShowStrokeMetrics: (showStrokeMetrics) => set({ showStrokeMetrics }),
  setSpeedSource: (speedSource) => set({ speedSource }),
});
