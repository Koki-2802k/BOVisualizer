import { useCallback, useEffect, useRef } from 'react';

export interface CanvasBox {
  width: number;
  height: number;
}

type CanvasDraw = (canvas: HTMLCanvasElement, box: CanvasBox) => void;

const MAX_MEASURE_RETRIES = 30;

const measureCanvas = (wrapper: HTMLDivElement): CanvasBox | null => {
  const { width, height } = wrapper.getBoundingClientRect();
  if (width <= 0 || height <= 0) return null;
  return { width: Math.round(width), height: Math.round(height) };
};

const resizeCanvas = (canvas: HTMLCanvasElement, box: CanvasBox): void => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(box.width * devicePixelRatio));
  const pixelHeight = Math.max(1, Math.round(box.height * devicePixelRatio));

  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.width = `${box.width}px`;
  canvas.style.height = `${box.height}px`;
};

export function useResponsiveCanvas(draw: CanvasDraw) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawRef = useRef<CanvasDraw>(draw);
  const animationFrameRef = useRef<number | null>(null);
  const measureRetryRef = useRef(0);

  const cancelScheduledDraw = useCallback(() => {
    if (animationFrameRef.current === null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const drawCanvas = useCallback(() => {
    animationFrameRef.current = null;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const box = measureCanvas(wrapper);
    if (!box) {
      if (measureRetryRef.current < MAX_MEASURE_RETRIES) {
        measureRetryRef.current += 1;
        animationFrameRef.current = window.requestAnimationFrame(drawCanvas);
      }
      return;
    }
    measureRetryRef.current = 0;
    resizeCanvas(canvas, box);
    drawRef.current(canvas, box);
  }, []);

  const scheduleDraw = useCallback(() => {
    cancelScheduledDraw();
    animationFrameRef.current = window.requestAnimationFrame(drawCanvas);
  }, [cancelScheduledDraw, drawCanvas]);

  useEffect(() => {
    drawRef.current = draw;
    measureRetryRef.current = 0;
    scheduleDraw();
  }, [draw, scheduleDraw]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      return cancelScheduledDraw;
    }

    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      cancelScheduledDraw();
    };
  }, [cancelScheduledDraw, scheduleDraw]);

  return { canvasRef, wrapperRef };
}
