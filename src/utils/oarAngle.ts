/**
 * oarAngle.ts — オール角度の共通ユーティリティ
 *
 * OarTrajectoryChart の赤色プロット判定と StrokeMetricsTable の良角度比計算で
 * 同一ロジックを使えるよう共通化。
 */

/**
 * オール角度が「良い入水角度」の範囲内かどうかを判定する。
 * OarTrajectoryChart で赤色プロットされる条件と同一。
 *
 * 判定式: |trunc(angle)| % 180 が (40, 140) の範囲内
 */
export function isIdealAngle(angle: number): boolean {
  const com = Math.abs(Math.trunc(angle)) % 180;
  return com > 40 && com < 140;
}
