/**
 * viewSlice.ts — UI表示設定スライス
 *
 * 責務: oarSide / graphMode / initialOarSide / initialGraphMode /
 *       playOnSwitch / analysisMode / showStrokePhases / showStrokeMetrics の保持。
 * 他スライスへの依存なし。
 */
import type { StateCreator } from 'zustand';
import type { GraphMode, OarSide, SpeedSource } from '../../types/view';

export type { SpeedSource } from '../../types/view';

export type ViewSlice = {
  oarSide: OarSide;
  graphMode: GraphMode;
  initialOarSide: OarSide;
  initialGraphMode: GraphMode;
  playOnSwitch: boolean;
  analysisMode: boolean;
  showStrokePhases: boolean;
  showStrokeMetrics: boolean;
  /** 速度グラフのソース（既定: 積分値） */
  speedSource: SpeedSource;
  setOarSide: (side: OarSide) => void;
  setGraphMode: (graphMode: GraphMode) => void;
  setInitialOarSide: (side: OarSide) => void;
  setInitialGraphMode: (mode: GraphMode) => void;
  setPlayOnSwitch: (play: boolean) => void;
  setAnalysisMode: (enabled: boolean) => void;
  setShowStrokePhases: (show: boolean) => void;
  setShowStrokeMetrics: (show: boolean) => void;
  setSpeedSource: (source: SpeedSource) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createViewSlice: StateCreator<any, [], [], ViewSlice> = (set) => ({
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
