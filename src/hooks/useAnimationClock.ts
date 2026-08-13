import { useEffect, useRef, useState } from 'react';

type AnimationClockParams = {
  frameCount: number;
  fps: number;
  isPlaying: boolean;
  seekFrame: number;
};

interface ClockFrameState {
  frameIndex: number;
  frameCount: number;
  seekFrame: number;
}

export function clampFrameIndex(frameCount: number, frameIndex: number): number {
  if (!Number.isFinite(frameIndex) || frameCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(frameIndex, frameCount - 1));
}

export function advanceFrameIndex(
  frameCount: number,
  frameIndex: number,
  elapsedFrames: number,
): number {
  if (frameCount <= 0) return 0;
  const safeFrame = clampFrameIndex(frameCount, frameIndex);
  const safeElapsed = Math.max(0, Math.floor(elapsedFrames));
  return (safeFrame + safeElapsed) % frameCount;
}

export function useAnimationClock({ frameCount, fps, isPlaying, seekFrame }: AnimationClockParams) {
  const frameRef = useRef<number>(0);
  const [clockFrame, setClockFrame] = useState<ClockFrameState>(() => ({
    frameIndex: clampFrameIndex(frameCount, seekFrame),
    frameCount,
    seekFrame,
  }));

  const safeSeekFrame = clampFrameIndex(frameCount, seekFrame);
  const uiFrame = clockFrame.frameCount === frameCount && clockFrame.seekFrame === seekFrame
    ? clampFrameIndex(frameCount, clockFrame.frameIndex)
    : safeSeekFrame;

  useEffect(() => {
    frameRef.current = safeSeekFrame;
  }, [safeSeekFrame]);

  useEffect(() => {
    if (!isPlaying || frameCount <= 1) {
      return;
    }

    const frameDuration = 1000 / Math.max(fps, 1);
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      accumulator += now - lastTime;
      lastTime = now;

      const elapsedFrames = Math.floor(accumulator / frameDuration);
      if (elapsedFrames > 0) {
        frameRef.current = advanceFrameIndex(frameCount, frameRef.current, elapsedFrames);
        accumulator -= elapsedFrames * frameDuration;
        setClockFrame({ frameIndex: frameRef.current, frameCount, seekFrame });
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, fps, frameCount, seekFrame]);

  return { uiFrame };
}
