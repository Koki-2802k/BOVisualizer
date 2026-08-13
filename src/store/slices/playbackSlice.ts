/**
 * playbackSlice.ts — 再生制御スライス
 *
 * 責務: isPlaying / fps / seekFrame / maxFrame のみを保持。
 * 他スライスへの依存なし。
 */
import type { StateCreator } from 'zustand';
import type { PlaybackSlice, PlaybackState } from '../types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const createPlaybackSlice: StateCreator<PlaybackState, [], [], PlaybackSlice> = (set, get) => ({
  isPlaying: false,
  fps: 30,
  seekFrame: 0,
  maxFrame: 0,

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setFps: (fps) => set({ fps: clamp(Math.round(fps), 1, 120) }),

  setSeekFrame: (seekFrame) => {
    const { maxFrame } = get();
    set({ seekFrame: clamp(Math.round(seekFrame), 0, maxFrame) });
  },

  setMaxFrame: (maxFrame) => {
    const safeMax = Math.max(0, Math.round(maxFrame));
    const { seekFrame } = get();
    set({ maxFrame: safeMax, seekFrame: clamp(seekFrame, 0, safeMax) });
  },
});
