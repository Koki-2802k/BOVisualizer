import { useEffect, useMemo, lazy, Suspense, useState } from 'react';
import PlaybackControls from './components/PlaybackControls';
import ErrorBoundary from './components/ErrorBoundary';
import { useAnimationClock } from './hooks/useAnimationClock';
import { useDataset } from './hooks/useDataset';
import { usePlaybackStore } from './store/playbackStore';
import { deriveMetrics } from './utils/metrics';
import { detectStrokes, seekByPhase } from './utils/strokeDetect';
import { parseRowingCsv } from './utils/csvParser';
import type { RowingFrame } from './types/rowing';
import type { DatasetStrokeData } from './components/StrokeMetricsTable';
import './App.css';
import './index.css';

const Scene = lazy(() => import('./components/Scene'));
const OarTrajectoryChart = lazy(() => import('./components/OarTrajectoryChart'));
const TimeSeriesChart = lazy(() => import('./components/TimeSeriesChart'));
const RowingMap = lazy(() => import('./components/RowingMap'));
const StrokeMetricsTable = lazy(() => import('./components/StrokeMetricsTable'));


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
    oarSide,
    setOarSide,
    playOnSwitch,
    strokes,
    analysisMode,
    showStrokePhases,
    showStrokeMetrics,
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
    setPlayOnSwitch,
    setStrokes,
    setAnalysisMode,
    setShowStrokePhases,
    setShowStrokeMetrics,
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

  // 現在選択中のデータセットのストロークを再検出する
  useEffect(() => {
    if (frames.length < 10) {
      setStrokes([]);
      return;
    }
    const detected = detectStrokes(frames);
    setStrokes(detected);
  }, [frames, setStrokes]);

  // マニフェストの全データセットを非同期で読み込んでキャッシュする
  // （カスタムデータセット未使用時のメトリクス全件表示に使用）
  const [allManifestFrames, setAllManifestFrames] = useState<
    Array<{ id: string; label: string; frames: RowingFrame[] }>
  >([]);

  useEffect(() => {
    const manifest = datasetState.manifest;
    if (manifest.length === 0) return;

    // カスタムデータセット使用中はマニフェスト一括読み込みをスキップ
    if (Object.keys(customDatasets).length > 0) {
      setAllManifestFrames([]);
      return;
    }

    let cancelled = false;

    async function loadAllManifest() {
      const results: Array<{ id: string; label: string; frames: RowingFrame[] }> = [];
      for (const item of manifest) {
        try {
          const path = item.path.startsWith('/') ? item.path.slice(1) : item.path;
          const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
          if (!response.ok) continue;
          const csv = await response.text();
          if (cancelled) return;
          const parsed = parseRowingCsv(csv);
          results.push({ id: item.id, label: item.label, frames: parsed.frames ?? [] });
        } catch {
          // 読み込み失敗はスキップ
        }
      }
      if (!cancelled) {
        setAllManifestFrames(results);
      }
    }

    void loadAllManifest();
    return () => {
      cancelled = true;
    };
  }, [datasetState.manifest, customDatasets]);

  // 全データセット横断ストロークデータ
  // カスタムデータセット使用時はそこから、未使用時はマニフェスト全件から生成
  const allDatasetsData = useMemo<DatasetStrokeData[] | undefined>(() => {
    const customEntries = Object.entries(customDatasets);

    if (customEntries.length > 0) {
      // カスタムデータセット（フォルダ読み込み）モード
      const result = customEntries
        .map(([id, data]) => {
          const datasetFrames = data.frames ?? [];
          if (datasetFrames.length < 10) return null;
          const datasetLabel = datasets.find((d) => d.id === id)?.label ?? id;
          const datasetStrokes = detectStrokes(datasetFrames);
          return { id, label: datasetLabel, frames: datasetFrames, strokes: datasetStrokes };
        })
        .filter((d): d is DatasetStrokeData => d !== null)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
        );
      return result.length > 0 ? result : undefined;
    }

    // マニフェストデータセットモード
    if (allManifestFrames.length === 0) return undefined;

    const result = allManifestFrames
      .map(({ id, label, frames: mFrames }) => {
        if (mFrames.length < 10) return null;
        const datasetStrokes = detectStrokes(mFrames);
        return { id, label, frames: mFrames, strokes: datasetStrokes };
      })
      .filter((d): d is DatasetStrokeData => d !== null)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
      );
    return result.length > 0 ? result : undefined;
  }, [customDatasets, datasets, allManifestFrames]);

  // ストロークが1件でもあるかどうか（メトリクスタブ表示判定）
  const hasAnyStrokes =
    (allDatasetsData && allDatasetsData.some((d) => d.strokes.length > 0)) ||
    strokes.length > 0;

  const { uiFrame } = useAnimationClock({
    frameCount: frames.length,
    fps,
    isPlaying,
    seekFrame,
  });

  const [activeTimeseriesTab, setActiveTimeseriesTab] = useState<'chart' | 'metrics'>('chart');
  const [activeMapTab, setActiveMapTab] = useState<'map'>('map');
  const [activeSceneTab, setActiveSceneTab] = useState<'scene'>('scene');

  // メトリクスタブが使えない状態になったら強制的にグラフタブへ戻す
  useEffect(() => {
    if (!analysisMode || !showStrokeMetrics || !hasAnyStrokes) {
      setActiveTimeseriesTab('chart');
    }
  }, [analysisMode, showStrokeMetrics, hasAnyStrokes]);


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

      // Shift + ← / → : 前後の位相へシーク
      if (event.shiftKey && event.code === 'ArrowRight') {
        event.preventDefault();
        const nextFrame = seekByPhase(strokes, uiFrame, +1);
        setSeekFrame(nextFrame);
        return;
      }
      if (event.shiftKey && event.code === 'ArrowLeft') {
        event.preventDefault();
        const nextFrame = seekByPhase(strokes, uiFrame, -1);
        setSeekFrame(nextFrame);
        return;
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
  }, [isPlaying, setIsPlaying, datasets, selectedDatasetId, setSelectedDatasetId, strokes, uiFrame, setSeekFrame]);

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

  // パネルヘッダー共通スタイル（横線付き）
  const panelHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #cbd5e1',
    paddingBottom: '4px',
    marginBottom: '6px',
    flexShrink: 0,
  };



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
        playOnSwitch={playOnSwitch}
        onPlayOnSwitchChange={setPlayOnSwitch}
        analysisMode={analysisMode}
        strokeCount={strokes.length}
        onAnalysisModeChange={setAnalysisMode}
        showStrokePhases={showStrokePhases}
        onShowStrokePhasesChange={setShowStrokePhases}
        showStrokeMetrics={showStrokeMetrics}
        onShowStrokeMetricsChange={setShowStrokeMetrics}
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
              <Suspense fallback={<div className="panel overlay-message loading">3D表示を読み込み中...</div>}>
                {/* 3Dシーンパネルヘッダー（横線付き・常時表示・タブ対応） */}
                <div style={{ ...panelHeaderStyle, paddingBottom: 0 }}>
                  <button
                    type="button"
                    className={`timeseries-tab-btn ${activeSceneTab === 'scene' ? 'active' : ''}`}
                    onClick={() => setActiveSceneTab('scene')}
                  >
                    3Dグラフ
                  </button>
                </div>
                {activeSceneTab === 'scene' && (
                  <Scene frames={frames} frameIndex={uiFrame} />
                )}
              </Suspense>
            </ErrorBoundary>
          </section>

          <section className="panel oar-wrapper" aria-label="オール軌跡">
            <ErrorBoundary fallbackTitle="軌跡表示エラー">
              <Suspense fallback={<div className="panel overlay-message loading">オール軌跡を読み込み中...</div>}>
                {/* オール軌跡パネルヘッダー（左オール・右オールタブ切り替え） */}
                <div style={{ ...panelHeaderStyle, paddingBottom: 0 }}>
                  <button
                    type="button"
                    className={`timeseries-tab-btn ${oarSide === 'left' ? 'active' : ''}`}
                    onClick={() => setOarSide('left')}
                  >
                    左オール
                  </button>
                  <button
                    type="button"
                    className={`timeseries-tab-btn ${oarSide === 'right' ? 'active' : ''}`}
                    onClick={() => setOarSide('right')}
                  >
                    右オール
                  </button>
                </div>
                <OarTrajectoryChart frames={frames} currentIndex={uiFrame} />
              </Suspense>
            </ErrorBoundary>
          </section>

          <section className="panel map-wrapper" aria-label="地図">
            <ErrorBoundary fallbackTitle="地図表示エラー">
              <Suspense fallback={<div className="panel overlay-message loading">地図を読み込み中...</div>}>
                {/* GPS地図パネルヘッダー（横線付き・常時表示・タブ対応） */}
                <div style={{ ...panelHeaderStyle, paddingBottom: 0 }}>
                  <button
                    type="button"
                    className={`timeseries-tab-btn ${activeMapTab === 'map' ? 'active' : ''}`}
                    onClick={() => setActiveMapTab('map')}
                  >
                    GPS地図
                  </button>
                </div>
                {activeMapTab === 'map' && (
                  <RowingMap
                    gpsPoints={metrics?.gpsValidPoints && metrics.gpsValidPoints.length > 0
                      ? metrics.gpsValidPoints
                      : []}
                    frameIndex={uiFrame}
                  />
                )}
              </Suspense>
            </ErrorBoundary>
          </section>

          <section className="panel timeseries-wrapper" aria-label="時系列グラフ・メトリクス">
            <ErrorBoundary fallbackTitle="表示エラー">
              <Suspense fallback={<div className="panel overlay-message loading">表示データを読み込み中...</div>}>
                {/* 時系列パネルヘッダー（横線付き・常時表示） */}
                <div style={{ ...panelHeaderStyle, paddingBottom: 0 }}>
                  <button
                    type="button"
                    className={`timeseries-tab-btn ${activeTimeseriesTab === 'chart' ? 'active' : ''}`}
                    onClick={() => setActiveTimeseriesTab('chart')}
                  >
                    時系列グラフ
                  </button>
                  {analysisMode && showStrokeMetrics && hasAnyStrokes && (
                    <button
                      type="button"
                      className={`timeseries-tab-btn ${activeTimeseriesTab === 'metrics' ? 'active' : ''}`}
                      onClick={() => setActiveTimeseriesTab('metrics')}
                    >
                      メトリクス
                    </button>
                  )}
                </div>

                {activeTimeseriesTab === 'chart' ? (
                  <TimeSeriesChart
                    frames={frames}
                    currentIndex={uiFrame}
                    mode={graphMode}
                    strokes={strokes}
                    analysisMode={analysisMode}
                    showStrokePhases={showStrokePhases}
                  />
                ) : (
                  <StrokeMetricsTable
                    frames={frames}
                    strokes={strokes}
                    currentIndex={uiFrame}
                    allDatasetsData={allDatasetsData}
                  />
                )}
              </Suspense>
            </ErrorBoundary>
          </section>
        </section>
      </div>
    </main>
  );
}

export default App;
