/**
 * viewSlice.ts — UI表示設定スライス
 *
 * 責務: oarSide / graphMode / initialOarSide / initialGraphMode /
 *       playOnSwitch / analysisMode / showStrokePhases / showStrokeMetrics の保持。
 * 他スライスへの依存なし。
 */
import type { StateCreator } from 'zustand';
import type { GraphMode } from '../../components/TimeSeriesChart';

export type ViewSlice = {
  oarSide: 'right' | 'left';
  graphMode: GraphMode;
  initialOarSide: 'right' | 'left';
  initialGraphMode: GraphMode;
  playOnSwitch: boolean;
  analysisMode: boolean;
  showStrokePhases: boolean;
  showStrokeMetrics: boolean;
  setOarSide: (side: 'right' | 'left') => void;
  setGraphMode: (graphMode: GraphMode) => void;
  setInitialOarSide: (side: 'right' | 'left') => void;
  setInitialGraphMode: (mode: GraphMode) => void;
  setPlayOnSwitch: (play: boolean) => void;
  setAnalysisMode: (enabled: boolean) => void;
  setShowStrokePhases: (show: boolean) => void;
  setShowStrokeMetrics: (show: boolean) => void;
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

  setOarSide: (oarSide) => set({ oarSide }),
  setGraphMode: (graphMode) => set({ graphMode }),
  setInitialOarSide: (initialOarSide) => set({ initialOarSide }),
  setInitialGraphMode: (initialGraphMode) => set({ initialGraphMode }),
  setPlayOnSwitch: (playOnSwitch) => set({ playOnSwitch }),
  setAnalysisMode: (analysisMode) => set({ analysisMode }),
  setShowStrokePhases: (showStrokePhases) => set({ showStrokePhases }),
  setShowStrokeMetrics: (showStrokeMetrics) => set({ showStrokeMetrics }),
});
