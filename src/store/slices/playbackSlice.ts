/**
 * playbackSlice.ts — 再生制御スライス
 *
 * 責務: isPlaying / fps / seekFrame / maxFrame のみを保持。
 * 他スライスへの依存なし。
 */
import type { StateCreator } from 'zustand';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export type PlaybackSlice = {
  isPlaying: boolean;
  fps: number;
  seekFrame: number;
  maxFrame: number;
  setIsPlaying: (isPlaying: boolean) => void;
  setFps: (fps: number) => void;
  setSeekFrame: (seekFrame: number) => void;
  setMaxFrame: (maxFrame: number) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createPlaybackSlice: StateCreator<any, [], [], PlaybackSlice> = (set, get) => ({
  isPlaying: false,
  fps: 30,
  seekFrame: 0,
  maxFrame: 0,

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setFps: (fps) => set({ fps: clamp(Math.round(fps), 1, 120) }),

  setSeekFrame: (seekFrame) => {
    const { maxFrame } = get() as PlaybackSlice;
    set({ seekFrame: clamp(Math.round(seekFrame), 0, maxFrame) });
  },

  setMaxFrame: (maxFrame) => {
    const safeMax = Math.max(0, Math.round(maxFrame));
    const { seekFrame } = get() as PlaybackSlice;
    set({ maxFrame: safeMax, seekFrame: clamp(seekFrame, 0, safeMax) });
  },
});
