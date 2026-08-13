import { useState, useEffect, type InputHTMLAttributes } from 'react';
import type { DatasetManifestItem, LocalDatasetItem, RowingFrame } from '../types/rowing';
import type { GraphMode, SpeedSource } from '../types/view';
import { useLocalDatasets } from '../hooks/useLocalDatasets';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

function metricText(value: number | null, suffix = ''): string {
  if (value === null) {
    return '--';
  }
  return `${value.toFixed(1)}${suffix}`;
}

type PlaybackControlsProps = {
  datasets: DatasetManifestItem[];
  selectedDatasetId: string;
  isPlaying: boolean;
  fps: number;
  seekFrame: number;
  maxFrame: number;
  graphMode?: GraphMode;
  currentFrame?: RowingFrame | null;
  directoryHandle?: FileSystemDirectoryHandle | null;
  autoReloadEnabled?: boolean;
  autoReloadInterval?: number;
  onDatasetChange: (datasetId: string) => void;
  onPlayToggle: () => void;
  onSeekChange: (frame: number) => void;
  onFpsChange: (fps: number) => void;
  onGraphModeChange?: (graphMode: GraphMode) => void;
  onCustomDatasetsLoaded?: (items: LocalDatasetItem[]) => void;
  onDirectoryHandleChange?: (handle: FileSystemDirectoryHandle | null) => void;
  onAutoReloadEnabledChange?: (enabled: boolean) => void;
  onAutoReloadIntervalChange?: (interval: number) => void;
  initialOarSide?: 'right' | 'left';
  initialGraphMode?: GraphMode;
  onInitialOarSideChange?: (side: 'right' | 'left') => void;
  onInitialGraphModeChange?: (mode: GraphMode) => void;
  playOnSwitch?: boolean;
  onPlayOnSwitchChange?: (play: boolean) => void;
  /** 解析モード（位相帯表示）のオン/オフ */
  analysisMode?: boolean;
  /** 検出済みストローク数（トグルボタンのバッジ表示と無効化制御用） */
  strokeCount?: number;
  onAnalysisModeChange?: (enabled: boolean) => void;
  showStrokePhases?: boolean;
  onShowStrokePhasesChange?: (show: boolean) => void;
  showStrokeMetrics?: boolean;
  onShowStrokeMetricsChange?: (show: boolean) => void;
  /** 速度グラフのソース（実測値 / 加速度積分値） */
  speedSource?: SpeedSource;
  onSpeedSourceChange?: (source: SpeedSource) => void;
  /** 積分値が利用可能か（GPS アンカー >= 2）。false なら積分選択時に注記を表示 */
  speedIntegrationUsable?: boolean;
  /** リロード（手動・自動）完了時に呼ばれるコールバック */
  onReload?: () => void;
};

export default function PlaybackControls({
  datasets,
  selectedDatasetId,
  isPlaying,
  fps,
  seekFrame,
  maxFrame,
  graphMode = 'acceleration',
  currentFrame = null,
  directoryHandle = null,
  autoReloadEnabled = false,
  autoReloadInterval = 30,
  onDatasetChange,
  onPlayToggle,
  onSeekChange,
  onFpsChange,
  onGraphModeChange,
  onCustomDatasetsLoaded,
  onDirectoryHandleChange,
  onAutoReloadEnabledChange,
  onAutoReloadIntervalChange,
  initialOarSide = 'right',
  initialGraphMode = 'acceleration',
  onInitialOarSideChange,
  onInitialGraphModeChange,
  playOnSwitch = false,
  onPlayOnSwitchChange,
  analysisMode = false,
  strokeCount = 0,
  onAnalysisModeChange,
  showStrokePhases = true,
  onShowStrokePhasesChange,
  showStrokeMetrics = true,
  onShowStrokeMetricsChange,
  speedSource = 'integrated',
  onSpeedSourceChange,
  speedIntegrationUsable = true,
  onReload,
}: PlaybackControlsProps) {
  const spm = currentFrame ? toNumber(currentFrame.SPM) : null;
  const split = currentFrame ? toNumber(currentFrame.SPLIT) : null;
  const leftAngle = currentFrame ? toNumber(currentFrame.angle_left) : null;
  const rightAngle = currentFrame ? toNumber(currentFrame.angle_right) : null;

  const handleGraphModeChange = (nextMode: GraphMode) => {
    if (onGraphModeChange) {
      onGraphModeChange(nextMode);
    }
  };

  const [showOptions, setShowOptions] = useState(false);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);
  const {
    fileInputRef,
    isReloading,
    loadFileInput,
    reloadDirectory,
    selectDirectory,
  } = useLocalDatasets({
    directoryHandle,
    autoReloadEnabled,
    autoReloadIntervalSeconds: autoReloadInterval,
    onDatasetsLoaded: onCustomDatasetsLoaded,
    onDirectoryHandleChange,
    onReload,
  });

  const directoryInputProps: InputHTMLAttributes<HTMLInputElement> & {
    webkitdirectory: string;
    directory: string;
  } = {
    webkitdirectory: '',
    directory: '',
    multiple: true,
  };

  // Click outside listener for options popover
  useEffect(() => {
    if (!showOptions) return;
    const handleDocumentClick = () => {
      setShowOptions(false);
      setShowAnalysisDetails(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showOptions]);

  return (
    <section className="panel controls" aria-label="再生操作">
      <div
        className="logo-container"
        onClick={(e) => {
          e.stopPropagation();
          setShowOptions((prev) => !prev);
        }}
        title="設定オプションを表示"
      >
        <img src={`${import.meta.env.BASE_URL}BOV_logo.png`} alt="BOV logo" className="app-logo" />
        {showOptions && (
          <div className="options-popover" onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '25px', color: '#f8fafc', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '8px', textAlign: 'left', fontWeight: 600 }}>設定オプション</h4>

            <label className="option-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', cursor: 'pointer', color: '#e2e8f0', fontSize: '20px', margin: '8px 0 12px 0', minWidth: 'auto', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={autoReloadEnabled}
                onChange={(e) => onAutoReloadEnabledChange?.(e.target.checked)}
                style={{ width: '30px', height: '30px', cursor: 'pointer', margin: 0 }}
              />
              <span style={{ userSelect: 'none' }}>自動再読み込みを有効化</span>
            </label>

            <label className="option-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e2e8f0', fontSize: '20px', textAlign: 'left', minWidth: 'auto', fontWeight: 500 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
                <span style={{ userSelect: 'none' }}>再読み込み間隔</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{autoReloadInterval}秒</span>
              </div>
              <input
                type="range"
                min={2}
                max={60}
                value={autoReloadInterval}
                onChange={(e) => onAutoReloadIntervalChange?.(Number(e.target.value))}
                disabled={!autoReloadEnabled}
                style={{ width: '100%', cursor: autoReloadEnabled ? 'pointer' : 'not-allowed', opacity: autoReloadEnabled ? 1 : 0.5, margin: '6px 0 0 0', height: '30px' }}
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px', margin: '16px 0 12px 0', opacity: strokeCount === 0 ? 0.5 : 1 }}>
              <label className="option-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', cursor: strokeCount === 0 ? 'not-allowed' : 'pointer', color: '#e2e8f0', fontSize: '20px', margin: 0, minWidth: 'auto', fontWeight: 500, flexGrow: 1 }}>
                <input
                  type="checkbox"
                  checked={analysisMode}
                  onChange={(e) => {
                    onAnalysisModeChange?.(e.target.checked);
                    if (!e.target.checked) {
                      setShowAnalysisDetails(false);
                    }
                  }}
                  disabled={strokeCount === 0}
                  style={{ width: '30px', height: '30px', cursor: strokeCount === 0 ? 'not-allowed' : 'pointer', margin: 0 }}
                />
                <span style={{ userSelect: 'none' }}>解析表示を有効化 </span>
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAnalysisDetails((prev) => !prev);
                }}
                disabled={strokeCount === 0 || !analysisMode}
                style={{
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: showAnalysisDetails ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                  color: showAnalysisDetails ? '#0f172a' : '#f8fafc',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  cursor: (strokeCount === 0 || !analysisMode) ? 'not-allowed' : 'pointer',
                  padding: 0,
                  margin: 0,
                  transition: 'all 0.2s',
                  opacity: (strokeCount === 0 || !analysisMode) ? 0.5 : 1
                }}
                title="解析詳細設定を表示"
              >
                &gt;
              </button>
            </div>

            <label className="option-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e2e8f0', fontSize: '20px', textAlign: 'left', minWidth: 'auto', fontWeight: 500, margin: '8px 0 0 0' }}>
              <span style={{ userSelect: 'none' }}>初期表示オール軌跡</span>
              <select
                value={initialOarSide}
                onChange={(e) => onInitialOarSideChange?.(e.target.value as 'right' | 'left')}
                style={{
                  minHeight: '36px',
                  padding: '4px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  fontSize: '18px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                  outline: 'none',
                }}
              >
                <option value="right" style={{ backgroundColor: '#1e293b' }}>右オール</option>
                <option value="left" style={{ backgroundColor: '#1e293b' }}>左オール</option>
              </select>
            </label>

            <label className="option-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e2e8f0', fontSize: '20px', textAlign: 'left', minWidth: 'auto', fontWeight: 500, margin: '8px 0 0 0' }}>
              <span style={{ userSelect: 'none' }}>初期表示時系列グラフ</span>
              <select
                value={initialGraphMode}
                onChange={(e) => onInitialGraphModeChange?.(e.target.value as GraphMode)}
                style={{
                  minHeight: '36px',
                  padding: '4px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  fontSize: '18px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                  outline: 'none',
                }}
              >
                <option value="speed" style={{ backgroundColor: '#1e293b' }}>速度</option>
                <option value="acceleration" style={{ backgroundColor: '#1e293b' }}>加速度</option>
                <option value="gyro" style={{ backgroundColor: '#1e293b' }}>ジャイロ</option>
              </select>
            </label>

            <label className="option-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e2e8f0', fontSize: '20px', textAlign: 'left', minWidth: 'auto', fontWeight: 500, margin: '8px 0 0 0' }}>
              <span style={{ userSelect: 'none' }}>速度グラフのソース</span>
              <select
                value={speedSource}
                onChange={(e) => onSpeedSourceChange?.(e.target.value as SpeedSource)}
                style={{
                  minHeight: '36px',
                  padding: '4px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  fontSize: '18px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                  outline: 'none',
                }}
              >
                <option value="integrated" style={{ backgroundColor: '#1e293b' }}>積分値（加速度・推奨）</option>
                <option value="measured" style={{ backgroundColor: '#1e293b' }}>実測値（GPS・1Hz）</option>
              </select>
              {speedSource === 'integrated' && !speedIntegrationUsable && (
                <span style={{ fontSize: '15px', color: '#fbbf24', fontWeight: 400, lineHeight: 1.4 }}>
                  ※ GPS アンカーが不足しているため、実測値を表示しています。
                </span>
              )}
            </label>

            <label className="option-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e2e8f0', fontSize: '20px', textAlign: 'left', minWidth: 'auto', fontWeight: 500, margin: '8px 0 0 0' }}>
              <span style={{ userSelect: 'none' }}>データ切替時の再生動作</span>
              <select
                value={playOnSwitch ? 'play' : 'stop'}
                onChange={(e) => onPlayOnSwitchChange?.(e.target.value === 'play')}
                style={{
                  minHeight: '36px',
                  padding: '4px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  fontSize: '18px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  width: '100%',
                  outline: 'none',
                }}
              >
                <option value="stop" style={{ backgroundColor: '#1e293b' }}>停止</option>
                <option value="play" style={{ backgroundColor: '#1e293b' }}>開始</option>
              </select>
            </label>

            {showAnalysisDetails && (
              <div
                className="options-popover"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 'calc(100% + 12px)',
                  minWidth: '400px',
                  margin: 0
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setShowAnalysisDetails(false)}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    lineHeight: 1
                  }}
                  title="閉じる"
                >
                  ×
                </button>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '25px', color: '#f8fafc', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '8px', textAlign: 'left', fontWeight: 600 }}>解析詳細オプション</h4>

                <label className="option-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', cursor: 'pointer', color: '#e2e8f0', fontSize: '20px', margin: '8px 0', minWidth: 'auto', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={showStrokePhases}
                    onChange={(e) => onShowStrokePhasesChange?.(e.target.checked)}
                    style={{ width: '26px', height: '26px', cursor: 'pointer', margin: 0 }}
                  />
                  <span style={{ userSelect: 'none' }}>ストローク分割</span>
                </label>

                <label className="option-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', cursor: 'pointer', color: '#e2e8f0', fontSize: '20px', margin: '8px 0', minWidth: 'auto', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={showStrokeMetrics}
                    onChange={(e) => onShowStrokeMetricsChange?.(e.target.checked)}
                    style={{ width: '26px', height: '26px', cursor: 'pointer', margin: 0 }}
                  />
                  <span style={{ userSelect: 'none' }}>ストロークメトリクス</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
      <label style={{ alignItems: 'center' }}>
        <span style={{ textAlign: 'center', width: '100%' }}>データセット</span>
        <select
          className="dataset-select"
          value={selectedDatasetId}
          onChange={(event) => onDatasetChange(event.target.value)}
        >
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.label}
            </option>
          ))}
        </select>
      </label>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(event) => void loadFileInput(event)}
        style={{ display: 'none' }}
        {...directoryInputProps}
      />
      <button type="button" onClick={() => void selectDirectory()} title="CSVファイルの入ったフォルダを選択">
        フォルダ選択
      </button>

      <button type="button" onClick={onPlayToggle}>
        {isPlaying ? '停止' : '開始'}
      </button>

      <label className="seek-label">
        フレーム
        <input
          type="range"
          min={0}
          max={maxFrame}
          value={seekFrame}
          onChange={(event) => onSeekChange(Number(event.target.value))}
        />
      </label>

      <span className="frame-readout">
        {seekFrame} / {maxFrame}
      </span>

      <label className="fps-label">
        FPS
        <input
          className="fps-input"
          type="number"
          min={1}
          max={60}
          step={1}
          value={fps}
          onChange={(event) => {
            const rawVal = event.target.value;
            if (rawVal === '') {
              onFpsChange(1);
              return;
            }
            const val = Number(rawVal);
            if (val > 60) {
              onFpsChange(60);
            } else if (val < 1) {
              onFpsChange(1);
            } else {
              onFpsChange(val);
            }
          }}
        />
      </label>

      <div className="graph-mode-group" role="group" aria-label="グラフ表示モード">
        <button
          type="button"
          className={graphMode === 'speed' ? 'mode-active' : ''}
          onClick={() => handleGraphModeChange('speed')}
        >
          速度
        </button>
        <button
          type="button"
          className={graphMode === 'acceleration' ? 'mode-active' : ''}
          onClick={() => handleGraphModeChange('acceleration')}
        >
          加速度
        </button>
        <button
          type="button"
          className={graphMode === 'gyro' ? 'mode-active' : ''}
          onClick={() => handleGraphModeChange('gyro')}
        >
          ジャイロ
        </button>
      </div>

      <div className="toolbar-metrics">
        <span className="metric-item"><span className="label">SPM</span><strong>{metricText(spm)}</strong></span>
        <span className="metric-item"><span className="label">SPLIT</span><strong>{metricText(split)}</strong></span>
      </div>
      <div className="toolbar-metrics" style={{ marginLeft: 0 }}>
        <span className="metric-item oar-angle"><span className="label">左オール</span><strong>{metricText(leftAngle, '°')}</strong></span>
        <span className="metric-item oar-angle"><span className="label">右オール</span><strong>{metricText(rightAngle, '°')}</strong></span>
      </div>

      <button
        type="button"
        onClick={() => void reloadDirectory()}
        className="reload-btn"
        title="フォルダ内を再読み込み"
      >
        <img src={`${import.meta.env.BASE_URL}RELOAD.png`} alt="再読み込み" className={isReloading ? 'spinning' : ''} />
      </button>
    </section>
  );
}
