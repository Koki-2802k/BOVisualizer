import { describe, expect, it } from 'vitest';
import { usePlaybackStore } from '../store/playbackStore';

describe('usePlaybackStore - Dataset Sorting', () => {
  it('sorts datasets naturally by sample number in labels', () => {
    const store = usePlaybackStore.getState();
    
    const unsorted = [
      { id: 'sample_10', label: 'サンプル 10', path: '/data/samples/sample_10.csv' },
      { id: 'sample_2', label: 'サンプル 2', path: '/data/samples/sample_2.csv' },
      { id: 'sample_1', label: 'サンプル 1', path: '/data/samples/sample_1.csv' },
      { id: 'sample_11', label: 'サンプル 11', path: '/data/samples/sample_11.csv' },
    ];
    
    store.setDatasets(unsorted);
    
    const sorted = usePlaybackStore.getState().datasets;
    expect(sorted.map(d => d.id)).toEqual([
      'sample_1',
      'sample_2',
      'sample_10',
      'sample_11',
    ]);
  });

  it('sorts custom datasets naturally when loaded', () => {
    const store = usePlaybackStore.getState();
    
    const mockCustomItems = [
      { id: 'local-sample_10.csv', label: '📂 sample_10.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_3.csv', label: '📂 sample_3.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_1.csv', label: '📂 sample_1.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
    ];
    
    store.setCustomDatasets(mockCustomItems);
    
    const sorted = usePlaybackStore.getState().datasets;
    expect(sorted.map(d => d.label)).toEqual([
      '📂 sample_1.csv',
      '📂 sample_3.csv',
      '📂 sample_10.csv',
    ]);
  });
});

describe('usePlaybackStore - Dataset Reload & Selection Persist', () => {
  it('keeps the selected dataset on reload if it still exists', () => {
    const store = usePlaybackStore.getState();
    
    const initialItems = [
      { id: 'local-sample_1.csv', label: '📂 sample_1.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_3.csv', label: '📂 sample_3.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
    ];
    
    store.setCustomDatasets(initialItems);
    store.setSelectedDatasetId('local-sample_3.csv');
    expect(usePlaybackStore.getState().selectedDatasetId).toBe('local-sample_3.csv');
    
    // Reload with same + new datasets
    const reloadedItems = [
      { id: 'local-sample_1.csv', label: '📂 sample_1.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_2.csv', label: '📂 sample_2.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_3.csv', label: '📂 sample_3.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
    ];
    
    store.setCustomDatasets(reloadedItems);
    expect(usePlaybackStore.getState().selectedDatasetId).toBe('local-sample_3.csv');
  });

  it('reverts to the naturally first dataset if the previously selected dataset is removed', () => {
    const store = usePlaybackStore.getState();
    
    const initialItems = [
      { id: 'local-sample_1.csv', label: '📂 sample_1.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_3.csv', label: '📂 sample_3.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
    ];
    
    store.setCustomDatasets(initialItems);
    store.setSelectedDatasetId('local-sample_3.csv');
    
    // Reload where sample_3.csv is deleted
    const reloadedItems = [
      { id: 'local-sample_1.csv', label: '📂 sample_1.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
      { id: 'local-sample_2.csv', label: '📂 sample_2.csv', data: { headers: [], frames: [], meta: { measurementMode: 'unknown', totalFrames: 0 } } },
    ];
    
    store.setCustomDatasets(reloadedItems);
    // Should fallback to sample_1.csv (the first in natural order)
    expect(usePlaybackStore.getState().selectedDatasetId).toBe('local-sample_1.csv');
  });
});

describe('usePlaybackStore - Initial Defaults and Reset Behavior', () => {
  it('initializes with right oar side and acceleration mode', () => {
    const store = usePlaybackStore.getState();
    expect(store.initialOarSide).toBe('right');
    expect(store.initialGraphMode).toBe('acceleration');
    expect(store.oarSide).toBe('right');
    expect(store.graphMode).toBe('acceleration');
  });

  it('updates initial default options and resets active modes when new dataset is selected', () => {
    const store = usePlaybackStore.getState();

    // 1. Change initial defaults
    store.setInitialOarSide('left');
    store.setInitialGraphMode('gyro');
    expect(usePlaybackStore.getState().initialOarSide).toBe('left');
    expect(usePlaybackStore.getState().initialGraphMode).toBe('gyro');

    // 2. Select a dataset
    store.setSelectedDatasetId('some-new-dataset');

    // 3. Active selections should reset to the new defaults
    expect(usePlaybackStore.getState().oarSide).toBe('left');
    expect(usePlaybackStore.getState().graphMode).toBe('gyro');

    // 4. Manually change active selection during play
    store.setOarSide('right');
    store.setGraphMode('speed');
    expect(usePlaybackStore.getState().oarSide).toBe('right');
    expect(usePlaybackStore.getState().graphMode).toBe('speed');

    // 5. Select a different dataset, active selection should reset back to defaults
    store.setSelectedDatasetId('another-dataset');
    expect(usePlaybackStore.getState().oarSide).toBe('left');
    expect(usePlaybackStore.getState().graphMode).toBe('gyro');
  });
});

