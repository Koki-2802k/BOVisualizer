import { useEffect, useRef, useState } from 'react';

type AnimationClockParams = {
  frameCount: number;
  fps: number;
  isPlaying: boolean;
  seekFrame: number;
};

export function clampFrameIndex(frameCount: number, frameIndex: number): number {
  if (!Number.isFinite(frameIndex) || frameCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(frameIndex, frameCount - 1));
}

export function useAnimationClock({ frameCount, fps, isPlaying, seekFrame }: AnimationClockParams) {
  const frameRef = useRef<number>(0);
  const [uiFrame, setUiFrame] = useState<number>(0);

  useEffect(() => {
    const safeFrame = clampFrameIndex(frameCount, seekFrame);
    frameRef.current = safeFrame;
    setUiFrame(safeFrame);
  }, [seekFrame, frameCount]);

  useEffect(() => {
    if (!isPlaying || frameCount <= 1) {
      return;
    }

    if (frameRef.current >= frameCount) {
      frameRef.current = clampFrameIndex(frameCount, frameRef.current);
      setUiFrame(frameRef.current);
    }

    const frameDuration = 1000 / Math.max(fps, 1);
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      accumulator += now - lastTime;
      lastTime = now;

      while (accumulator >= frameDuration) {
        frameRef.current = (frameRef.current + 1) % frameCount;
        accumulator -= frameDuration;
      }

      setUiFrame(frameRef.current);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, fps, frameCount]);

  return { frameRef, uiFrame, setUiFrame };
}
