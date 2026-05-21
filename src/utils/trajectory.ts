import { computeOarTipXY, extractZXYEulerYDeg, makeSensorQuaternion } from "./coordTransform";
import type { RowingFrame } from "../types/rowing";

export type TrajectoryPoint = {
  frameNumber: number;
  leftX: number;
  leftZ: number;
  rightX: number;
  rightZ: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
};

const TRAJECTORY_KEYS = {
  leftX: ["left_tip_x", "oar_left_tip_x", "blade_left_x"],
  leftZ: ["left_tip_z", "oar_left_tip_z", "blade_left_z"],
  rightX: ["right_tip_x", "oar_right_tip_x", "blade_right_x"],
  rightZ: ["right_tip_z", "oar_right_tip_z", "blade_right_z"],
} as const;

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const pickValue = (frame: RowingFrame, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = asNumber(frame[key]);
    if (value !== null) return value;
  }
  return null;
};

const fallbackFromAngle = (angleDeg: number, side: "left" | "right"): { x: number; z: number } => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const reach = 200.0; // scaled to centimeters to match plot bounds
  const x = Math.cos(angleRad) * reach;
  const z = Math.sin(angleRad) * reach;
  return side === "left" ? { x, z } : { x: -x, z };
};

export const buildOarTrajectory = (frames: RowingFrame[]): TrajectoryPoint[] => {
  const isFiniteNum = (val: unknown): boolean =>
    (typeof val === "number" && Number.isFinite(val)) ||
    (typeof val === "string" && val.trim().length > 0 && !Number.isNaN(Number(val)) && Number.isFinite(Number(val)));

  return frames.map((frame, index) => {
    const hasLeftQ =
      frame.wol != null && frame.xol != null && frame.yol != null && frame.zol != null &&
      isFiniteNum(frame.wol) && isFiniteNum(frame.xol) && isFiniteNum(frame.yol) && isFiniteNum(frame.zol);
    const hasRightQ =
      frame.wor != null && frame.xor != null && frame.yor != null && frame.zor != null &&
      isFiniteNum(frame.wor) && isFiniteNum(frame.xor) && isFiniteNum(frame.yor) && isFiniteNum(frame.zor);
    const hasBoatQ =
      frame.wb != null && frame.xb != null && frame.yb != null && frame.zb != null &&
      isFiniteNum(frame.wb) && isFiniteNum(frame.xb) && isFiniteNum(frame.yb) && isFiniteNum(frame.zb);

    const leftAngleDeg = hasLeftQ
      ? extractZXYEulerYDeg(
          makeSensorQuaternion(
            Number(frame.wol),
            Number(frame.xol),
            Number(frame.yol),
            Number(frame.zol),
          ),
        )
      : (asNumber(frame.angle_left) ?? 0);

    const rightAngleDeg = hasRightQ
      ? extractZXYEulerYDeg(
          makeSensorQuaternion(
            Number(frame.wor),
            Number(frame.xor),
            Number(frame.yor),
            Number(frame.zor),
          ),
        )
      : (asNumber(frame.angle_right) ?? 0);

    const leftFallback = fallbackFromAngle(leftAngleDeg, "left");
    const rightFallback = fallbackFromAngle(rightAngleDeg, "right");

    const leftTip = hasLeftQ && hasBoatQ
      ? computeOarTipXY(
          makeSensorQuaternion(Number(frame.wol), Number(frame.xol), Number(frame.yol), Number(frame.zol)),
          makeSensorQuaternion(Number(frame.wb), Number(frame.xb), Number(frame.yb), Number(frame.zb)),
          Number(frame.err_deg_oar_left_z ?? 0),
          Number(frame.err_deg_boat_z ?? 0),
          [12.0, 200.0, 3.0]
        )
      : null;

    const rightTip = hasRightQ && hasBoatQ
      ? computeOarTipXY(
          makeSensorQuaternion(Number(frame.wor), Number(frame.xor), Number(frame.yor), Number(frame.zor)),
          makeSensorQuaternion(Number(frame.wb), Number(frame.xb), Number(frame.yb), Number(frame.zb)),
          Number(frame.err_deg_oar_right_z ?? 0),
          Number(frame.err_deg_boat_z ?? 0),
          [-12.0, 200.0, 3.0]
        )
      : null;

    return {
      frameNumber: asNumber(frame.number) ?? index,
      leftX: pickValue(frame, TRAJECTORY_KEYS.leftX) ?? leftTip?.x ?? leftFallback.x,
      leftZ: pickValue(frame, TRAJECTORY_KEYS.leftZ) ?? leftTip?.z ?? leftFallback.z,
      rightX: pickValue(frame, TRAJECTORY_KEYS.rightX) ?? rightTip?.x ?? rightFallback.x,
      rightZ: pickValue(frame, TRAJECTORY_KEYS.rightZ) ?? rightTip?.z ?? rightFallback.z,
      leftAngleDeg,
      rightAngleDeg,
    };
  });
};

