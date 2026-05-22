import { useEffect, useMemo } from 'react';
import Scene from './components/Scene';
import PlaybackControls from './components/PlaybackControls';
import OarTrajectoryChart from './components/OarTrajectoryChart';
import TimeSeriesChart from './components/TimeSeriesChart';
import RowingMap from './components/RowingMap';
import ErrorBoundary from './components/ErrorBoundary';
import { useAnimationClock } from './hooks/useAnimationClock';
import { useDataset } from './hooks/useDataset';
import { usePlaybackStore } from './store/playbackStore';
import { deriveMetrics } from './utils/metrics';
import './App.css';
import './index.css';

function App() {
  const {
    datasets,
    customDatasets,
    selectedDatasetId,
    isPlaying,
    fps,
    seekFrame,
    maxFrame,
    graphMode,
    directoryHandle,
    autoReloadEnabled,
    autoReloadInterval,
    initialOarSide,
    initialGraphMode,
    setDatasets,
    setSelectedDatasetId,
    setIsPlaying,
    setFps,
    setSeekFrame,
    setMaxFrame,
    setGraphMode,
    setCustomDatasets,
    setDirectoryHandle,
    setAutoReloadEnabled,
    setAutoReloadInterval,
    setInitialOarSide,
    setInitialGraphMode,
  } = usePlaybackStore();

  const datasetState = useDataset(selectedDatasetId);

  const isCustom = selectedDatasetId in customDatasets;
  const frames = useMemo(() => {
    if (isCustom) {
      return customDatasets[selectedDatasetId]?.frames ?? [];
    }
    return datasetState.dataset?.frames ?? [];
  }, [isCustom, selectedDatasetId, customDatasets, datasetState.dataset]);

  useEffect(() => {
    const customCount = Object.keys(customDatasets).length;
    if (customCount === 0 && datasetState.manifest.length > 0) {
      setDatasets(datasetState.manifest);
    }
  }, [datasetState.manifest, setDatasets, customDatasets]);

  useEffect(() => {
    setMaxFrame(Math.max(frames.length - 1, 0));
  }, [frames.length, setMaxFrame]);

  const { uiFrame } = useAnimationClock({
    frameCount: frames.length,
    fps,
    isPlaying,
    seekFrame,
  });

  // Global Spacebar shortcut to play/pause & Arrow keys to change datasets
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setIsPlaying(!isPlaying);
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault();
        if (!datasets || datasets.length <= 1) {
          return;
        }
        const currentIndex = datasets.findIndex((d) => d.id === selectedDatasetId);
        if (currentIndex !== -1 && currentIndex < datasets.length - 1) {
          const nextDataset = datasets[currentIndex + 1];
          if (nextDataset && nextDataset.id) {
            setSelectedDatasetId(nextDataset.id);
          }
        }
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        if (!datasets || datasets.length <= 1) {
          return;
        }
        const currentIndex = datasets.findIndex((d) => d.id === selectedDatasetId);
        if (currentIndex > 0) {
          const prevDataset = datasets[currentIndex - 1];
          if (prevDataset && prevDataset.id) {
            setSelectedDatasetId(prevDataset.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, setIsPlaying, datasets, selectedDatasetId, setSelectedDatasetId]);

  const currentFrame = frames[uiFrame] ?? null;
  
  const activeDataset = isCustom ? customDatasets[selectedDatasetId] : datasetState.dataset;
  const metrics = useMemo(
    () => (activeDataset ? deriveMetrics(activeDataset) : null),
    [activeDataset],
  );

  const error = !isCustom
    ? datasetState.error
    : (datasets.length === 0 ? '表示できるデータセットがありません。フォルダを選択するか、ファイルを確認してください。' : null);
  const loading = !isCustom ? datasetState.loading : false;

  return (
    <main className="app-shell">
      <PlaybackControls
        datasets={datasets}
        selectedDatasetId={selectedDatasetId}
        isPlaying={isPlaying}
        fps={fps}
        seekFrame={uiFrame}
        maxFrame={maxFrame}
        graphMode={graphMode}
        currentFrame={currentFrame}
        directoryHandle={directoryHandle}
        autoReloadEnabled={autoReloadEnabled}
        autoReloadInterval={autoReloadInterval}
        onDatasetChange={setSelectedDatasetId}
        onPlayToggle={() => setIsPlaying(!isPlaying)}
        onSeekChange={setSeekFrame}
        onFpsChange={setFps}
        onGraphModeChange={setGraphMode}
        onCustomDatasetsLoaded={setCustomDatasets}
        onDirectoryHandleChange={setDirectoryHandle}
        onAutoReloadEnabledChange={setAutoReloadEnabled}
        onAutoReloadIntervalChange={setAutoReloadInterval}
        initialOarSide={initialOarSide}
        initialGraphMode={initialGraphMode}
        onInitialOarSideChange={setInitialOarSide}
        onInitialGraphModeChange={setInitialGraphMode}
      />
      <div className="dashboard-area">
        {error ? (
          <div className="panel overlay-message error">データ読み込み失敗: {error}</div>
        ) : null}
        {loading ? (
          <div className="panel overlay-message loading">データ読み込み中...</div>
        ) : null}
        <section className="dashboard-grid" aria-label="統合ダッシュボード">
          <section className="panel scene-wrapper" aria-label="3Dシーン">
            <ErrorBoundary fallbackTitle="3D表示エラー">
              <Scene frames={frames} frameIndex={uiFrame} />
            </ErrorBoundary>
          </section>
          <section className="panel oar-wrapper" aria-label="オール軌跡">
            <ErrorBoundary fallbackTitle="軌跡表示エラー">
              <OarTrajectoryChart frames={frames} currentIndex={uiFrame} />
            </ErrorBoundary>
          </section>
          <section className="panel map-wrapper" aria-label="地図">
            <ErrorBoundary fallbackTitle="地図表示エラー">
              {metrics?.gpsValidPoints && metrics.gpsValidPoints.length > 0 ? (
                <>
                  <h3>GPS地図</h3>
                  <RowingMap gpsPoints={metrics.gpsValidPoints} frameIndex={uiFrame} />
                </>
              ) : (
                <RowingMap gpsPoints={[]} frameIndex={uiFrame} />
              )}
            </ErrorBoundary>
          </section>
          <section className="panel timeseries-wrapper" aria-label="時系列グラフ">
            <ErrorBoundary fallbackTitle="時系列表示エラー">
              <TimeSeriesChart frames={frames} currentIndex={uiFrame} mode={graphMode} />
            </ErrorBoundary>
          </section>
        </section>
      </div>
    </main>
  );
}

export default App;
