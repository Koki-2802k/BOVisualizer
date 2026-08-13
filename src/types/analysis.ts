import type { RowingFrame } from './rowing';
import type { StrokeSegment } from './strokeDetect';

export interface DatasetStrokeData {
  id: string;
  label: string;
  frames: RowingFrame[];
  strokes: StrokeSegment[];
}
