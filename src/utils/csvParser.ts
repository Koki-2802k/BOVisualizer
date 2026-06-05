import type { DatasetCsv, RowingFrame, RowingValue } from '../types/rowing';
import { extractZXYEulerYDeg, makeSensorQuaternion } from './coordTransform';

const MEASUREMENT_PREFIX = 'Measurement Mode:';

const toNumberIfPossible = (value: string): RowingValue => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  return trimmed;
};

const parseMeasurementMode = (line: string): string => {
  const [prefix, ...rest] = line.split(',');
  if (!prefix.startsWith(MEASUREMENT_PREFIX)) {
    throw new Error('CSV 1行目の Measurement Mode が不正です');
  }

  const modeFromPrefix = prefix.replace(MEASUREMENT_PREFIX, '').trim();
  const modeFromRest = rest.join(',').trim();

  return modeFromPrefix || modeFromRest || 'unknown';
};

export const parseRowingCsv = (csvText: string): DatasetCsv => {
  const normalized = csvText.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');

  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    throw new Error('CSVの行数が不足しています');
  }

  const firstLine = lines[0] || '';
  const firstCell = firstLine.split(',')[0] || '';
  const hasMeasurementMode = firstCell.trim().startsWith(MEASUREMENT_PREFIX);

  let measurementMode = 'unknown';
  let dataLinesStartAtIndex = 0;

  if (hasMeasurementMode) {
    measurementMode = parseMeasurementMode(firstLine);
    dataLinesStartAtIndex = 1;
  }

  const csvRows = lines.slice(dataLinesStartAtIndex).map((line) => line.split(','));
  const [headerRow, ...dataRows] = csvRows;
  if (!headerRow || headerRow.length === 0 || (headerRow.length === 1 && headerRow[0].trim() === '')) {
    throw new Error('CSVヘッダー行が不正です');
  }

  const headers = headerRow.map((column: string) => column.trim());
  const frames: RowingFrame[] = dataRows
    .filter((row: string[]) => row.some((cell: string) => cell.trim().length > 0))
    .map((row: string[]) => {
      const frame: RowingFrame = {};
      headers.forEach((header: string, index: number) => {
        const raw = row[index] ?? '';
        frame[header] = toNumberIfPossible(raw);
      });

      const isFiniteNum = (val: unknown): boolean =>
        (typeof val === 'number' && Number.isFinite(val)) ||
        (typeof val === 'string' && val.trim().length > 0 && !Number.isNaN(Number(val)) && Number.isFinite(Number(val)));

      const hasLeftQ =
        frame.wol != null && frame.xol != null && frame.yol != null && frame.zol != null &&
        isFiniteNum(frame.wol) && isFiniteNum(frame.xol) && isFiniteNum(frame.yol) && isFiniteNum(frame.zol);

      const hasRightQ =
        frame.wor != null && frame.xor != null && frame.yor != null && frame.zor != null &&
        isFiniteNum(frame.wor) && isFiniteNum(frame.xor) && isFiniteNum(frame.yor) && isFiniteNum(frame.zor);

      if (hasLeftQ) {
        frame.angle_left = extractZXYEulerYDeg(
          makeSensorQuaternion(
            Number(frame.wol),
            Number(frame.xol),
            Number(frame.yol),
            Number(frame.zol)
          )
        );
      } else if (frame.angle_left !== undefined && frame.angle_left !== null) {
        const num = Number(frame.angle_left);
        if (Number.isFinite(num)) {
          frame.angle_left = num;
        }
      }

      if (hasRightQ) {
        frame.angle_right = extractZXYEulerYDeg(
          makeSensorQuaternion(
            Number(frame.wor),
            Number(frame.xor),
            Number(frame.yor),
            Number(frame.zor)
          )
        );
      } else if (frame.angle_right !== undefined && frame.angle_right !== null) {
        const num = Number(frame.angle_right);
        if (Number.isFinite(num)) {
          frame.angle_right = num;
        }
      }

      return frame;
    });

  return {
    headers,
    frames,
    meta: {
      measurementMode,
      totalFrames: frames.length,
    },
  };
};
