import type { DatasetCsv, DatasetManifestItem } from '../types/rowing';
import type { GraphMode, OarSide, SpeedSource } from '../types/view';

export interface PlaybackSlice {
  isPlaying: boolean;
  fps: number;
  seekFrame: number;
  maxFrame: number;
  setIsPlaying: (isPlaying: boolean) => void;
  setFps: (fps: number) => void;
  setSeekFrame: (seekFrame: number) => void;
  setMaxFrame: (maxFrame: number) => void;
}

export interface CustomDatasetInput {
  id: string;
  label: string;
  data: DatasetCsv;
}

export interface DatasetSlice {
  datasets: DatasetManifestItem[];
  selectedDatasetId: string;
  customDatasets: Record<string, DatasetCsv>;
  directoryHandle: FileSystemDirectoryHandle | null;
  autoReloadEnabled: boolean;
  autoReloadInterval: number;
  setDatasets: (datasets: DatasetManifestItem[]) => void;
  setSelectedDatasetId: (datasetId: string) => void;
  addCustomDataset: (id: string, label: string, data: DatasetCsv) => void;
  setCustomDatasets: (items: CustomDatasetInput[]) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setAutoReloadEnabled: (enabled: boolean) => void;
  setAutoReloadInterval: (interval: number) => void;
}

export interface ViewSlice {
  oarSide: OarSide;
  graphMode: GraphMode;
  initialOarSide: OarSide;
  initialGraphMode: GraphMode;
  playOnSwitch: boolean;
  analysisMode: boolean;
  showStrokePhases: boolean;
  showStrokeMetrics: boolean;
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
}

export type PlaybackState = PlaybackSlice & DatasetSlice & ViewSlice;
