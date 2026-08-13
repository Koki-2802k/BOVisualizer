import { useMemo, useState, memo } from 'react';
import type { StrokeMetricRow } from '../types/analysis';
import { usePlaybackStore } from '../store/playbackStore';

// スパークラインコンポーネント（ホバー時のストローク番号ツールチップ表示機能付き）
type SparklineProps = {
  values: number[];
  strokeColor: string;
  width?: number;
  height?: number;
};

const Sparkline = memo(function Sparkline({ values, strokeColor, width = 180, height = 40 }: SparklineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (values.length < 2) {
    return (
      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
        データ不足
      </span>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return { x, y, value: val, index: idx };
  });

  const pointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, mouseX / rect.width));
    const idx = Math.round(percent * (values.length - 1));
    setHoveredIndex(idx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  // ツールチップの位置決定（はみ出し防止と被り回避）
  const tooltipW = 28;
  const tooltipH = 20;
  let tooltipX = 0;
  let tooltipY = 0;

  if (hoveredPoint) {
    tooltipX = hoveredPoint.x - tooltipW / 2;
    if (tooltipX < 2) tooltipX = 2;
    if (tooltipX + tooltipW > width - 2) tooltipX = width - tooltipW - 2;

    // データ点が上半分にあれば下側、下半分にあれば上側に表示してカーソルとの被りを防ぐ
    const showBelow = hoveredPoint.y < height / 2;
    tooltipY = showBelow ? hoveredPoint.y + 12 : hoveredPoint.y - 32;
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', verticalAlign: 'middle', cursor: 'pointer' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <polyline
        fill="none"
        stroke="rgba(203, 213, 225, 0.4)"
        strokeWidth="1"
        points={`0,${(height / 2).toFixed(1)} ${width},${(height / 2).toFixed(1)}`}
      />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pointsStr}
      />
      <circle
        cx="0"
        cy={points[0].y.toFixed(1)}
        r="3"
        fill={strokeColor}
      />
      <circle
        cx={width}
        cy={points[points.length - 1].y.toFixed(1)}
        r="3"
        fill="#ef4444"
      />

      {hoveredPoint && (
        <g>
          <line
            x1={hoveredPoint.x}
            y1={0}
            x2={hoveredPoint.x}
            y2={height}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="5"
            fill="#ef4444"
          />
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipW}
              height={tooltipH}
              rx="4"
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth="1"
            />
            <text
              x={tooltipX + tooltipW / 2}
              y={tooltipY + tooltipH / 2 + 4.5}
              fill="#ffffff"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
            >
              {hoveredPoint.index + 1}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
});


type Props = {
  strokeMetrics: StrokeMetricRow[];
  currentIndex?: number;
  /** 全データセット横断表示用のキャッシュ済みメトリクス */
  allStrokeMetrics?: StrokeMetricRow[];
  isExpanded?: boolean;
};

export default function StrokeMetricsTable({
  strokeMetrics,
  currentIndex = 0,
  allStrokeMetrics,
  isExpanded = false,
}: Props) {
  const { setSeekFrame, selectedDatasetId, setSelectedDatasetId } = usePlaybackStore();
  const [pageSelection, setPageSelection] = useState({ page: 1, activeRowIndex: -1 });
  const itemsPerPage = 5;

  const isMultiDataset = !!allStrokeMetrics && allStrokeMetrics.length > 0;
  const rows = isMultiDataset ? allStrokeMetrics : strokeMetrics;

  // スパークライン用トレンドデータ
  const trends = useMemo(
    () => ({
      leftCatch: rows.map((r) => r.leftCatch),
      rightCatch: rows.map((r) => r.rightCatch),
      leftFinish: rows.map((r) => r.leftFinish),
      rightFinish: rows.map((r) => r.rightFinish),
      catchAngleDiff: rows.map((r) => r.catchAngleDiff),
      finishAngleDiff: rows.map((r) => r.finishAngleDiff),
      leftIdealRatio: rows.map((r) => r.leftIdealRatio),
      rightIdealRatio: rows.map((r) => r.rightIdealRatio),
    }),
    [rows],
  );

  // 現在再生中フレームに対応するアクティブ行インデックス
  const activeRowIndex = useMemo(() => {
    if (isMultiDataset) {
      return rows.findIndex(
        (row) =>
          row.datasetId === selectedDatasetId &&
          currentIndex >= row.startFrame &&
          currentIndex <= row.endFrame,
      );
    }
    return rows.findIndex(
      (row) => currentIndex >= row.startFrame && currentIndex <= row.endFrame,
    );
  }, [rows, currentIndex, isMultiDataset, selectedDatasetId]);

  const activeRow = activeRowIndex !== -1 ? rows[activeRowIndex] : rows[rows.length - 1];

  const totalPages = Math.ceil(rows.length / itemsPerPage) || 1;
  const followedPage = activeRowIndex === -1
    ? 1
    : Math.floor(activeRowIndex / itemsPerPage) + 1;
  const currentPage = Math.min(
    totalPages,
    pageSelection.activeRowIndex === activeRowIndex ? pageSelection.page : followedPage,
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRows = rows.slice(startIndex, startIndex + itemsPerPage);

  const displayRows: Array<StrokeMetricRow | null> = [...paginatedRows];
  while (displayRows.length < 5) {
    displayRows.push(null);
  }

  const handlePrevPage = () => setPageSelection({
    page: Math.max(1, currentPage - 1),
    activeRowIndex,
  });
  const handleNextPage = () => setPageSelection({
    page: Math.min(totalPages, currentPage + 1),
    activeRowIndex,
  });

  const handleRowClick = (row: StrokeMetricRow) => {
    if (isMultiDataset && row.datasetId) {
      setSelectedDatasetId(row.datasetId);
      // setSelectedDatasetId が seekFrame=0 にリセットするので、その後で上書き
      setSeekFrame(row.startFrame);
    } else {
      setSeekFrame(row.startFrame);
    }
  };

  // データセットラベルの表示用短縮（絵文字とパスを除去してファイル名のみ）
  const formatDatasetLabel = (label: string) => {
    // "📂 sample_1.csv" → "sample_1.csv"
    return label.replace(/^[\p{Emoji}\s]+/u, '').trim();
  };

  if (!isMultiDataset && strokeMetrics.length === 0) {
    return (
      <div className="panel-empty" style={{ flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: 0, fontSize: '18px' }}>ストロークが検出されていません。</p>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#0f172a' }}
    >
      {/* 上部: トレンドカード（スパークライン） */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '12px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: isExpanded ? '1 1 300px' : '1 1 240px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: isExpanded ? '12px 18px' : '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontSize: isExpanded ? '16px' : '11px', color: '#64748b', fontWeight: 600 }}>キャッチ角</div>
            <div style={{ fontSize: isExpanded ? '20px' : '13px', fontWeight: 700, color: '#3b82f6', marginTop: '2px' }}>
              左: {activeRow?.leftCatch.toFixed(1)}° / 右: {activeRow?.rightCatch.toFixed(1)}°
            </div>
          </div>
          <div style={{ paddingLeft: '8px' }}>
            <Sparkline values={trends.leftCatch} strokeColor="#2563eb" width={isExpanded ? 320 : 180} height={isExpanded ? 112 : 42} />
          </div>
        </div>

        <div
          style={{
            flex: isExpanded ? '1 1 300px' : '1 1 240px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: isExpanded ? '12px 18px' : '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontSize: isExpanded ? '16px' : '11px', color: '#64748b', fontWeight: 600 }}>フィニッシュ角</div>
            <div style={{ fontSize: isExpanded ? '20px' : '13px', fontWeight: 700, color: '#ea580c', marginTop: '2px' }}>
              左: {activeRow?.leftFinish.toFixed(1)}° / 右: {activeRow?.rightFinish.toFixed(1)}°
            </div>
          </div>
          <div style={{ paddingLeft: '8px' }}>
            <Sparkline values={trends.leftFinish} strokeColor="#ea580c" width={isExpanded ? 320 : 180} height={isExpanded ? 112 : 42} />
          </div>
        </div>

        <div
          style={{
            flex: isExpanded ? '1 1 300px' : '1 1 240px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: isExpanded ? '12px 18px' : '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ fontSize: isExpanded ? '16px' : '11px', color: '#64748b', fontWeight: 600 }}>Δ角度差（キャッチ / フィニッシュ）</div>
            <div style={{ fontSize: isExpanded ? '20px' : '13px', fontWeight: 700, marginTop: '2px' }}>
              <span style={{ color: '#7c3aed' }}>
                ΔCatch: {activeRow != null ? `${activeRow.catchAngleDiff >= 0 ? '+' : ''}${activeRow.catchAngleDiff.toFixed(1)}°` : '--'}
              </span>
              <span style={{ color: '#64748b', margin: '0 6px' }}>/</span>
              <span style={{ color: '#0891b2' }}>
                ΔFinish: {activeRow != null ? `${activeRow.finishAngleDiff >= 0 ? '+' : ''}${activeRow.finishAngleDiff.toFixed(1)}°` : '--'}
              </span>
            </div>
          </div>
          <div style={{ paddingLeft: '8px' }}>
            <Sparkline values={trends.catchAngleDiff} strokeColor="#7c3aed" width={isExpanded ? 320 : 180} height={isExpanded ? 112 : 42} />
          </div>
        </div>
      </div>

      {/* 下部: 数値明細テーブル */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            height: '100%',
            borderCollapse: 'collapse',
            textAlign: 'center',
            fontFamily: 'inherit',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '23%' }} />
          </colgroup>
          <thead
            style={{
              background: '#f1f5f9',
              borderBottom: '2px solid #cbd5e1',
              flexShrink: 0,
            }}
          >
            <tr style={{ height: isExpanded ? '64px' : '32px' }}>
              <th
                rowSpan={2}
                style={{
                  padding: isExpanded ? '12px 16px' : '6px 8px',
                  fontWeight: 700,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '28px' : '14px',
                }}
              >
                #
              </th>
              <th
                colSpan={2}
                style={{
                  padding: isExpanded ? '8px 16px' : '4px 8px',
                  fontWeight: 700,
                  background: 'rgba(37,99,235,0.06)',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '28px' : '14px',
                }}
              >
                左オール
              </th>
              <th
                colSpan={2}
                style={{
                  padding: isExpanded ? '8px 16px' : '4px 8px',
                  fontWeight: 700,
                  background: 'rgba(22,163,74,0.05)',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '28px' : '14px',
                }}
              >
                右オール
              </th>
              <th
                colSpan={2}
                style={{
                  padding: isExpanded ? '8px 16px' : '4px 8px',
                  fontWeight: 700,
                  background: 'rgba(124,58,237,0.06)',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '28px' : '14px',
                  color: '#5b21b6',
                }}
                title="左右差 = leftAngle + rightAngle（右センサー反転補正済み）。対称なら≈0°"
              >
                Δ角度差 (左−右)
              </th>
              <th
                rowSpan={2}
                style={{
                  padding: isExpanded ? '12px 16px' : '6px 8px',
                  fontWeight: 700,
                  fontSize: isExpanded ? '28px' : '14px',
                  color: '#16a34a',
                }}
                title="ドライブ期間中に良い角度（赤色プロット条件）だったフレームの割合"
              >
                良角度比 (%)
              </th>
            </tr>
            <tr style={{ background: '#f8fafc', height: isExpanded ? '48px' : '24px' }}>
              <th
                style={{
                  padding: isExpanded ? '4px 16px' : '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: isExpanded ? '24px' : '12px',
                  color: '#475569',
                }}
              >
                キャッチ
              </th>
              <th
                style={{
                  padding: isExpanded ? '4px 16px' : '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '24px' : '12px',
                  color: '#475569',
                }}
              >
                フィニッシュ
              </th>
              <th
                style={{
                  padding: isExpanded ? '4px 16px' : '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: isExpanded ? '24px' : '12px',
                  color: '#475569',
                }}
              >
                キャッチ
              </th>
              <th
                style={{
                  padding: isExpanded ? '4px 16px' : '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '24px' : '12px',
                  color: '#475569',
                }}
              >
                フィニッシュ
              </th>
              <th
                style={{
                  padding: isExpanded ? '4px 16px' : '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: isExpanded ? '24px' : '12px',
                  color: '#7c3aed',
                }}
                title="Δキャッチ角 = leftCatch + rightCatch。対称≈0、正=左が前方寄り"
              >
                Δキャッチ
              </th>
              <th
                style={{
                  padding: isExpanded ? '4px 16px' : '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: isExpanded ? '24px' : '12px',
                  color: '#0891b2',
                }}
                title="Δフィニッシュ角 = leftFinish + rightFinish。対称≈0、負=左が後方寄り"
              >
                Δフィニッシュ
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => {
              if (row === null) {
                return (
                  <tr
                    key={`empty-${index}`}
                    style={{ height: '20%', borderBottom: '1px solid #e2e8f0' }}
                  >
                    <td
                      style={{
                        padding: isExpanded ? '16px' : '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #e2e8f0',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td
                      colSpan={2}
                      style={{
                        padding: isExpanded ? '16px' : '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td
                      colSpan={2}
                      style={{
                        padding: isExpanded ? '16px' : '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td
                      colSpan={2}
                      style={{
                        padding: isExpanded ? '16px' : '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td style={{ padding: isExpanded ? '16px' : '8px', background: '#fafafa' }}>&nbsp;</td>
                  </tr>
                );
              }

              const isActive = isMultiDataset
                ? row.datasetId === selectedDatasetId &&
                currentIndex >= row.startFrame &&
                currentIndex <= row.endFrame
                : activeRowIndex !== -1 &&
                rows[activeRowIndex]?.strokeIndex === row.strokeIndex;

              return (
                <tr
                  key={`${row.datasetId ?? ''}-${row.strokeIndex}`}
                  onClick={() => handleRowClick(row)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.15s ease',
                    height: '20%',
                    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.12)' : '',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isActive
                      ? 'rgba(56, 189, 248, 0.2)'
                      : '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isActive
                      ? 'rgba(56, 189, 248, 0.12)'
                      : '';
                  }}
                  title={
                    isMultiDataset
                      ? `クリックして「${formatDatasetLabel(row.datasetLabel ?? '')}」に切替`
                      : 'クリックしてこのストロークの開始位置へシーク'
                  }
                >
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      fontWeight: 700,
                      borderRight: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      fontSize: isExpanded ? '32px' : '16px',
                    }}
                  >
                    {row.strokeIndex + 1}
                  </td>
                  {/* 左オール */}
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      borderRight: '1px solid #e2e8f0',
                      color: '#2563eb',
                      fontWeight: 600,
                      fontSize: isExpanded ? '36px' : '18px',
                    }}
                  >
                    {row.leftCatch.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      borderRight: '1px solid #cbd5e1',
                      color: '#ea580c',
                      fontWeight: 600,
                      fontSize: isExpanded ? '36px' : '18px',
                    }}
                  >
                    {row.leftFinish.toFixed(1)}°
                  </td>
                  {/* 右オール */}
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      borderRight: '1px solid #e2e8f0',
                      color: '#2563eb',
                      fontWeight: 600,
                      fontSize: isExpanded ? '36px' : '18px',
                    }}
                  >
                    {row.rightCatch.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      borderRight: '1px solid #cbd5e1',
                      color: '#ea580c',
                      fontWeight: 600,
                      fontSize: isExpanded ? '36px' : '18px',
                    }}
                  >
                    {row.rightFinish.toFixed(1)}°
                  </td>
                  {/* Δ角度差 */}
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      borderRight: '1px solid #e2e8f0',
                      fontWeight: 700,
                      color: Math.abs(row.catchAngleDiff) < 3 ? '#16a34a' : Math.abs(row.catchAngleDiff) < 8 ? '#d97706' : '#dc2626',
                      fontSize: isExpanded ? '36px' : '18px',
                    }}
                    title="Δキャッチ角 = leftCatch + rightCatch（対称≈0°）"
                  >
                    {row.catchAngleDiff >= 0 ? '+' : ''}{row.catchAngleDiff.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      borderRight: '1px solid #cbd5e1',
                      fontWeight: 700,
                      color: Math.abs(row.finishAngleDiff) < 3 ? '#16a34a' : Math.abs(row.finishAngleDiff) < 8 ? '#d97706' : '#dc2626',
                      fontSize: isExpanded ? '36px' : '18px',
                    }}
                    title="Δフィニッシュ角 = leftFinish + rightFinish（対称≈0°）"
                  >
                    {row.finishAngleDiff >= 0 ? '+' : ''}{row.finishAngleDiff.toFixed(1)}°
                  </td>
                  {/* 良角度比 */}
                  <td
                    style={{
                      padding: isExpanded ? '16px' : '8px',
                      fontWeight: 600,
                      fontSize: isExpanded ? '30px' : '15px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'row', gap: isExpanded ? '16px' : '8px', justifyContent: 'center', alignItems: 'center' }}>
                      <span style={{
                        color: row.leftIdealRatio >= 80 ? '#16a34a' : row.leftIdealRatio >= 60 ? '#d97706' : '#dc2626',
                        fontWeight: 700,
                      }}>
                        左 {row.leftIdealRatio}%
                      </span>
                      <span style={{ color: '#cbd5e1' }}>/</span>
                      <span style={{
                        color: row.rightIdealRatio >= 80 ? '#16a34a' : row.rightIdealRatio >= 60 ? '#d97706' : '#dc2626',
                        fontWeight: 700,
                      }}>
                        右 {row.rightIdealRatio}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ページネーションコントロール */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isExpanded ? '32px' : '16px',
          margin: isExpanded ? '16px 0 8px' : '8px 0 2px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          style={{
            padding: isExpanded ? '12px 32px' : '6px 16px',
            borderRadius: isExpanded ? '12px' : '6px',
            border: '1px solid #cbd5e1',
            background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
            color: currentPage === 1 ? '#94a3b8' : '#0f172a',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: isExpanded ? '28px' : '14px',
            transition: 'all 0.15s ease',
          }}
        >
          前へ
        </button>
        <span style={{ fontSize: isExpanded ? '28px' : '14px', fontWeight: 600, color: '#334155' }}>
          {currentPage} / {totalPages} ページ (全 {rows.length} ストローク)
        </span>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          style={{
            padding: isExpanded ? '12px 32px' : '6px 16px',
            borderRadius: isExpanded ? '12px' : '6px',
            border: '1px solid #cbd5e1',
            background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
            color: currentPage === totalPages ? '#94a3b8' : '#0f172a',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: isExpanded ? '28px' : '14px',
            transition: 'all 0.15s ease',
          }}
        >
          次へ
        </button>
      </div>
    </div>
  );
}
