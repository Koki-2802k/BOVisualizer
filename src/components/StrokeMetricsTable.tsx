import { useMemo, useState, useEffect } from 'react';
import type { RowingFrame } from '../types/rowing';
import type { StrokeSegment } from '../types/strokeDetect';
import { buildOarTrajectory, type TrajectoryPoint } from '../utils/trajectory';
import { usePlaybackStore } from '../store/playbackStore';

/** 全データセット横断表示用の1データセット分のデータ */
export type DatasetStrokeData = {
  id: string;
  label: string;
  frames: RowingFrame[];
  strokes: StrokeSegment[];
};

type Props = {
  frames: RowingFrame[];
  strokes: StrokeSegment[];
  currentIndex?: number;
  /** 全データセット横断表示用データ（指定時は全データセット分を表示） */
  allDatasetsData?: DatasetStrokeData[];
  isExpanded?: boolean;
};

type StrokeMetricRow = {
  strokeIndex: number;
  startFrame: number;
  endFrame: number;
  leftCatch: number;
  leftFinish: number;
  leftSweep: number;
  rightCatch: number;
  rightFinish: number;
  rightSweep: number;
  driveFrames: number;
  recoveryFrames: number;
  drivePct: number;
  recoveryPct: number;
  rhythmRatio: string;
  datasetId?: string;
  datasetLabel?: string;
};

/** ストロークメトリクス計算の共通ロジック */
function computeStrokeRow(
  trajectory: TrajectoryPoint[],
  stroke: StrokeSegment,
  globalIndex: number,
  datasetId?: string,
  datasetLabel?: string,
): StrokeMetricRow {
  const start = stroke.startFrame;
  const end = stroke.endFrame;
  const totalFrames = end - start + 1;

  const strokeTrajectory = trajectory.slice(start, end + 1);
  const leftAngles = strokeTrajectory.map((t) => t.leftAngleDeg);
  const rightAngles = strokeTrajectory.map((t) => t.rightAngleDeg);

  const minLeft = leftAngles.length > 0 ? Math.min(...leftAngles) : 0;
  const maxLeft = leftAngles.length > 0 ? Math.max(...leftAngles) : 0;
  const minRight = rightAngles.length > 0 ? Math.min(...rightAngles) : 0;
  const maxRight = rightAngles.length > 0 ? Math.max(...rightAngles) : 0;

  const catchSeg = stroke.phases.find((p) => p.phase === 'catch');
  const finishSeg = stroke.phases.find((p) => p.phase === 'finish');

  let leftCatch = maxLeft;
  let leftFinish = minLeft;
  let rightCatch = maxRight;
  let rightFinish = minRight;

  if (catchSeg && finishSeg) {
    const cStartIdx = Math.max(0, catchSeg.startFrame - start);
    const cEndIdx = Math.min(strokeTrajectory.length - 1, catchSeg.endFrame - start);
    const leftCatchAvg =
      leftAngles.slice(cStartIdx, cEndIdx + 1).reduce((a, b) => a + b, 0) /
      (cEndIdx - cStartIdx + 1 || 1);
    const rightCatchAvg =
      rightAngles.slice(cStartIdx, cEndIdx + 1).reduce((a, b) => a + b, 0) /
      (cEndIdx - cStartIdx + 1 || 1);

    const fStartIdx = Math.max(0, finishSeg.startFrame - start);
    const fEndIdx = Math.min(strokeTrajectory.length - 1, finishSeg.endFrame - start);
    const leftFinishAvg =
      leftAngles.slice(fStartIdx, fEndIdx + 1).reduce((a, b) => a + b, 0) /
      (fEndIdx - fStartIdx + 1 || 1);
    const rightFinishAvg =
      rightAngles.slice(fStartIdx, fEndIdx + 1).reduce((a, b) => a + b, 0) /
      (fEndIdx - fStartIdx + 1 || 1);

    leftCatch = leftCatchAvg > leftFinishAvg ? maxLeft : minLeft;
    leftFinish = leftCatchAvg > leftFinishAvg ? minLeft : maxLeft;
    rightCatch = rightCatchAvg > rightFinishAvg ? maxRight : minRight;
    rightFinish = rightCatchAvg > rightFinishAvg ? minRight : maxRight;
  }

  const leftSweep = Math.abs(leftCatch - leftFinish);
  const rightSweep = Math.abs(rightCatch - rightFinish);

  const driveStart = catchSeg ? catchSeg.startFrame : start;
  const driveEnd = finishSeg ? finishSeg.endFrame : end;
  const driveFrames = Math.max(1, driveEnd - driveStart + 1);
  const recoveryFrames = Math.max(1, totalFrames - driveFrames);

  const drivePct = Math.round((driveFrames / totalFrames) * 100);
  const recoveryPct = 100 - drivePct;
  const rhythmRatio = `1:${(recoveryFrames / driveFrames).toFixed(2)}`;

  return {
    strokeIndex: globalIndex,
    startFrame: start,
    endFrame: end,
    leftCatch,
    leftFinish,
    leftSweep,
    rightCatch,
    rightFinish,
    rightSweep,
    driveFrames,
    recoveryFrames,
    drivePct,
    recoveryPct,
    rhythmRatio,
    datasetId,
    datasetLabel,
  };
}

export default function StrokeMetricsTable({
  frames,
  strokes,
  currentIndex = 0,
  allDatasetsData,
  isExpanded = false,
}: Props) {
  const { setSeekFrame, selectedDatasetId, setSelectedDatasetId } = usePlaybackStore();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const isMultiDataset = !!allDatasetsData && allDatasetsData.length > 0;


  const trajectory = useMemo(() => buildOarTrajectory(frames), [frames]);

  // 各ストロークのメトリクス行を計算
  const rows = useMemo<StrokeMetricRow[]>(() => {
    if (isMultiDataset && allDatasetsData) {
      // 全データセット横断モード
      let globalIdx = 0;
      const result: StrokeMetricRow[] = [];
      for (const dsData of allDatasetsData) {
        if (dsData.strokes.length === 0) continue;
        const dsTraj = buildOarTrajectory(dsData.frames);
        if (dsTraj.length === 0) continue;
        for (const stroke of dsData.strokes) {
          result.push(
            computeStrokeRow(dsTraj, stroke, globalIdx, dsData.id, dsData.label),
          );
          globalIdx++;
        }
      }
      return result;
    }

    // 単一データセットモード（既存ロジック）
    if (trajectory.length === 0 || strokes.length === 0) return [];
    return strokes.map((stroke) =>
      computeStrokeRow(trajectory, stroke, stroke.strokeIndex),
    );
  }, [trajectory, strokes, isMultiDataset, allDatasetsData]);

  // スパークライン用トレンドデータ
  const trends = useMemo(
    () => ({
      leftCatch: rows.map((r) => r.leftCatch),
      rightCatch: rows.map((r) => r.rightCatch),
      leftFinish: rows.map((r) => r.leftFinish),
      rightFinish: rows.map((r) => r.rightFinish),
      leftSweep: rows.map((r) => r.leftSweep),
      rightSweep: rows.map((r) => r.rightSweep),
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
    return strokes.findIndex(
      (s) => currentIndex >= s.startFrame && currentIndex <= s.endFrame,
    );
  }, [rows, strokes, currentIndex, isMultiDataset, selectedDatasetId]);

  const activeRow = activeRowIndex !== -1 ? rows[activeRowIndex] : rows[rows.length - 1];

  // ストローク構成や再生位置（アクティブ行）が変わったときに、アクティブ行があるページに追従（無ければページ1）
  useEffect(() => {
    if (activeRowIndex !== -1) {
      const activePage = Math.floor(activeRowIndex / itemsPerPage) + 1;
      setCurrentPage(activePage);
    } else {
      setCurrentPage(1);
    }
  }, [strokes, allDatasetsData, activeRowIndex, itemsPerPage]);

// スパークラインコンポーネント（ホバー時のストローク番号ツールチップ表示機能付き）
type SparklineProps = {
  values: number[];
  strokeColor: string;
  width?: number;
  height?: number;
};

function Sparkline({ values, strokeColor, width = 180, height = 40 }: SparklineProps) {
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
}

  const totalPages = Math.ceil(rows.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRows = rows.slice(startIndex, startIndex + itemsPerPage);

  const displayRows: Array<StrokeMetricRow | null> = [...paginatedRows];
  while (displayRows.length < 5) {
    displayRows.push(null);
  }

  const handlePrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));

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

  if (!isMultiDataset && strokes.length === 0) {
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
            <div style={{ fontSize: isExpanded ? '13px' : '11px', color: '#64748b', fontWeight: 600 }}>キャッチ角</div>
            <div style={{ fontSize: isExpanded ? '16px' : '13px', fontWeight: 700, color: '#3b82f6', marginTop: '2px' }}>
              左: {activeRow?.leftCatch.toFixed(1)}° / 右: {activeRow?.rightCatch.toFixed(1)}°
            </div>
          </div>
          <div style={{ paddingLeft: '8px' }}>
            <Sparkline values={trends.leftCatch} strokeColor="#2563eb" width={isExpanded ? 320 : 180} height={isExpanded ? 56 : 42} />
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
            <div style={{ fontSize: isExpanded ? '13px' : '11px', color: '#64748b', fontWeight: 600 }}>フィニッシュ角</div>
            <div style={{ fontSize: isExpanded ? '16px' : '13px', fontWeight: 700, color: '#ea580c', marginTop: '2px' }}>
              左: {activeRow?.leftFinish.toFixed(1)}° / 右: {activeRow?.rightFinish.toFixed(1)}°
            </div>
          </div>
          <div style={{ paddingLeft: '8px' }}>
            <Sparkline values={trends.leftFinish} strokeColor="#ea580c" width={isExpanded ? 320 : 180} height={isExpanded ? 56 : 42} />
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
            <div style={{ fontSize: isExpanded ? '13px' : '11px', color: '#64748b', fontWeight: 600 }}>総スイープ角</div>
            <div style={{ fontSize: isExpanded ? '16px' : '13px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
              左: {activeRow?.leftSweep.toFixed(1)}° / 右: {activeRow?.rightSweep.toFixed(1)}°
            </div>
          </div>
          <div style={{ paddingLeft: '8px' }}>
            <Sparkline values={trends.leftSweep} strokeColor="#16a34a" width={isExpanded ? 320 : 180} height={isExpanded ? 56 : 42} />
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
            <tr style={{ height: '32px' }}>
              <th
                rowSpan={2}
                style={{
                  padding: '6px 8px',
                  fontWeight: 700,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: '14px',
                }}
              >
                #
              </th>
              <th
                colSpan={3}
                style={{
                  padding: '4px 8px',
                  fontWeight: 700,
                  background: 'rgba(37,99,235,0.06)',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  fontSize: '14px',
                }}
              >
                左オール
              </th>
              <th
                colSpan={3}
                style={{
                  padding: '4px 8px',
                  fontWeight: 700,
                  background: 'rgba(22,163,74,0.05)',
                  borderBottom: '1px solid #cbd5e1',
                  borderRight: '1px solid #cbd5e1',
                  fontSize: '14px',
                }}
              >
                右オール
              </th>
              <th
                rowSpan={2}
                style={{ padding: '6px 8px', fontWeight: 700, fontSize: '14px' }}
              >
                リズム (D/R比)
              </th>
            </tr>
            <tr style={{ background: '#f8fafc', height: '24px' }}>
              <th
                style={{
                  padding: '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                キャッチ
              </th>
              <th
                style={{
                  padding: '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                フィニッシュ
              </th>
              <th
                style={{
                  padding: '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                アーク
              </th>
              <th
                style={{
                  padding: '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                キャッチ
              </th>
              <th
                style={{
                  padding: '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                フィニッシュ
              </th>
              <th
                style={{
                  padding: '2px 8px',
                  fontWeight: 600,
                  borderRight: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#475569',
                }}
              >
                アーク
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
                        padding: '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #e2e8f0',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td
                      colSpan={3}
                      style={{
                        padding: '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td
                      colSpan={3}
                      style={{
                        padding: '8px',
                        background: '#fafafa',
                        borderRight: '1px solid #cbd5e1',
                      }}
                    >
                      &nbsp;
                    </td>
                    <td style={{ padding: '8px', background: '#fafafa' }}>&nbsp;</td>
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
                      padding: '8px',
                      fontWeight: 700,
                      borderRight: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      fontSize: '16px',
                    }}
                  >
                    {row.strokeIndex + 1}
                  </td>
                  {/* 左オール */}
                  <td
                    style={{
                      padding: '8px',
                      borderRight: '1px solid #e2e8f0',
                      color: '#2563eb',
                      fontWeight: 600,
                      fontSize: '18px',
                    }}
                  >
                    {row.leftCatch.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      borderRight: '1px solid #e2e8f0',
                      color: '#ea580c',
                      fontWeight: 600,
                      fontSize: '18px',
                    }}
                  >
                    {row.leftFinish.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      borderRight: '1px solid #cbd5e1',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontSize: '19px',
                    }}
                  >
                    {row.leftSweep.toFixed(1)}°
                  </td>
                  {/* 右オール */}
                  <td
                    style={{
                      padding: '8px',
                      borderRight: '1px solid #e2e8f0',
                      color: '#2563eb',
                      fontWeight: 600,
                      fontSize: '18px',
                    }}
                  >
                    {row.rightCatch.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      borderRight: '1px solid #e2e8f0',
                      color: '#ea580c',
                      fontWeight: 600,
                      fontSize: '18px',
                    }}
                  >
                    {row.rightFinish.toFixed(1)}°
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      borderRight: '1px solid #cbd5e1',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontSize: '19px',
                    }}
                  >
                    {row.rightSweep.toFixed(1)}°
                  </td>
                  {/* リズム */}
                  <td
                    style={{
                      padding: '8px',
                      fontWeight: 600,
                      color: '#475569',
                      fontSize: '18px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.rhythmRatio}</span>
                    <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '8px' }}>
                      ({row.drivePct}% / {row.recoveryPct}%)
                    </span>
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
          gap: '16px',
          margin: '8px 0 2px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          style={{
            padding: '6px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
            color: currentPage === 1 ? '#94a3b8' : '#0f172a',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.15s ease',
          }}
        >
          前へ
        </button>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
          {currentPage} / {totalPages} ページ (全 {rows.length} ストローク)
        </span>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          style={{
            padding: '6px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
            color: currentPage === totalPages ? '#94a3b8' : '#0f172a',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'all 0.15s ease',
          }}
        >
          次へ
        </button>
      </div>
    </div>
  );
}
