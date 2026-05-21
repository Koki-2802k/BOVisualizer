import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { parseRowingCsv } from '../utils/csvParser';
import { deriveMetrics } from '../utils/metrics';

describe('parseRowingCsv', () => {
  const fixturePath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../public/data/samples/sample_1.csv');
  const csvText = readFileSync(fixturePath, 'utf-8');

  it('parses measurement mode line and header/data rows', () => {
    const result = parseRowingCsv(csvText);

    expect(result.meta.measurementMode).toBe('Custom Modes - Custom Mode 4');
    expect(result.headers[0]).toBe('number');
    expect(result.headers[1]).toBe('time');
    expect(result.frames.length).toBeGreaterThan(0);
    expect(typeof result.frames[0]?.number).toBe('number');
    expect(typeof result.frames[0]?.time).toBe('string');
  });

  it('derives metrics and excludes invalid GPS points', () => {
    const result = parseRowingCsv(csvText);
    const metrics = deriveMetrics(result);

    expect(metrics.spm.length).toBe(result.frames.length);
    expect(metrics.split.length).toBe(result.frames.length);
    expect(metrics.timeAxis.length).toBe(result.frames.length);
    expect(metrics.gpsValidPoints.length).toBe(0);
    expect(metrics.graphSeries.speed.length).toBe(result.frames.length);
  });
});
