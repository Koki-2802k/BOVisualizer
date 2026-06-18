/**
 * viewSlice.ts — UI表示設定スライス
 *
 * 責務: oarSide / graphMode / initialOarSide / initialGraphMode /
 *       playOnSwitch / analysisMode / showStrokePhases / showStrokeMetrics の保持。
 * 他スライスへの依存なし。
 */
import type { StateCreator } from 'zustand';
import type { GraphMode } from '../../components/TimeSeriesChart';

/** 速度グラフのデータソース: 実測(GPS 1Hz) / 積分(加速度積分) */
export type SpeedSource = 'measured' | 'integrated';

export type ViewSlice = {
  oarSide: 'right' | 'left';
  graphMode: GraphMode;
  initialOarSide: 'right' | 'left';
  initialGraphMode: GraphMode;
  playOnSwitch: boolean;
  analysisMode: boolean;
  showStrokePhases: boolean;
  showStrokeMetrics: boolean;
  /** 速度グラフのソース（既定: 積分値） */
  speedSource: SpeedSource;
  setOarSide: (side: 'right' | 'left') => void;
  setGraphMode: (graphMode: GraphMode) => void;
  setInitialOarSide: (side: 'right' | 'left') => void;
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
