import { useRef, useState, useEffect } from 'react';
import type { DatasetCsv, DatasetManifestItem, RowingFrame } from '../types/rowing';
import type { GraphMode } from './TimeSeriesChart';
import { parseRowingCsv } from '../utils/csvParser';

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
  onCustomDatasetsLoaded?: (items: Array<{ id: string; label: string; data: DatasetCsv }>) => void;
  onDirectoryHandleChange?: (handle: FileSystemDirectoryHandle | null) => void;
  onAutoReloadEnabledChange?: (enabled: boolean) => void;
  onAutoReloadIntervalChange?: (interval: number) => void;
  initialOarSide?: 'right' | 'left';
  initialGraphMode?: GraphMode;
  onInitialOarSideChange?: (side: 'right' | 'left') => void;
  onInitialGraphModeChange?: (mode: GraphMode) => void;
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
}: PlaybackControlsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const spm = currentFrame ? toNumber(currentFrame.SPM) : null;
  const split = currentFrame ? toNumber(currentFrame.SPLIT) : null;
  const leftAngle = currentFrame ? toNumber(currentFrame.angle_left) : null;
  const rightAngle = currentFrame ? toNumber(currentFrame.angle_right) : null;

  const handleGraphModeChange = (nextMode: GraphMode) => {
    if (onGraphModeChange) {
      onGraphModeChange(nextMode);
    }
  };

  const loadFromDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
    try {
      const loadedDatasets: Array<{ id: string; label: string; data: DatasetCsv }> = [];

      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.csv')) {
          try {
            const file = await entry.getFile();
            const text = await file.text();
            const parsed = parseRowingCsv(text);
            const customId = `local-${file.name}`;
            const label = `📂 ${file.name}`;
            loadedDatasets.push({ id: customId, label, data: parsed });
          } catch (fileErr) {
            console.warn(`Failed to read file "${entry.name}", skipping:`, fileErr);
          }
        }
      }

      if (loadedDatasets.length === 0) {
        alert('選択されたフォルダにCSVファイルが見つかりませんでした。');
        if (onCustomDatasetsLoaded) {
          onCustomDatasetsLoaded([]);
        }
        return;
      }

      const hasSampleCsv = loadedDatasets.some(
        (item) => item.label.toLowerCase().includes('sample_')
      );
      if (!hasSampleCsv) {
        alert('【注意】選択されたフォルダ内に "sample_*.csv" のパターンに合致するファイルが見つかりませんでした。');
      }

      if (onCustomDatasetsLoaded) {
        onCustomDatasetsLoaded(loadedDatasets);
      }
    } catch (err) {
      console.error('Failed to load from directory handle:', err);
      alert(`フォルダの読み込みに失敗しました:\n${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSelectFolderClick = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        if (onDirectoryHandleChange) {
          onDirectoryHandleChange(handle);
        }
        await loadFromDirectoryHandle(handle);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Directory picker failed, falling back to input:', err);
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleReloadClick = async () => {
    if (directoryHandle) {
      try {
        const options = { mode: 'read' as const };
        if (await (directoryHandle as any).queryPermission(options) !== 'granted') {
          if (await (directoryHandle as any).requestPermission(options) !== 'granted') {
            alert('フォルダの読み取り権限が拒否されたため、再読み込みできませんでした。');
            return;
          }
        }
        await loadFromDirectoryHandle(directoryHandle);
        triggerSpin();
      } catch (err) {
        console.error('Reload directory failed:', err);
        alert(`再読み込みに失敗しました:\n${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      alert('自動再読み込みがサポートされていないか、フォルダがまだ選択されていません。再度フォルダを選択してください。');
      fileInputRef.current?.click();
    }
  };

  const handleFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const csvFiles = Array.from(files).filter(
      (file) => file.name.toLowerCase().endsWith('.csv')
    );

    if (csvFiles.length === 0) {
      alert('選択されたフォルダにCSVファイルが見つかりませんでした。');
      if (onCustomDatasetsLoaded) {
        onCustomDatasetsLoaded([]);
      }
      return;
    }

    const hasSampleCsv = csvFiles.some(
      (file) => file.name.toLowerCase().startsWith('sample_')
    );
    if (!hasSampleCsv) {
      alert('【注意】選択されたフォルダ内に "sample_*.csv" のパターンに合致するファイルが見つかりませんでした。');
    }

    const loadedDatasets: Array<{ id: string; label: string; data: DatasetCsv }> = [];

    for (const file of csvFiles) {
      try {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

        const parsed = parseRowingCsv(text);
        const customId = `local-${file.name}`;
        const label = `📂 ${file.name}`;

        loadedDatasets.push({ id: customId, label, data: parsed });
      } catch (err) {
        console.error(`File load failed: ${file.name}`, err);
        alert(`ファイル "${file.name}" の読み込みに失敗しました:\n${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (loadedDatasets.length > 0 && onCustomDatasetsLoaded) {
      onCustomDatasetsLoaded(loadedDatasets);
    }

    event.target.value = '';
  };

  const [showOptions, setShowOptions] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  const triggerSpin = () => {
    setIsSpinning(true);
    setTimeout(() => {
      setIsSpinning(false);
    }, 600);
  };

  // Background Auto-Reload Effect
  useEffect(() => {
    if (!autoReloadEnabled || !directoryHandle) {
      return;
    }

    const runAutoReload = async () => {
      try {
        const options = { mode: 'read' as const };
        if (await (directoryHandle as any).queryPermission(options) === 'granted') {
          await loadFromDirectoryHandle(directoryHandle);
          triggerSpin();
        }
      } catch (err) {
        console.warn('Background auto reload failed:', err);
      }
    };

    const timerId = setInterval(() => {
      void runAutoReload();
    }, autoReloadInterval * 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [autoReloadEnabled, autoReloadInterval, directoryHandle]);

  // Click outside listener for options popover
  useEffect(() => {
    if (!showOptions) return;
    const handleDocumentClick = () => {
      setShowOptions(false);
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
                <span style={{ userSelect: 'none' }}>再読み込み間隔:</span>
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
                <option value="acceleration" style={{ backgroundColor: '#1e293b' }}>加速度</option>
                <option value="gyro" style={{ backgroundColor: '#1e293b' }}>ジャイロ</option>
                <option value="speed" style={{ backgroundColor: '#1e293b' }}>速度</option>
              </select>
            </label>
          </div>
        )}
      </div>
      <label>
        データセット
        <select value={selectedDatasetId} onChange={(event) => onDatasetChange(event.target.value)}>
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
        onChange={handleFolderChange}
        style={{ display: 'none' }}
        {...({
          webkitdirectory: '',
          directory: '',
          multiple: true,
        } as any)}
      />
      <button type="button" onClick={handleSelectFolderClick} title="CSVファイルの入ったフォルダを選択">
        フォルダ選択
      </button>

      <button type="button" onClick={onPlayToggle}>
        {isPlaying ? '停止' : '開始'}
      </button>

      <label>
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
        <button
          type="button"
          className={graphMode === 'speed' ? 'mode-active' : ''}
          onClick={() => handleGraphModeChange('speed')}
        >
          速度
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
        onClick={handleReloadClick}
        className="reload-btn"
        title="フォルダ内を再読み込み"
      >
        <img src={`${import.meta.env.BASE_URL}RELOAD.png`} alt="再読み込み" className={isSpinning ? 'spinning' : ''} />
      </button>
    </section>
  );
}
