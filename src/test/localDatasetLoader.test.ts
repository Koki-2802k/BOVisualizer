import { describe, expect, it } from 'vitest';
import { loadLocalCsvFiles } from '../data/localDatasetLoader';
import type { CsvFileSource } from '../data/localDatasetLoader';

const csvFile = (name: string, contents: string, webkitRelativePath = ''): CsvFileSource => ({
  name,
  webkitRelativePath,
  text: async () => contents,
});

describe('loadLocalCsvFiles', () => {
  it('loads only CSV files and keeps relative paths in stable IDs', async () => {
    const result = await loadLocalCsvFiles([
      csvFile('sample_1.csv', 'number,speed\n0,2.5', 'session/sample_1.csv'),
      csvFile('notes.txt', 'not a dataset'),
    ]);

    expect(result).toMatchObject({
      failedFileNames: [],
      hasSampleCsv: true,
      datasets: [
        {
          id: 'local-session/sample_1.csv',
          label: '📂 sample_1.csv',
        },
      ],
    });
    expect(result.datasets[0]?.data.frames[0]?.speed).toBe(2.5);
  });

  it('isolates malformed files while retaining valid datasets', async () => {
    const result = await loadLocalCsvFiles([
      csvFile('broken.csv', ''),
      csvFile('rowing.csv', 'Measurement Mode: Standard\nnumber,SPM\n0,30'),
    ]);

    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0]?.data.meta.measurementMode).toBe('Standard');
    expect(result.failedFileNames).toEqual(['broken.csv']);
    expect(result.hasSampleCsv).toBe(false);
  });
});
