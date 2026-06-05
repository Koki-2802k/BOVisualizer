import { describe, expect, it } from 'vitest';
import { detectStrokes, computeStrokeMetrics } from '../utils/strokeDetector';
import type { RowingFrame } from '../types/rowing';

// Helper to generate a mock dataset simulating rowing stroke oar angles
function generateMockRowingData(
  frameCount: number,
  periodFrames: number,
  side: 'left' | 'right'
): RowingFrame[] {
  const frames: RowingFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    // Generate oar angle as a cosine wave
    // For left: Catch (max angle) is at peak, Finish (min angle) is at valley
    const phaseRad = (2 * Math.PI * i) / periodFrames;
    const angleValue = Math.cos(phaseRad) * 45 + 10; // amplitude of 45 deg, offset of 10 deg

    frames.push({
      number: i,
      time: new Date(2025, 0, 17, 17, 9, 25, i * (1000 / 30)).toISOString(),
      SPM: 60 / (periodFrames / 30), // SPM matching period
      angle_left: side === 'left' ? angleValue : 0,
      angle_right: side === 'right' ? -angleValue : 0,
    });
  }
  return frames;
}

function generateCombinedMockRowingData(frameCount: number, periodFrames: number): RowingFrame[] {
  const frames: RowingFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const phaseRad = (2 * Math.PI * i) / periodFrames;
    const angleValue = Math.cos(phaseRad) * 45 + 10;

    frames.push({
      number: i,
      time: new Date(2025, 0, 17, 17, 9, 25, i * (1000 / 30)).toISOString(),
      SPM: 60 / (periodFrames / 30),
      angle_left: angleValue,
      angle_right: -angleValue,
    });
  }
  return frames;
}

describe('detectStrokes peak detection & segmentation', () => {
  it('detects strokes and segments phases correctly for left oar', () => {
    // 150 frames, period of 60 frames (~2 seconds per stroke)
    // Catches (max angle) should be at indices 0, 60, 120
    // Finishes (min angle) should be at indices 30, 90
    const mockFrames = generateMockRowingData(150, 60, 'left');
    const strokes = detectStrokes(mockFrames, 'left');

    expect(strokes).toHaveLength(2);

    // Stroke 1: Catch 0 -> Catch 60, Finish 30
    const s1 = strokes[0];
    expect(s1.id).toBe(1);
    expect(s1.catchFrame).toBe(0);
    expect(s1.finishFrame).toBe(30);
    expect(s1.endFrame).toBe(60);

    // Stroke 2: Catch 60 -> Catch 120, Finish 90
    const s2 = strokes[1];
    expect(s2.id).toBe(2);
    expect(s2.catchFrame).toBe(60);
    expect(s2.finishFrame).toBe(90);
    expect(s2.endFrame).toBe(120);

    // Phase subdivision check for Stroke 1:
    // Drive length: 30 frames
    // Recovery length: 30 frames
    // entryFrame = c1 + Math.round(0.15 * 30) = 0 + 5 = 5
    // finishThresholdFrame = f - Math.round(0.15 * 30) = 30 - 5 = 25
    // exitFrame = f + Math.round(0.15 * 30) = 30 + 5 = 35
    expect(s1.entryFrame).toBe(5);
    expect(s1.finishThresholdFrame).toBe(25);
    expect(s1.exitFrame).toBe(35);
  });

  it('detects strokes and segments phases correctly for right oar', () => {
    // For right oar, catches are valleys (min angle) and finishes are peaks (max angle)
    // period of 50 frames
    // Catches should be at index 0, 50, 100 (valleys of oar angle)
    // Finishes should be at index 25, 75, 125 (peaks of oar angle)
    const mockFrames = generateMockRowingData(150, 50, 'right');
    const strokes = detectStrokes(mockFrames, 'right');

    expect(strokes.length).toBeGreaterThanOrEqual(2);

    // Stroke 1 should start at Catch 0, end at Catch 50, with Finish at 25
    const stroke1 = strokes[0];
    expect(stroke1.catchFrame).toBe(0);
    expect(stroke1.finishFrame).toBe(25);
    expect(stroke1.endFrame).toBe(50);

    // Stroke 2 should start at Catch 50, end at Catch 100, with Finish at 75
    const stroke2 = strokes[1];
    expect(stroke2.catchFrame).toBe(50);
    expect(stroke2.finishFrame).toBe(75);
    expect(stroke2.endFrame).toBe(100);
  });

  it('returns empty array when dataset is too short', () => {
    const mockFrames = generateMockRowingData(10, 60, 'left');
    const strokes = detectStrokes(mockFrames, 'left');
    expect(strokes).toEqual([]);
  });
});

describe('computeStrokeMetrics calculations & alignment', () => {
  it('correctly calculates metrics and aligns left and right strokes', () => {
    const mockFrames = generateCombinedMockRowingData(150, 60);
    const metrics = computeStrokeMetrics(mockFrames);

    expect(metrics).toHaveLength(2);

    const m1 = metrics[0];
    expect(m1.strokeId).toBe(1);
    expect(m1.catchFrame).toBe(0);
    expect(m1.left).toBeDefined();
    expect(m1.right).toBeDefined();

    // Check Left values
    // Left oar: Catch is at 0 (angle = Math.cos(0)*45+10 = 55, smoothed to 54.6)
    // Left oar: Finish is at 30 (angle = Math.cos(PI)*45+10 = -35, smoothed to -34.5)
    // Left sweep = 54.6 - (-34.5) = 89.1
    expect(m1.left!.catchAngle).toBeCloseTo(54.6, 1);
    expect(m1.left!.finishAngle).toBeCloseTo(-34.5, 1);
    expect(m1.left!.sweepAngle).toBeCloseTo(89.1, 1);
    expect(m1.left!.drivePercent).toBeCloseTo(50, 0); // 30 / 60 = 50%

    // Check Right values
    // Right oar: Catch is at 0 (angle = -55, smoothed to -54.6)
    // Right oar: Finish is at 30 (angle = 35, smoothed to 34.5)
    // Right sweep = |-54.6 - 34.5| = 89.1
    expect(m1.right!.catchAngle).toBeCloseTo(-54.6, 1);
    expect(m1.right!.finishAngle).toBeCloseTo(34.5, 1);
    expect(m1.right!.sweepAngle).toBeCloseTo(89.1, 1);
    expect(m1.right!.drivePercent).toBeCloseTo(50, 0);
  });
});
