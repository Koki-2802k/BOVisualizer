import { describe, expect, it } from 'vitest';
import {
  integrateVelocitySeries,
  buildElapsedSeconds,
} from '../utils/velocityIntegration';
import type { NormalizedFrame } from '../domain/schema';

// 等間隔の時刻軸を生成
const makeTime = (n: number, dt = 0.1): number[] =>
  Array.from({ length: n }, (_, i) => i * dt);

describe('integrateVelocitySeries', () => {
  it('一定加速度を正しく積分しアンカーを通過する (v = v0 + a t)', () => {
    const a = 1; // m/s²
    const dt = 0.1;
    const N = 11; // 0.0 〜 1.0 s
    const time = makeTime(N, dt);
    const accel = Array.from({ length: N }, () => a);
    // 実測アンカー: 始点 v=2、終点 v=2 + a*1.0 = 3（理論値と一致させる）
    const measured = Array.from({ length: N }, () => null as number | null);
    measured[0] = 2;
    measured[N - 1] = 3;

    const res = integrateVelocitySeries(accel, time, measured);
    expect(res.usable).toBe(true);
    expect(res.anchorCount).toBe(2);
    // 端点拘束
    expect(res.integrated[0]).toBeCloseTo(2, 9);
    expect(res.integrated[N - 1]).toBeCloseTo(3, 9);
    // 中間点 t=0.5 → v=2.5
    expect(res.integrated[5]).toBeCloseTo(2.5, 6);
  });

  it('加速度に定数バイアスを加えてもアンカー間の値が不変（線形デドリフト）', () => {
    const dt = 0.1;
    const N = 11;
    const time = makeTime(N, dt);
    const base = Array.from({ length: N }, (_, i) => Math.sin(i)); // 任意の高周波
    const measured = Array.from({ length: N }, () => null as number | null);
    measured[0] = 3;
    measured[N - 1] = 3;

    const noBias = integrateVelocitySeries(base, time, measured);
    const withBias = integrateVelocitySeries(
      base.map((x) => x + 5), // +5 m/s² のバイアス
      time,
      measured,
    );

    for (let i = 0; i < N; i += 1) {
      expect(withBias.integrated[i]!).toBeCloseTo(noBias.integrated[i]!, 6);
    }
  });

  it('全アンカー点で実測値に一致する', () => {
    const dt = 0.1;
    const N = 21;
    const time = makeTime(N, dt);
    const accel = Array.from({ length: N }, (_, i) => Math.cos(i / 2));
    const measured = Array.from({ length: N }, () => null as number | null);
    measured[0] = 2.0;
    measured[10] = 2.8;
    measured[20] = 2.5;

    const res = integrateVelocitySeries(accel, time, measured);
    expect(res.anchorCount).toBe(3);
    expect(res.integrated[0]).toBeCloseTo(2.0, 9);
    expect(res.integrated[10]).toBeCloseTo(2.8, 9);
    expect(res.integrated[20]).toBeCloseTo(2.5, 9);
  });

  it('アンカーが1個以下なら usable=false で実測値を返す', () => {
    const N = 5;
    const time = makeTime(N);
    const accel = Array.from({ length: N }, () => 1);
    const measured = [null, null, 3, null, null] as (number | null)[];
    const res = integrateVelocitySeries(accel, time, measured);
    expect(res.usable).toBe(false);
    expect(res.anchorCount).toBe(1);
    expect(res.integrated).toEqual(measured);
  });

  it('空配列でクラッシュしない', () => {
    const res = integrateVelocitySeries([], [], []);
    expect(res.usable).toBe(false);
    expect(res.integrated).toEqual([]);
  });

  it('加速度欠損(null)を含んでも算出が継続する', () => {
    const N = 11;
    const time = makeTime(N);
    const accel = Array.from({ length: N }, () => 1 as number | null);
    accel[5] = null;
    const measured = Array.from({ length: N }, () => null as number | null);
    measured[0] = 2;
    measured[N - 1] = 3;
    const res = integrateVelocitySeries(accel, time, measured);
    expect(res.usable).toBe(true);
    expect(res.integrated.every((x) => x !== null && Number.isFinite(x))).toBe(true);
  });
});

describe('buildElapsedSeconds', () => {
  const baseFrame = (over: Partial<NormalizedFrame>): NormalizedFrame =>
    ({
      arrayIndex: 0,
      csvNumber: null,
      timeStr: null,
      timeSec: null,
      leftOarQ: { w: null, x: null, y: null, z: null },
      rightOarQ: { w: null, x: null, y: null, z: null },
      boatQ: { w: null, x: null, y: null, z: null },
      angleDegLeft: null,
      angleDegRight: null,
      errDegOarLeftZ: null,
      errDegOarRightZ: null,
      errDegBoatZ: null,
      tipLeftX: null,
      tipLeftZ: null,
      tipRightX: null,
      tipRightZ: null,
      gpsLat: null,
      gpsLon: null,
      metrics: {} as NormalizedFrame['metrics'],
      ...over,
    }) as NormalizedFrame;

  it('timeSec を先頭基準で正規化する', () => {
    const frames = [
      baseFrame({ timeSec: 100 }),
      baseFrame({ timeSec: 100.5 }),
      baseFrame({ timeSec: 101 }),
    ];
    expect(buildElapsedSeconds(frames)).toEqual([0, 0.5, 1]);
  });

  it('timeSec が無ければ index/60 にフォールバックする', () => {
    const frames = [baseFrame({}), baseFrame({}), baseFrame({})];
    const t = buildElapsedSeconds(frames);
    expect(t[0]).toBeCloseTo(0, 9);
    expect(t[1]).toBeCloseTo(1 / 60, 9);
    expect(t[2]).toBeCloseTo(2 / 60, 9);
  });
});
