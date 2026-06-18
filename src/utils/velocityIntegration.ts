/**
 * velocityIntegration.ts — 加速度積分による艇速推定（副作用なし純粋関数群）
 *
 * 背景: GPS 由来の `speed` はセンサ仕様上 約1Hz でしか更新されず、60Hz の各フレームには
 *       同一値が保持される（階段状）。一方 `accx`（前後方向加速度）は 60Hz で取得できる。
 *       これを時間積分してストローク内の速度プロファイルを復元する。
 *
 * 手法: GPS の 1Hz 実速度を「アンカー（真値）」とし、
 *   1) アンカー間を台形積分（高周波形状を加速度から復元）
 *   2) 区間終端の累積誤差を経過時間に比例して線形に差し引く（区間線形デドリフト）
 *  これにより、加速度バイアス起因の線形ドリフトを相殺しつつ全アンカーを必ず通過する。
 *
 * 詳細は doc/PLAN.md を参照。
 */
import type { NormalizedFrame } from '../domain/schema';

const TIME_AXIS_FALLBACK_HZ = 60;

export interface VelocityResult {
  /** arrayIndex に整列した積分速度 [m/s]（null = 算出不可フレーム） */
  integrated: (number | null)[];
  /** 実測（GPS 保持）速度 [m/s]。比較・フォールバック用 */
  measured: (number | null)[];
  /** 使用した GPS アンカー数 */
  anchorCount: number;
  /** アンカーが 2 個以上あり積分が有効か。false の場合 integrated は measured と同一 */
  usable: boolean;
}

/**
 * 各フレームの経過秒（先頭フレームを 0 とする）を返す。
 * `metrics.ts` の buildTimeAxis と同一の優先順位:
 *   timeSec > ISO timeStr の差分 > index / 60 フォールバック。
 */
export function buildElapsedSeconds(frames: NormalizedFrame[]): number[] {
  let startMs: number | null = null;
  const startSec = frames[0]?.timeSec ?? null;

  return frames.map((frame, index) => {
    if (frame.timeSec !== null) {
      return startSec !== null ? frame.timeSec - startSec : frame.timeSec;
    }
    if (frame.timeStr !== null) {
      const nowMs = Date.parse(frame.timeStr);
      if (!Number.isNaN(nowMs)) {
        if (startMs === null) startMs = nowMs;
        return (nowMs - startMs) / 1000;
      }
    }
    return index / TIME_AXIS_FALLBACK_HZ;
  });
}

/** GPS 実速度の変化点（= 新しい測定値が現れたフレーム）をアンカーとして抽出する。 */
function findAnchors(measured: (number | null)[]): Array<{ index: number; value: number }> {
  const anchors: Array<{ index: number; value: number }> = [];
  let lastValue: number | null = null;
  for (let n = 0; n < measured.length; n += 1) {
    const v = measured[n];
    if (v === null) continue;
    if (lastValue === null || v !== lastValue) {
      anchors.push({ index: n, value: v });
      lastValue = v;
    }
  }
  return anchors;
}

/** 台形積分の 1 ステップ分の速度増分。加速度欠損は 0 寄与として扱う。 */
function trapezoidStep(
  aPrev: number | null,
  aCurr: number | null,
  dt: number,
): number {
  if (dt <= 0 || !Number.isFinite(dt)) return 0;
  const a0 = aPrev ?? aCurr ?? 0;
  const a1 = aCurr ?? aPrev ?? 0;
  return 0.5 * (a0 + a1) * dt;
}

/**
 * 低レベル積分関数。加速度・時刻・実測速度の配列から積分速度を算出する。
 * テスト容易性のため NormalizedFrame に依存しない。
 *
 * @param accel    前後方向加速度 [m/s²]（null = 欠損）
 * @param timeSec  各サンプルの経過秒（単調増加を想定）
 * @param measured GPS 実測速度 [m/s]（1Hz で保持された階段状でよい。null = 欠損）
 */
export function integrateVelocitySeries(
  accel: (number | null)[],
  timeSec: number[],
  measured: (number | null)[],
): VelocityResult {
  const n = accel.length;
  const anchors = findAnchors(measured);

  // アンカーが 1 個以下ではデドリフト不可 → 実測値をそのまま返す
  if (n === 0 || anchors.length < 2) {
    return {
      integrated: measured.slice(),
      measured: measured.slice(),
      anchorCount: anchors.length,
      usable: false,
    };
  }

  const v = new Array<number | null>(n).fill(null);

  // 各アンカー区間 [i0, i1] を台形積分 → 区間線形デドリフト
  for (let k = 0; k < anchors.length - 1; k += 1) {
    const i0 = anchors[k].index;
    const i1 = anchors[k + 1].index;
    const t0 = timeSec[i0];
    const tT = timeSec[i1] - t0;

    // 1) 区間内を生積分（始点 = GPS 実速度）
    const raw = new Array<number>(i1 - i0 + 1);
    raw[0] = anchors[k].value;
    for (let m = 1; m < raw.length; m += 1) {
      const idx = i0 + m;
      const dt = timeSec[idx] - timeSec[idx - 1];
      raw[m] = raw[m - 1] + trapezoidStep(accel[idx - 1], accel[idx], dt);
    }

    // 2) 終端誤差を経過時間比で線形に差し引く（端点拘束）
    const err = raw[raw.length - 1] - anchors[k + 1].value;
    for (let m = 0; m < raw.length; m += 1) {
      const idx = i0 + m;
      const frac = tT > 0 ? (timeSec[idx] - t0) / tT : 0;
      v[idx] = raw[m] - err * frac;
    }
  }

  // 先頭アンカーより前: 後方積分でアンカー値に接続（形状を保持）
  const firstIdx = anchors[0].index;
  for (let idx = firstIdx - 1; idx >= 0; idx -= 1) {
    const dt = timeSec[idx + 1] - timeSec[idx];
    const next = v[idx + 1];
    v[idx] = (next ?? anchors[0].value) - trapezoidStep(accel[idx], accel[idx + 1], dt);
  }

  // 末尾アンカーより後: 前方積分で外挿（端点拘束なし。短区間のため許容）
  const lastIdx = anchors[anchors.length - 1].index;
  for (let idx = lastIdx + 1; idx < n; idx += 1) {
    const dt = timeSec[idx] - timeSec[idx - 1];
    const prev = v[idx - 1];
    v[idx] = (prev ?? anchors[anchors.length - 1].value) + trapezoidStep(accel[idx - 1], accel[idx], dt);
  }

  return {
    integrated: v,
    measured: measured.slice(),
    anchorCount: anchors.length,
    usable: true,
  };
}

/**
 * 公開ラッパー — NormalizedFrame[] から積分速度を算出する。
 * accx を前後方向加速度、speed を GPS 実測速度として用いる。
 */
export function computeIntegratedVelocity(frames: NormalizedFrame[]): VelocityResult {
  if (frames.length === 0) {
    return { integrated: [], measured: [], anchorCount: 0, usable: false };
  }
  const accel = frames.map((f) => f.metrics.accx);
  const measured = frames.map((f) => f.metrics.speed);
  const timeSec = buildElapsedSeconds(frames);
  return integrateVelocitySeries(accel, timeSec, measured);
}
