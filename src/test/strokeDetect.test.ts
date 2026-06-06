import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { parseRowingCsv } from '../utils/csvParser';
import { detectStrokes } from '../utils/strokeDetect';

describe('detectStrokes with sample_1.csv', () => {
  const fixturePath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../public/data/samples/sample_1.csv');
  const csvText = readFileSync(fixturePath, 'utf-8');

  it('detects strokes and partitions into contiguous 4 phases based on oar trajectory', () => {
    const result = parseRowingCsv(csvText);
    const strokes = detectStrokes(result.frames);
    expect(strokes.length).toBe(1);

    const stroke = strokes[0];
    const phases = stroke.phases;
    expect(phases.length).toBe(4);
    
    // recovery (前半)
    expect(phases[0].phase).toBe('recovery');
    expect(phases[0].startFrame).toBe(0);
    expect(phases[0].endFrame).toBe(31);
    
    // catch (左右進入ズレ: 32〜34)
    expect(phases[1].phase).toBe('catch');
    expect(phases[1].startFrame).toBe(32);
    expect(phases[1].endFrame).toBe(34);
    
    // drive
    expect(phases[2].phase).toBe('drive');
    expect(phases[2].startFrame).toBe(35);
    expect(phases[2].endFrame).toBe(115);
    
    // finish (116〜末尾126)
    expect(phases[3].phase).toBe('finish');
    expect(phases[3].startFrame).toBe(116);
    expect(phases[3].endFrame).toBe(126);
  });
});
