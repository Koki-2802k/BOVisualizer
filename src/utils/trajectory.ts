import { computeOarTipXY, extractZXYEulerYDeg, makeSensorQuaternion } from "./coordTransform";
import type { RowingFrame } from "../types/rowing";
import type { NormalizedFrame } from "../domain/schema";
import { getAnalysis } from "../domain/analysisRepository";

export type TrajectoryPoint = {
  frameNumber: number;
  leftX: number;
  leftZ: number;
  rightX: number;
  rightZ: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
};

const fallbackFromAngle = (angleDeg: number, side: "left" | "right"): { x: number; z: number } => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const reach = 200.0; // scaled to centimeters to match plot bounds
  const x = Math.cos(angleRad) * reach;
  const z = Math.sin(angleRad) * reach;
  return side === "left" ? { x, z } : { x: -x, z };
};

/** 公開ラッパー — 外部コンポーネントは RowingFrame[] を渡す。 */
export const buildOarTrajectory = (frames: RowingFrame[]): TrajectoryPoint[] => {
  return getAnalysis(frames).trajectory;
};

/**
 * 内部計算用。NormalizedFrame[] を直接受け取り軌跡を構築する。
 * analysisRepository の境界で正規化済みのフレームを受け取るため、
 * 文字列キーによる動的アクセスが不要になる。
 */
export const buildOarTrajectoryInternal = (frames: NormalizedFrame[]): TrajectoryPoint[] => {
  return frames.map((frame) => {
    const lQ = frame.leftOarQ;
    const rQ = frame.rightOarQ;
    const bQ = frame.boatQ;

    const hasLeftQ  = lQ.w !== null && lQ.x !== null && lQ.y !== null && lQ.z !== null;
    const hasRightQ = rQ.w !== null && rQ.x !== null && rQ.y !== null && rQ.z !== null;
    const hasBoatQ  = bQ.w !== null && bQ.x !== null && bQ.y !== null && bQ.z !== null;

    const leftAngleDeg = hasLeftQ
      ? extractZXYEulerYDeg(makeSensorQuaternion(lQ.w!, lQ.x!, lQ.y!, lQ.z!))
      : (frame.angleDegLeft ?? 0);

    const rightAngleDeg = hasRightQ
      ? extractZXYEulerYDeg(makeSensorQuaternion(rQ.w!, rQ.x!, rQ.y!, rQ.z!))
      : (frame.angleDegRight ?? 0);

    const leftFallback  = fallbackFromAngle(leftAngleDeg, "left");
    const rightFallback = fallbackFromAngle(rightAngleDeg, "right");

    const leftTip = hasLeftQ && hasBoatQ
      ? computeOarTipXY(
          makeSensorQuaternion(lQ.w!, lQ.x!, lQ.y!, lQ.z!),
          makeSensorQuaternion(bQ.w!, bQ.x!, bQ.y!, bQ.z!),
          frame.errDegOarLeftZ ?? 0,
          frame.errDegBoatZ ?? 0,
          [12.0, 200.0, 3.0],
        )
      : null;

    const rightTip = hasRightQ && hasBoatQ
      ? computeOarTipXY(
          makeSensorQuaternion(rQ.w!, rQ.x!, rQ.y!, rQ.z!),
          makeSensorQuaternion(bQ.w!, bQ.x!, bQ.y!, bQ.z!),
          frame.errDegOarRightZ ?? 0,
          frame.errDegBoatZ ?? 0,
          [-12.0, 200.0, 3.0],
        )
      : null;

    return {
      frameNumber: frame.csvNumber ?? frame.arrayIndex,
      leftX:  frame.tipLeftX  ?? leftTip?.x  ?? leftFallback.x,
      leftZ:  frame.tipLeftZ  ?? leftTip?.z  ?? leftFallback.z,
      rightX: frame.tipRightX ?? rightTip?.x ?? rightFallback.x,
      rightZ: frame.tipRightZ ?? rightTip?.z ?? rightFallback.z,
      leftAngleDeg,
      rightAngleDeg,
    };
  });
};
