import type { DatasetCsv, RowingFrame, RowingValue } from '../types/rowing';
import { extractZXYEulerYDeg, makeSensorQuaternion } from '../utils/coordTransform';

const MEASUREMENT_PREFIX = 'Measurement Mode:';

const toNumberIfPossible = (value: string): RowingValue => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const numeric = Number(trimmed);
  return !Number.isNaN(numeric) && Number.isFinite(numeric) ? numeric : trimmed;
};

const parseMeasurementMode = (line: string): string => {
  const [prefix, ...rest] = line.split(',');
  if (!prefix.startsWith(MEASUREMENT_PREFIX)) {
    throw new Error('CSV 1行目の Measurement Mode が不正です');
  }

  const modeFromPrefix = prefix.replace(MEASUREMENT_PREFIX, '').trim();
  return modeFromPrefix || rest.join(',').trim() || 'unknown';
};

const isFiniteNumberValue = (value: RowingValue | undefined): boolean =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value)));

const populateOarAngles = (frame: RowingFrame): void => {
  const hasLeftQuaternion = ['wol', 'xol', 'yol', 'zol'].every((key) =>
    isFiniteNumberValue(frame[key]),
  );
  const hasRightQuaternion = ['wor', 'xor', 'yor', 'zor'].every((key) =>
    isFiniteNumberValue(frame[key]),
  );

  if (hasLeftQuaternion) {
    frame.angle_left = extractZXYEulerYDeg(
      makeSensorQuaternion(
        Number(frame.wol),
        Number(frame.xol),
        Number(frame.yol),
        Number(frame.zol),
      ),
    );
  } else if (frame.angle_left !== undefined && frame.angle_left !== null) {
    const angle = Number(frame.angle_left);
    if (Number.isFinite(angle)) frame.angle_left = angle;
  }

  if (hasRightQuaternion) {
    frame.angle_right = extractZXYEulerYDeg(
      makeSensorQuaternion(
        Number(frame.wor),
        Number(frame.xor),
        Number(frame.yor),
        Number(frame.zor),
      ),
    );
  } else if (frame.angle_right !== undefined && frame.angle_right !== null) {
    const angle = Number(frame.angle_right);
    if (Number.isFinite(angle)) frame.angle_right = angle;
  }
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
  const measurementMode = hasMeasurementMode ? parseMeasurementMode(firstLine) : 'unknown';
  const dataLinesStartAtIndex = hasMeasurementMode ? 1 : 0;
  const [headerRow, ...dataRows] = lines
    .slice(dataLinesStartAtIndex)
    .map((line) => line.split(','));

  if (!headerRow || headerRow.length === 0 || (headerRow.length === 1 && headerRow[0].trim() === '')) {
    throw new Error('CSVヘッダー行が不正です');
  }

  const headers = headerRow.map((column) => column.trim());
  const frames = dataRows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row): RowingFrame => {
      const frame = Object.fromEntries(
        headers.map((header, index) => [header, toNumberIfPossible(row[index] ?? '')]),
      ) as RowingFrame;
      populateOarAngles(frame);
      return frame;
    });

  return {
    headers,
    frames,
    meta: { measurementMode, totalFrames: frames.length },
  };
};
