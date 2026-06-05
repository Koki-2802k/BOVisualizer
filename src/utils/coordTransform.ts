import { Euler, MathUtils, Quaternion, Vector3 } from "three";

export type SensorQuaternion = {
  w: number;
  x: number;
  y: number;
  z: number;
};

export type RigQuaternions = {
  boat: SensorQuaternion;
  left: SensorQuaternion;
  right: SensorQuaternion;
};

export type TransformedRigQuaternions = {
  boat: Quaternion;
  left: Quaternion;
  right: Quaternion;
};

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const SENSOR_TO_THREE_QUATERNION = new Quaternion().setFromAxisAngle(AXIS_X, -Math.PI / 2);
const SENSOR_TO_THREE_QUATERNION_INV = SENSOR_TO_THREE_QUATERNION.clone().invert();
const LEFT_OAR_FIXED_ROTATION = new Euler(Math.PI, 0, Math.PI - 4 * Math.PI / 18, "XYZ");
const RIGHT_OAR_FIXED_ROTATION = new Euler(-Math.PI, 0, Math.PI - 3 * Math.PI / 18, "XYZ");


export type OarSide = "left" | "right";

function buildFixedRotationQuaternion(side: OarSide): Quaternion {
  return new Quaternion().setFromEuler(side === "left" ? LEFT_OAR_FIXED_ROTATION : RIGHT_OAR_FIXED_ROTATION);
}

function mirrorRightOarSensorQuaternion(sensorQuaternion: SensorQuaternion): SensorQuaternion {
  return {
    w: sensorQuaternion.w,
    x: -sensorQuaternion.x,
    y: -sensorQuaternion.y,
    z: sensorQuaternion.z,
  };
}

function applyOarSideSensorConvention(sensorQuaternion: SensorQuaternion, side: OarSide): SensorQuaternion {
  return side === "right" ? mirrorRightOarSensorQuaternion(sensorQuaternion) : sensorQuaternion;
}

export function getOarFixedRotation(side: OarSide): [number, number, number] {
  const rotation = side === "left" ? LEFT_OAR_FIXED_ROTATION : RIGHT_OAR_FIXED_ROTATION;
  return [rotation.x, rotation.y, rotation.z];
}

function negateIfNeeded(current: Quaternion, previous?: Quaternion): Quaternion {
  if (previous && clampQuaternionDot(current, previous) < 0) {
    current.set(-current.x, -current.y, -current.z, -current.w);
  }
  return current;
}

export function clampQuaternionDot(current: Quaternion, previous: Quaternion): number {
  return MathUtils.clamp(current.dot(previous), -1, 1);
}

export function sensorVectorToThree(vector: Vector3): Vector3 {
  return new Vector3(vector.x, vector.z, -vector.y);
}

export function normalizeSensorQuaternion(input: SensorQuaternion): Quaternion {
  const w = typeof input.w === "number" && Number.isFinite(input.w) ? input.w : 1;
  const x = typeof input.x === "number" && Number.isFinite(input.x) ? input.x : 0;
  const y = typeof input.y === "number" && Number.isFinite(input.y) ? input.y : 0;
  const z = typeof input.z === "number" && Number.isFinite(input.z) ? input.z : 0;

  const lenSq = w * w + x * x + y * y + z * z;
  if (lenSq < 1e-8) {
    return new Quaternion(0, 0, 0, 1);
  }

  const normalized = new Quaternion(x, y, z, w);
  normalized.normalize();
  return normalized;
}

export function sensorQuaternionToThree(
  sensorQuaternion: SensorQuaternion,
  previousQuaternion?: Quaternion,
): Quaternion {
  const normalizedSensor = normalizeSensorQuaternion(sensorQuaternion);
  const converted = SENSOR_TO_THREE_QUATERNION
    .clone()
    .multiply(normalizedSensor)
    .multiply(SENSOR_TO_THREE_QUATERNION_INV);

  return negateIfNeeded(converted, previousQuaternion);
}

export function buildPivotQuaternion(
  sensorQuaternion: SensorQuaternion,
  correctionDegZ: number,
  side: OarSide = "left",
  previousQuaternion?: Quaternion,
  boatCorrectionDegZ = 0,
): Quaternion {
  // sensor Z-axis maps to three Y-axis under sensor(x,y,z)->three(x,z,-y)
  const boatCorrection = new Quaternion().setFromAxisAngle(AXIS_Y, MathUtils.degToRad(boatCorrectionDegZ));
  const oarCorrection = new Quaternion().setFromAxisAngle(AXIS_Y, MathUtils.degToRad(-correctionDegZ));
  const dynamic = sensorQuaternionToThree(applyOarSideSensorConvention(sensorQuaternion, side));
  const pivot = boatCorrection.clone().multiply(oarCorrection).multiply(dynamic).normalize();

  return negateIfNeeded(pivot, previousQuaternion);
}

export function transformRigQuaternions(
  input: RigQuaternions,
  previous?: Partial<TransformedRigQuaternions>,
): TransformedRigQuaternions {
  const boat = sensorQuaternionToThree(input.boat, previous?.boat);
  const left = sensorQuaternionToThree(applyOarSideSensorConvention(input.left, "left"))
    .multiply(buildFixedRotationQuaternion("left"))
    .normalize();
  const right = sensorQuaternionToThree(applyOarSideSensorConvention(input.right, "right"))
    .multiply(buildFixedRotationQuaternion("right"))
    .normalize();

  negateIfNeeded(left, previous?.left);
  negateIfNeeded(right, previous?.right);

  return { boat, left, right };
}

export function makeSensorQuaternion(w: number, x: number, y: number, z: number): SensorQuaternion {
  return { w, x, y, z };
}

// ── Oarlock constants (殿御指示: right_pivot.z = -left_pivot.z) ──
export const LEFT_OARLOCK: [number, number, number] = [0, 0.39, -1.23];
export const RIGHT_OARLOCK: [number, number, number] = [0, 0.39, 1.23];

/**
 * ZXY内因性分解のY成分(= ry_left / ry_right in MainWindow.py)。
 * OarTrajectoryChart の | シンボル回転角(度)として使用。
 */
export function extractZXYEulerYDeg(q: SensorQuaternion): number {
  const w = typeof q.w === "number" && Number.isFinite(q.w) ? q.w : 1;
  const x = typeof q.x === "number" && Number.isFinite(q.x) ? q.x : 0;
  const y = typeof q.y === "number" && Number.isFinite(q.y) ? q.y : 0;
  const z = typeof q.z === "number" && Number.isFinite(q.z) ? q.z : 0;

  const yVal = 2 * (x * z + w * y);
  const xVal = w * w - x * x - y * y + z * z;

  if (!Number.isFinite(yVal) || !Number.isFinite(xVal)) {
    return 0;
  }

  return MathUtils.radToDeg(Math.atan2(yVal, xVal));
}

/**
 * MainWindow.py の RotateMatrix_left/right × 初期位置に相当。
 * センサー生値クォータニオン + Z回転補正 を初期位置ベクトルに適用し、
 * オール先端の XY 座標を cm 単位で返す。
 */
export function computeOarTipXY(
  oarQ: SensorQuaternion,
  boatQ: SensorQuaternion,
  errDegOarZ: number,
  errDegBoatZ: number,
  initialCm: [number, number, number],
): { x: number; z: number } {
  const ow = typeof oarQ.w === "number" && Number.isFinite(oarQ.w) ? oarQ.w : 1;
  const ox = typeof oarQ.x === "number" && Number.isFinite(oarQ.x) ? oarQ.x : 0;
  const oy = typeof oarQ.y === "number" && Number.isFinite(oarQ.y) ? oarQ.y : 0;
  const oz = typeof oarQ.z === "number" && Number.isFinite(oarQ.z) ? oarQ.z : 0;

  const bw = typeof boatQ.w === "number" && Number.isFinite(boatQ.w) ? boatQ.w : 1;
  const bx = typeof boatQ.x === "number" && Number.isFinite(boatQ.x) ? boatQ.x : 0;
  const by = typeof boatQ.y === "number" && Number.isFinite(boatQ.y) ? boatQ.y : 0;
  const bz = typeof boatQ.z === "number" && Number.isFinite(boatQ.z) ? boatQ.z : 0;

  const validOarLen = ow * ow + ox * ox + oy * oy + oz * oz;
  const validBoatLen = bw * bw + bx * bx + by * by + bz * bz;

  const safeOarQ = validOarLen < 1e-8 ? new Quaternion(0, 0, 0, 1) : new Quaternion(ox, oy, oz, ow).normalize();
  const safeBoatQ = validBoatLen < 1e-8 ? new Quaternion(0, 0, 0, 1) : new Quaternion(bx, by, bz, bw).normalize();

  const boatYawRad = Math.atan2(
    2 * (safeBoatQ.x * safeBoatQ.y + safeBoatQ.w * safeBoatQ.z),
    safeBoatQ.w * safeBoatQ.w + safeBoatQ.x * safeBoatQ.x - safeBoatQ.y * safeBoatQ.y - safeBoatQ.z * safeBoatQ.z,
  );

  const safeErrOar = typeof errDegOarZ === "number" && Number.isFinite(errDegOarZ) ? errDegOarZ : 0;
  const safeErrBoat = typeof errDegBoatZ === "number" && Number.isFinite(errDegBoatZ) ? errDegBoatZ : 0;

  const totalZRad = -boatYawRad - MathUtils.degToRad(safeErrOar) + MathUtils.degToRad(safeErrBoat);

  const qZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), totalZRad);

  const v = new Vector3(...initialCm);
  v.applyQuaternion(safeOarQ);
  v.applyQuaternion(qZ);

  return { x: v.x, z: v.z };
}

