import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import {
  buildPivotQuaternion,
  clampQuaternionDot,
  extractZXYEulerYDeg,
  LEFT_OARLOCK,
  getOarFixedRotation,
  makeSensorQuaternion,
  normalizeSensorQuaternion,
  RIGHT_OARLOCK,
  sensorQuaternionToThree,
  sensorVectorToThree,
  transformRigQuaternions,
} from "../utils/coordTransform";

describe("coordTransform", () => {
  it("maps sensor vector axes to three axes", () => {
    const input = new Vector3(2, 3, 4);
    const transformed = sensorVectorToThree(input);

    expect(transformed.x).toBe(2);
    expect(transformed.y).toBe(4);
    expect(transformed.z).toBe(-3);
  });

  it("normalizes input quaternion", () => {
    const normalized = normalizeSensorQuaternion(makeSensorQuaternion(2, 0, 0, 0));

    expect(normalized.w).toBeCloseTo(1, 6);
    expect(normalized.x).toBeCloseTo(0, 6);
    expect(normalized.y).toBeCloseTo(0, 6);
    expect(normalized.z).toBeCloseTo(0, 6);
  });

  it("applies qM * qSensor * inverse(qM)", () => {
    const sensor = makeSensorQuaternion(Math.sqrt(0.5), 0, Math.sqrt(0.5), 0);
    const transformed = sensorQuaternionToThree(sensor);
    const qM = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const expected = qM
      .clone()
      .multiply(new Quaternion(sensor.x, sensor.y, sensor.z, sensor.w).normalize())
      .multiply(qM.clone().invert());

    expect(transformed.x).toBeCloseTo(expected.x, 6);
    expect(transformed.y).toBeCloseTo(expected.y, 6);
    expect(transformed.z).toBeCloseTo(expected.z, 6);
    expect(transformed.w).toBeCloseTo(expected.w, 6);
  });

  it("flips sign for continuity when dot is negative", () => {
    const prev = new Quaternion(0, 0, 0, 1);
    const current = sensorQuaternionToThree(makeSensorQuaternion(-1, 0, 0, 0), prev);

    expect(current.w).toBeCloseTo(1, 6);
  });

  it("clamps quaternion dot products into a safe acos range", () => {
    const current = new Quaternion(2, 0, 0, 0);
    const previous = new Quaternion(2, 0, 0, 0);

    const dot = clampQuaternionDot(current, previous);

    expect(dot).toBe(1);
    expect(Number.isNaN(Math.acos(dot))).toBe(false);
  });

  it("transforms boat/left/right in one helper", () => {
    const identity = makeSensorQuaternion(1, 0, 0, 0);
    const result = transformRigQuaternions({ boat: identity, left: identity, right: identity });

    expect(result.boat.length()).toBeCloseTo(1, 6);
    expect(result.left.length()).toBeCloseTo(1, 6);
    expect(result.right.length()).toBeCloseTo(1, 6);
  });

  it("applies initial Z-error correction around three Y-axis", () => {
    const pivot = buildPivotQuaternion(makeSensorQuaternion(1, 0, 0, 0), 90, "left");
    const forward = new Vector3(0, 0, 1).applyQuaternion(pivot);

    expect(forward.x).toBeCloseTo(-1, 6);
    expect(forward.y).toBeCloseTo(0, 6);
    expect(forward.z).toBeCloseTo(0, 6);
  });

  it("applies boat Z-error correction around three Y-axis", () => {
    const pivot = buildPivotQuaternion(makeSensorQuaternion(1, 0, 0, 0), 0, "left", undefined, 90);
    const forward = new Vector3(0, 0, 1).applyQuaternion(pivot);

    expect(forward.x).toBeCloseTo(1, 6);
    expect(forward.y).toBeCloseTo(0, 6);
    expect(forward.z).toBeCloseTo(0, 6);
  });

  it("combines oar and boat Z-error corrections as -err_oar + err_boat", () => {
    const pivot = buildPivotQuaternion(makeSensorQuaternion(1, 0, 0, 0), 30, "left", undefined, 90);
    const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 3);
    const actualForward = new Vector3(0, 0, 1).applyQuaternion(pivot);
    const expectedForward = new Vector3(0, 0, 1).applyQuaternion(expected);

    expect(actualForward.x).toBeCloseTo(expectedForward.x, 6);
    expect(actualForward.y).toBeCloseTo(expectedForward.y, 6);
    expect(actualForward.z).toBeCloseTo(expectedForward.z, 6);
  });

  it("keeps right-oar fixed correction in coordTransform helpers", () => {
    expect(getOarFixedRotation("left")).toEqual([Math.PI, 0, Math.PI]);
    expect(getOarFixedRotation("right")).toEqual([-Math.PI, 0, Math.PI]);
  });

  it("matches the former right-oar sensor mirror convention before fixed rotation", () => {
    const sensor = makeSensorQuaternion(0.9238795325, 0.1, 0.2, 0.3);
    const mirroredFormerSensor = makeSensorQuaternion(sensor.w, -sensor.x, -sensor.y, sensor.z);
    const former = sensorQuaternionToThree(mirroredFormerSensor)
      .multiply(new Quaternion().setFromEuler(new Euler(-Math.PI, 0, Math.PI, "XYZ")))
      .normalize();
    const web = transformRigQuaternions({
      boat: makeSensorQuaternion(1, 0, 0, 0),
      left: makeSensorQuaternion(1, 0, 0, 0),
      right: sensor,
    }).right;

    expect(web.x).toBeCloseTo(former.x, 6);
    expect(web.y).toBeCloseTo(former.y, 6);
    expect(web.z).toBeCloseTo(former.z, 6);
    expect(web.w).toBeCloseTo(former.w, 6);
  });

  it("applies the former right-oar sensor mirror in pivot quaternion", () => {
    const sensor = makeSensorQuaternion(0.9238795325, 0.1, 0.2, 0.3);
    const mirroredFormerSensor = makeSensorQuaternion(sensor.w, -sensor.x, -sensor.y, sensor.z);
    const formerPivot = sensorQuaternionToThree(mirroredFormerSensor);
    const webPivot = buildPivotQuaternion(sensor, 0, "right");

    expect(webPivot.x).toBeCloseTo(formerPivot.x, 6);
    expect(webPivot.y).toBeCloseTo(formerPivot.y, 6);
    expect(webPivot.z).toBeCloseTo(formerPivot.z, 6);
    expect(webPivot.w).toBeCloseTo(formerPivot.w, 6);
  });

  it("applies identical fixed corrections to left and right rig quaternions", () => {
    const identity = makeSensorQuaternion(1, 0, 0, 0);
    const result = transformRigQuaternions({ boat: identity, left: identity, right: identity });

    expect(Math.abs(result.left.dot(result.right))).toBeCloseTo(1, 6);
    expect(result.left.length()).toBeCloseTo(1, 6);
    expect(result.right.length()).toBeCloseTo(1, 6);
  });

  it("right oar fixed rotation is Euler(-Math.PI, 0, Math.PI)", () => {
    const [x, y, z] = getOarFixedRotation("right");

    expect(x).toBeCloseTo(-Math.PI);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(Math.PI);
  });

  it("keeps oarlock coordinates symmetric across the Z axis", () => {
    expect(LEFT_OARLOCK[0]).toBeCloseTo(RIGHT_OARLOCK[0], 6);
    expect(LEFT_OARLOCK[1]).toBeCloseTo(RIGHT_OARLOCK[1], 6);
    expect(Math.abs(LEFT_OARLOCK[2] + RIGHT_OARLOCK[2])).toBeLessThan(1e-6);
  });

  describe("オール座標系物理仕様（殿御確認済み 2026-05-08）", () => {
    it("LEFT_OARLOCK と RIGHT_OARLOCK は Z軸対称であること", () => {
      expect(LEFT_OARLOCK[0]).toBeCloseTo(RIGHT_OARLOCK[0], 5);
      expect(LEFT_OARLOCK[1]).toBeCloseTo(RIGHT_OARLOCK[1], 5);
      expect(LEFT_OARLOCK[2]).toBeCloseTo(-RIGHT_OARLOCK[2], 5);
    });

    it("進行方向反対から見て LEFT_OARLOCK は左(Z-)、RIGHT_OARLOCK は右(Z+)にあること", () => {
      expect(LEFT_OARLOCK[2]).toBeLessThan(0);
      expect(RIGHT_OARLOCK[2]).toBeGreaterThan(0);
    });
  });

  it("returns 0 degrees for the identity quaternion", () => {
    const q = makeSensorQuaternion(1, 0, 0, 0);

    expect(extractZXYEulerYDeg(q)).toBeCloseTo(0, 5);
  });

  it("returns about 90 degrees for a pure Y-axis rotation", () => {
    const q = makeSensorQuaternion(Math.cos(Math.PI / 4), 0, Math.sin(Math.PI / 4), 0);

    expect(extractZXYEulerYDeg(q)).toBeCloseTo(90, 3);
  });
});
