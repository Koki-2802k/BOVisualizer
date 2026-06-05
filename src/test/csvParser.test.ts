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

  it('parses correctly when measurement mode line is absent', () => {
    const mockCsv = `number,time,wol
1,2024-12-20 16:50:11.360461,-0.552899
2,2024-12-20 16:50:11.377128,-0.548653`;
    const result = parseRowingCsv(mockCsv);

    expect(result.meta.measurementMode).toBe('unknown');
    expect(result.headers).toEqual(['number', 'time', 'wol']);
    expect(result.frames.length).toBe(2);
    expect(result.frames[0]).toEqual({
      number: 1,
      time: '2024-12-20 16:50:11.360461',
      wol: -0.552899,
    });
  });

  it('parses correctly when measurement mode line has a comma and custom text', () => {
    const mockCsv = `Measurement Mode:,Custom modes - custom mode5
number,time,wol
1,2024-12-20 16:50:11.360461,-0.552899
2,2024-12-20 16:50:11.377128,-0.548653`;
    const result = parseRowingCsv(mockCsv);

    expect(result.meta.measurementMode).toBe('Custom modes - custom mode5');
    expect(result.headers).toEqual(['number', 'time', 'wol']);
    expect(result.frames.length).toBe(2);
  });

  it('derives metrics and excludes invalid GPS points', () => {
    const result = parseRowingCsv(csvText);
    const metrics = deriveMetrics(result);

    expect(metrics.spm.length).toBe(result.frames.length);
    expect(metrics.split.length).toBe(result.frames.length);
    expect(metrics.timeAxis.length).toBe(result.frames.length);
    expect(metrics.gpsValidPoints.length).toBe(result.frames.length);
    expect(metrics.graphSeries.speed.length).toBe(result.frames.length);
  });
});
