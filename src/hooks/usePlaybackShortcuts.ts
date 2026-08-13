import { useEffect } from 'react';
import type { DatasetManifestItem } from '../types/rowing';
import type { StrokeSegment } from '../types/strokeDetect';
import type { DashboardPanelId } from '../types/view';
import { seekByPhase } from '../utils/strokeDetect';

interface PlaybackShortcutOptions {
  datasets: DatasetManifestItem[];
  selectedDatasetId: string;
  isPlaying: boolean;
  currentFrame: number;
  strokes: StrokeSegment[];
  expandedPanel: DashboardPanelId | null;
  onDatasetChange: (datasetId: string) => void;
  onExpandedPanelChange: (panel: DashboardPanelId | null) => void;
  onPlayChange: (isPlaying: boolean) => void;
  onSeekChange: (frame: number) => void;
}

const isFormControl = (element: Element | null): boolean =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLButtonElement;

export function usePlaybackShortcuts({
  datasets,
  selectedDatasetId,
  isPlaying,
  currentFrame,
  strokes,
  expandedPanel,
  onDatasetChange,
  onExpandedPanelChange,
  onPlayChange,
  onSeekChange,
}: PlaybackShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormControl(document.activeElement)) return;

      if (event.code === 'Escape' && expandedPanel) {
        event.preventDefault();
        onExpandedPanelChange(null);
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        onPlayChange(!isPlaying);
        return;
      }

      if (event.shiftKey && (event.code === 'ArrowRight' || event.code === 'ArrowLeft')) {
        event.preventDefault();
        onSeekChange(seekByPhase(strokes, currentFrame, event.code === 'ArrowRight' ? 1 : -1));
        return;
      }

      if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return;
      event.preventDefault();
      const currentIndex = datasets.findIndex(({ id }) => id === selectedDatasetId);
      const offset = event.code === 'ArrowRight' ? 1 : -1;
      const adjacentDataset = datasets[currentIndex + offset];
      if (adjacentDataset) onDatasetChange(adjacentDataset.id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentFrame,
    datasets,
    expandedPanel,
    isPlaying,
    onDatasetChange,
    onExpandedPanelChange,
    onPlayChange,
    onSeekChange,
    selectedDatasetId,
    strokes,
  ]);
}
