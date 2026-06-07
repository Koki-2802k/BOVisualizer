import { describe, expect, it } from 'vitest';
import { detectStrokesInternal } from '../utils/strokeDetect';
import type { TrajectoryPoint } from '../utils/trajectory';
import type { NormalizedFrame } from '../domain/schema';

/**
 * ヘルパー: 合成 NormalizedFrame を生成する。
 * 最低限のフィールドのみを埋め、FPS は timeSec から推定させる。
 */
function makeFrames(count: number, fps: number): NormalizedFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    arrayIndex: i,
    csvNumber: i,
    timeSec: i / fps,
    timeStr: null,
    leftOarQ: { w: null, x: null, y: null, z: null },
    rightOarQ: { w: null, x: null, y: null, z: null },
    boatQ: { w: null, x: null, y: null, z: null },
    angleDegLeft: 0,
    angleDegRight: 0,
    tipLeftX: 0,
    tipLeftZ: 0,
    tipRightX: 0,
    tipRightZ: 0,
    errDegOarLeftZ: null,
    errDegOarRightZ: null,
    errDegBoatZ: null,
    latitude: null,
    longitude: null,
    metrics: {} as any,
  })) as NormalizedFrame[];
}

/**
 * ヘルパー: Z 座標パターンから TrajectoryPoint 配列を生成する。
 * パターンは { start, end, leftZ, rightZ } の配列で指定。
 * 未指定のフレームはデフォルト値（空中: Z=0）になる。
 */
function makeTrajectory(
  count: number,
  patterns: Array<{ start: number; end: number; leftZ: number; rightZ: number }>,
): TrajectoryPoint[] {
  const traj: TrajectoryPoint[] = Array.from({ length: count }, (_, i) => ({
    frameNumber: i,
    leftX: 0,
    leftZ: 0,   // 空中（デフォルト）
    rightX: 0,
    rightZ: 0,  // 空中（デフォルト）
    leftAngleDeg: 0,
    rightAngleDeg: 0,
  }));

  for (const p of patterns) {
    for (let i = p.start; i <= p.end; i++) {
      traj[i].leftZ = p.leftZ;
      traj[i].rightZ = p.rightZ;
    }
  }

  return traj;
}

describe('chattering resistance tests', () => {
  const FPS = 60;

  describe('catch chattering: brief water touch → air → real entry', () => {
    it('merges a brief water dip before the actual catch into a single stroke', () => {
      // パターン: 
      //   フレーム 0-49: リカバリー（空中）
      //   フレーム 50-53: 短い入水（左だけ、チャタリング）— 4フレーム ≈ 0.067秒
      //   フレーム 54-57: 空中（離水）— ギャップ 4フレーム ≈ 0.067秒
      //   フレーム 58-61: キャッチ（左先行、右が61で合流）
      //   フレーム 62-150: ドライブ（両方水中）
      //   フレーム 151-155: フィニッシュ（右先行して出水、左が155で出水）
      //   フレーム 156-199: リカバリー（空中）
      const count = 200;
      const traj = makeTrajectory(count, [
        // チャタリング: 短い入水（左だけ）
        { start: 50, end: 53, leftZ: -35, rightZ: 0 },
        // 本来のキャッチ
        { start: 58, end: 60, leftZ: -35, rightZ: 0 },      // 左だけ水中
        { start: 61, end: 61, leftZ: -40, rightZ: -35 },     // 両方水中（catchEnd）
        // ドライブ
        { start: 62, end: 150, leftZ: -50, rightZ: -50 },
        // フィニッシュ
        { start: 151, end: 153, leftZ: -40, rightZ: 0 },     // 右が先に出水
        { start: 154, end: 155, leftZ: -35, rightZ: 0 },     // 左もまだ水中
      ]);
      const frames = makeFrames(count, FPS);
      const strokes = detectStrokesInternal(frames, traj);

      // 1つのストロークとして検出されるべき
      expect(strokes.length).toBe(1);
      const phases = strokes[0].phases;

      // recovery → catch → drive → finish の4位相
      expect(phases[0].phase).toBe('recovery');
      expect(phases[1].phase).toBe('catch');
      expect(phases[2].phase).toBe('drive');
      expect(phases[3].phase).toBe('finish');

      // ドライブが存在し、十分な長さがある
      const drive = phases.find(p => p.phase === 'drive')!;
      expect(drive.endFrame - drive.startFrame + 1).toBeGreaterThan(50);
    });
  });

  describe('finish chattering: real exit → brief re-entry → final exit', () => {
    it('merges a brief re-entry after the actual finish into the same stroke', () => {
      // パターン:
      //   フレーム 0-29: リカバリー（空中）
      //   フレーム 30-33: キャッチ（左先行、右が33で合流）
      //   フレーム 34-120: ドライブ（両方水中）
      //   フレーム 121-125: フィニッシュ（右先行して出水、左が125で出水）
      //   フレーム 126-128: 空中 — ギャップ 3フレーム ≈ 0.05秒
      //   フレーム 129-132: 短い再入水（チャタリング）— 4フレーム
      //   フレーム 133-199: リカバリー（空中）
      const count = 200;
      const traj = makeTrajectory(count, [
        // キャッチ
        { start: 30, end: 32, leftZ: -35, rightZ: 0 },
        { start: 33, end: 33, leftZ: -40, rightZ: -35 },
        // ドライブ
        { start: 34, end: 120, leftZ: -50, rightZ: -50 },
        // フィニッシュ
        { start: 121, end: 123, leftZ: -40, rightZ: 0 },
        { start: 124, end: 125, leftZ: -35, rightZ: 0 },
        // チャタリング: 短い再入水
        { start: 129, end: 132, leftZ: -35, rightZ: 0 },
      ]);
      const frames = makeFrames(count, FPS);
      const strokes = detectStrokesInternal(frames, traj);

      // 1つのストロークとして検出されるべき（チャタリングが2つ目のストロークにならない）
      expect(strokes.length).toBe(1);
      const phases = strokes[0].phases;

      // ドライブが存在し、十分な長さがある
      const drive = phases.find(p => p.phase === 'drive')!;
      expect(drive).toBeDefined();
      expect(drive.endFrame - drive.startFrame + 1).toBeGreaterThan(50);
    });
  });

  describe('no chattering: normal consecutive strokes should not be merged', () => {
    it('keeps two normal strokes separate', () => {
      // パターン: 2つの正常なストローク
      //   ストローク1: キャッチ30-33, ドライブ34-90, フィニッシュ91-95
      //   リカバリー: 96-149（空中、54フレーム ≈ 0.9秒）
      //   ストローク2: キャッチ150-153, ドライブ154-210, フィニッシュ211-215
      const count = 250;
      const traj = makeTrajectory(count, [
        // ストローク1 キャッチ
        { start: 30, end: 32, leftZ: -35, rightZ: 0 },
        { start: 33, end: 33, leftZ: -40, rightZ: -35 },
        // ストローク1 ドライブ
        { start: 34, end: 90, leftZ: -50, rightZ: -50 },
        // ストローク1 フィニッシュ
        { start: 91, end: 93, leftZ: -40, rightZ: 0 },
        { start: 94, end: 95, leftZ: -35, rightZ: 0 },
        // ストローク2 キャッチ
        { start: 150, end: 152, leftZ: -35, rightZ: 0 },
        { start: 153, end: 153, leftZ: -40, rightZ: -35 },
        // ストローク2 ドライブ
        { start: 154, end: 210, leftZ: -50, rightZ: -50 },
        // ストローク2 フィニッシュ
        { start: 211, end: 213, leftZ: -40, rightZ: 0 },
        { start: 214, end: 215, leftZ: -35, rightZ: 0 },
      ]);
      const frames = makeFrames(count, FPS);
      const strokes = detectStrokesInternal(frames, traj);

      // 2つの別々のストロークとして検出されるべき
      expect(strokes.length).toBe(2);
    });
  });

  describe('edge case: both catch and finish chattering in same stroke', () => {
    it('handles chattering at both ends of a stroke', () => {
      // キャッチ前にチャタリング、フィニッシュ後にもチャタリング
      const count = 250;
      const traj = makeTrajectory(count, [
        // キャッチ前のチャタリング
        { start: 28, end: 30, leftZ: -32, rightZ: 0 },   // 3フレーム（短い）
        // ギャップ（31-34: 空中）
        // 本来のキャッチ
        { start: 35, end: 37, leftZ: -35, rightZ: 0 },
        { start: 38, end: 38, leftZ: -40, rightZ: -35 },
        // ドライブ
        { start: 39, end: 140, leftZ: -50, rightZ: -50 },
        // フィニッシュ
        { start: 141, end: 143, leftZ: -40, rightZ: 0 },
        { start: 144, end: 145, leftZ: -35, rightZ: 0 },
        // フィニッシュ後のチャタリング（ギャップ 146-148）
        { start: 149, end: 151, leftZ: -32, rightZ: 0 },  // 3フレーム（短い）
      ]);
      const frames = makeFrames(count, FPS);
      const strokes = detectStrokesInternal(frames, traj);

      expect(strokes.length).toBe(1);
      const phases = strokes[0].phases;
      const drive = phases.find(p => p.phase === 'drive')!;
      expect(drive).toBeDefined();
      expect(drive.endFrame - drive.startFrame + 1).toBeGreaterThan(50);
    });
  });
});
