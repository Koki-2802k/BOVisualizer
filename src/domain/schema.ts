/**
 * schema.ts — ドメイン内部の正規化済みフレーム型と定数定義
 *
 * CSV パーサは生の RowingFrame[] を生成し、公開インターフェースもそのまま維持する。
 * domain 内部の計算ではこの NormalizedFrame を使用することで
 * 文字列キーによる動的アクセスを排除し、型安全性を高める。
 */

import type { RowingFrame, RowingValue } from '../types/rowing';

// ───────────────────────────────────────────────────────────────────────────
// メトリクス定数
// ───────────────────────────────────────────────────────────────────────────

/**
 * グラフ描画・メトリクス導出の対象列。
 * ここに 1 行追加するだけで graphSeries への反映が自動化される。
 */
export const METRIC_COLUMNS = [
  'speed', 'accx', 'accy', 'accz', 'gyrox', 'gyroy', 'gyroz',
  'SPM', 'SPLIT',
] as const;

export type MetricKey = typeof METRIC_COLUMNS[number];

// ───────────────────────────────────────────────────────────────────────────
// 型定義
// ───────────────────────────────────────────────────────────────────────────

/** クォータニオン成分（null = 欠損） */
export interface Quaternion {
  w: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
}

/**
 * 正規化済みフレーム — ドメイン内部の計算に使用。
 *
 * CSV 由来の生 RowingFrame はパース境界に留め、
 * domain 内では NormalizedFrame を流通させることで
 * 文字列キーによる動的アクセスをなくし、静的型を保証する。
 *
 * 外部公開インターフェース（コンポーネント・テスト）は引き続き
 * RowingFrame[] を受け取る。変換は analysisRepository の境界でのみ行う。
 */
export interface NormalizedFrame {
  /** フレーム配列の添字（0 始まり連続、再生位置 uiFrame と一致） */
  arrayIndex: number;
  /** CSV 'number' 列（実測値。非ゼロ開始・非連続の場合あり） */
  csvNumber: number | null;
  /** CSV 'time' 列（ISO 日時文字列） */
  timeStr: string | null;
  /** CSV 'time_s' 列（経過秒数） */
  timeSec: number | null;

  /** 左オールクォータニオン (wol/xol/yol/zol) */
  leftOarQ: Quaternion;
  /** 右オールクォータニオン (wor/xor/yor/zor) */
  rightOarQ: Quaternion;
  /** ボートクォータニオン (wb/xb/yb/zb) */
  boatQ: Quaternion;

  /** 左オール角度 [deg]（angle_left; CSV 直読みまたはクォータニオンから計算済み） */
  angleDegLeft: number | null;
  /** 右オール角度 [deg]（angle_right; 同上） */
  angleDegRight: number | null;

  /** 補正角度 [deg] */
  errDegOarLeftZ: number | null;
  errDegOarRightZ: number | null;
  errDegBoatZ: number | null;

  /**
   * ブレード先端座標（複数 CSV エイリアスを正規化済み）
   * left_tip_x / oar_left_tip_x / blade_left_x → tipLeftX
   */
  tipLeftX: number | null;
  tipLeftZ: number | null;
  tipRightX: number | null;
  tipRightZ: number | null;

  /** GPS 座標（null = 欠損または (0, 0) の無効値） */
  gpsLat: number | null;
  gpsLon: number | null;

  /** スカラーメトリクス（METRIC_COLUMNS で定義された列） */
  metrics: Record<MetricKey, number | null>;
}

// ───────────────────────────────────────────────────────────────────────────
// 変換ヘルパー（RowingValue → 型付き値）
// ───────────────────────────────────────────────────────────────────────────

const asNum = (v: RowingValue | undefined): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const asStr = (v: RowingValue | undefined): string | null =>
  typeof v === 'string' ? v : null;

const pickNum = (frame: RowingFrame, ...keys: string[]): number | null => {
  for (const key of keys) {
    const val = asNum(frame[key]);
    if (val !== null) return val;
  }
  return null;
};

const readQ = (
  frame: RowingFrame,
  wk: string, xk: string, yk: string, zk: string,
): Quaternion => ({
  w: asNum(frame[wk]),
  x: asNum(frame[xk]),
  y: asNum(frame[yk]),
  z: asNum(frame[zk]),
});

// ───────────────────────────────────────────────────────────────────────────
// 正規化関数
// ───────────────────────────────────────────────────────────────────────────

/**
 * 生の RowingFrame 1 件を型付き NormalizedFrame へ変換する。
 * 複数エイリアスの統合・(0,0) GPS 無効値の除去などもここで行う。
 */
export function normalizeFrame(frame: RowingFrame, arrayIndex: number): NormalizedFrame {
  const lat = asNum(frame.latitude);
  const lon = asNum(frame.longitude);
  const gpsValid = lat !== null && lon !== null && !(lat === 0 && lon === 0);

  return {
    arrayIndex,
    csvNumber: asNum(frame.number),
    timeStr: asStr(frame.time),
    timeSec: asNum(frame.time_s),

    leftOarQ: readQ(frame, 'wol', 'xol', 'yol', 'zol'),
    rightOarQ: readQ(frame, 'wor', 'xor', 'yor', 'zor'),
    boatQ: readQ(frame, 'wb', 'xb', 'yb', 'zb'),

    angleDegLeft: asNum(frame.angle_left),
    angleDegRight: asNum(frame.angle_right),

    errDegOarLeftZ: asNum(frame.err_deg_oar_left_z),
    errDegOarRightZ: asNum(frame.err_deg_oar_right_z),
    errDegBoatZ: asNum(frame.err_deg_boat_z),

    tipLeftX: pickNum(frame, 'left_tip_x', 'oar_left_tip_x', 'blade_left_x'),
    tipLeftZ: pickNum(frame, 'left_tip_z', 'oar_left_tip_z', 'blade_left_z'),
    tipRightX: pickNum(frame, 'right_tip_x', 'oar_right_tip_x', 'blade_right_x'),
    tipRightZ: pickNum(frame, 'right_tip_z', 'oar_right_tip_z', 'blade_right_z'),

    gpsLat: gpsValid ? lat : null,
    gpsLon: gpsValid ? lon : null,

    metrics: Object.fromEntries(
      METRIC_COLUMNS.map((key) => [key, asNum(frame[key])]),
    ) as Record<MetricKey, number | null>,
  };
}

/** RowingFrame[] を NormalizedFrame[] へ一括変換する。 */
export function normalizeFrames(frames: RowingFrame[]): NormalizedFrame[] {
  return frames.map((frame, i) => normalizeFrame(frame, i));
}
