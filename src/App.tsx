import { useEffect, lazy, Suspense, useState, useRef, useCallback } from 'react';
import PlaybackControls from './components/PlaybackControls';
import ErrorBoundary from './components/ErrorBoundary';
import { useAnimationClock } from './hooks/useAnimationClock';
import { useDataset } from './hooks/useDataset';
import { usePlaybackStore } from './store/playbackStore';
import { seekByPhase } from './utils/strokeDetect';
import { useAnalysis } from './hooks/useAnalysis';
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
    analysisMode,
    showStrokePhases,
    showStrokeMetrics,
    setDatasets,
    setSelectedDatasetId,
    setIsPlaying,
    setFps,
    setSeekFrame,
    setGraphMode,
    setCustomDatasets,
    setDirectoryHandle,
    setAutoReloadEnabled,
    setAutoReloadInterval,
    setInitialOarSide,
    setInitialGraphMode,
    setPlayOnSwitch,
    setAnalysisMode,
    setShowStrokePhases,
    setShowStrokeMetrics,
  } = usePlaybackStore();

  const datasetState = useDataset(selectedDatasetId);

  const {
    frames,
    strokes,
    metrics,
    allDatasetsData,
    hasAnyStrokes,
    loading,
    error,
  } = useAnalysis(datasetState);

  useEffect(() => {
    const customCount = Object.keys(customDatasets).length;
    if (customCount === 0 && datasetState.manifest.length > 0) {
      setDatasets(datasetState.manifest);
    }
  }, [datasetState.manifest, setDatasets, customDatasets]);

  // ファイルが増減したときにスナップショットをクリアし、グラフを最新状態に再構築する
  useEffect(() => {
    setMetricsSnapshot(null);
  }, [datasets.length, Object.keys(customDatasets).length]);

  const { uiFrame } = useAnimationClock({
    frameCount: frames.length,
    fps,
    isPlaying,
    seekFrame,
  });

  const [activeTimeseriesTab, setActiveTimeseriesTab] = useState<'chart' | 'metrics'>('chart');
  const [activeMapTab, setActiveMapTab] = useState<'map'>('map');
  const [activeSceneTab, setActiveSceneTab] = useState<'scene'>('scene');
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  // メトリクステーブル用スナップショット（リロード時のみ更新）
  type MetricsSnapshot = {
    frames: typeof frames;
    strokes: typeof strokes;
    allDatasetsData: typeof allDatasetsData;
  };
  const [metricsSnapshot, setMetricsSnapshot] = useState<MetricsSnapshot | null>(null);
  // 最新の frames/strokes/allDatasetsData を ref に保持（コールバック内で stale closure を防ぐ）
  const latestAnalysisRef = useRef({ frames, strokes, allDatasetsData });
  useEffect(() => {
    latestAnalysisRef.current = { frames, strokes, allDatasetsData };
  });

  // リロード（手動・自動）完了時にスナップショットを更新するコールバック
  const handleReload = useCallback(() => {
    const { frames: f, strokes: s, allDatasetsData: a } = latestAnalysisRef.current;
    setMetricsSnapshot({ frames: f, strokes: s, allDatasetsData: a });
  }, []);

  // スナップショット未作成時はリアルタイムの値を初期値として使用
  const snapshotFrames = metricsSnapshot?.frames ?? frames;
  const snapshotStrokes = metricsSnapshot?.strokes ?? strokes;
  const snapshotAllDatasetsData = metricsSnapshot?.allDatasetsData ?? allDatasetsData;

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

      // Esc でフィーチャーパネルを閉じる
      if (event.code === 'Escape') {
        if (expandedPanel) {
          event.preventDefault();
          setExpandedPanel(null);
        }
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
  }, [isPlaying, setIsPlaying, datasets, selectedDatasetId, setSelectedDatasetId, strokes, uiFrame, setSeekFrame, expandedPanel, setExpandedPanel]);

  const currentFrame = frames[uiFrame] ?? null;

  // パネル拡大・縮小ハンドラ
  const handleExpandPanel = (panelId: string) => setExpandedPanel(panelId);
  const handleCloseExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPanel(null);
  };

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
        onReload={handleReload}
      />
      <div className="dashboard-area">
        {error ? (
          <div className="panel overlay-message error">データ読み込み失敗: {error}</div>
        ) : null}
        {loading ? (
          <div className="panel overlay-message loading">データ読み込み中...</div>
        ) : null}
        <section className={`dashboard-grid${expandedPanel ? ' has-featured' : ''}`} aria-label="統合ダッシュボード">
          <section className={`panel scene-wrapper${expandedPanel === 'scene' ? ' panel-featured' : ''}`} aria-label="3Dシーン">
            {expandedPanel === 'scene' && (
              <button className="panel-close-btn" onClick={handleCloseExpanded} title="元の画面に戻す">✕</button>
            )}
            <ErrorBoundary fallbackTitle="3D表示エラー">
              {/* 3Dシーンパネルヘッダー（横線付き・常時表示・タブ対応） */}
              <div style={{ ...panelHeaderStyle, paddingBottom: 0 }} onDoubleClick={() => handleExpandPanel('scene')}>
                <button
                  type="button"
                  className={`timeseries-tab-btn ${activeSceneTab === 'scene' ? 'active' : ''}`}
                  onClick={() => setActiveSceneTab('scene')}
                >
                  3Dグラフ
                </button>
              </div>
              <div className="tab-content-wrapper">
                <Suspense fallback={<div className="overlay-message loading">3D表示を読み込み中...</div>}>
                  {activeSceneTab === 'scene' && (
                    <Scene frames={frames} frameIndex={uiFrame} />
                  )}
                </Suspense>
              </div>
            </ErrorBoundary>
          </section>

          <section className={`panel oar-wrapper${expandedPanel === 'oar' ? ' panel-featured' : ''}`} aria-label="オール軌跡">
            {expandedPanel === 'oar' && (
              <button className="panel-close-btn" onClick={handleCloseExpanded} title="元の画面に戻す">✕</button>
            )}
            <ErrorBoundary fallbackTitle="軌跡表示エラー">
              {/* オール軌跡パネルヘッダー（左オール・右オールタブ切り替え） */}
              <div style={{ ...panelHeaderStyle, paddingBottom: 0 }} onDoubleClick={() => handleExpandPanel('oar')}>
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
              <div className="tab-content-wrapper">
                <Suspense fallback={<div className="overlay-message loading">オール軌跡を読み込み中...</div>}>
                  <OarTrajectoryChart
                    key={`oar-${expandedPanel ?? 'none'}`}
                    frames={frames}
                    currentIndex={uiFrame}
                  />
                </Suspense>
              </div>
            </ErrorBoundary>
          </section>

          <section className={`panel map-wrapper${expandedPanel === 'map' ? ' panel-featured' : ''}`} aria-label="地図">
            {expandedPanel === 'map' && (
              <button className="panel-close-btn" onClick={handleCloseExpanded} title="元の画面に戻す">✕</button>
            )}
            <ErrorBoundary fallbackTitle="地図表示エラー">
              {/* GPS地図パネルヘッダー（横線付き・常時表示・タブ対応） */}
              <div style={{ ...panelHeaderStyle, paddingBottom: 0 }} onDoubleClick={() => handleExpandPanel('map')}>
                <button
                  type="button"
                  className={`timeseries-tab-btn ${activeMapTab === 'map' ? 'active' : ''}`}
                  onClick={() => setActiveMapTab('map')}
                >
                  GPS地図
                </button>
              </div>
              <div className="tab-content-wrapper">
                <Suspense fallback={<div className="overlay-message loading">地図を読み込み中...</div>}>
                  {activeMapTab === 'map' && (
                    <RowingMap
                      key={`map-${expandedPanel ?? 'none'}`}
                      gpsPoints={metrics?.gpsValidPoints && metrics.gpsValidPoints.length > 0
                        ? metrics.gpsValidPoints
                        : []}
                      frameIndex={uiFrame}
                    />
                  )}
                </Suspense>
              </div>
            </ErrorBoundary>
          </section>

          <section className={`panel timeseries-wrapper${expandedPanel === 'timeseries' ? ' panel-featured' : ''}`} aria-label="時系列グラフ・メトリクス">
            {expandedPanel === 'timeseries' && (
              <button className="panel-close-btn" onClick={handleCloseExpanded} title="元の画面に戻す">✕</button>
            )}
            <ErrorBoundary fallbackTitle="表示エラー">
              {/* 時系列パネルヘッダー（横線付き・常時表示） */}
              <div style={{ ...panelHeaderStyle, paddingBottom: 0 }} onDoubleClick={() => handleExpandPanel('timeseries')}>
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
              <div className="tab-content-wrapper">
                <Suspense fallback={<div className="overlay-message loading">表示データを読み込み中...</div>}>
                  {activeTimeseriesTab === 'chart' ? (
                    <TimeSeriesChart
                      key={`ts-${expandedPanel ?? 'none'}`}
                      frames={frames}
                      currentIndex={uiFrame}
                      mode={graphMode}
                      strokes={strokes}
                      analysisMode={analysisMode}
                      showStrokePhases={showStrokePhases}
                    />
                  ) : (
                    <StrokeMetricsTable
                      frames={snapshotFrames}
                      strokes={snapshotStrokes}
                      currentIndex={uiFrame}
                      allDatasetsData={snapshotAllDatasetsData}
                      isExpanded={expandedPanel === 'timeseries'}
                    />
                  )}
                </Suspense>
              </div>
            </ErrorBoundary>
          </section>
        </section>
      </div>
    </main>
  );
}

export default App;
