import { parseRowingCsv } from './csvParser';
import type { LocalDatasetItem } from '../types/rowing';
import type {
  DirectoryPickerWindow,
  ReadableDirectoryHandle,
} from '../types/fileSystemAccess';

export interface CsvFileSource {
  readonly name: string;
  readonly webkitRelativePath?: string;
  text(): Promise<string>;
}

export interface LocalDatasetLoadResult {
  datasets: LocalDatasetItem[];
  failedFileNames: string[];
  hasSampleCsv: boolean;
}

const isCsvFile = (fileName: string): boolean => fileName.toLowerCase().endsWith('.csv');

const datasetIdForFile = (file: CsvFileSource): string => {
  const sourcePath = file.webkitRelativePath || file.name;
  return `local-${sourcePath}`;
};

export async function loadLocalCsvFiles(
  files: readonly CsvFileSource[],
): Promise<LocalDatasetLoadResult> {
  const csvFiles = files.filter((file) => isCsvFile(file.name));
  const datasets: LocalDatasetItem[] = [];
  const failedFileNames: string[] = [];

  for (const file of csvFiles) {
    try {
      const data = parseRowingCsv(await file.text());
      datasets.push({
        id: datasetIdForFile(file),
        label: `📂 ${file.name}`,
        data,
      });
    } catch {
      failedFileNames.push(file.name);
    }
  }

  return {
    datasets,
    failedFileNames,
    hasSampleCsv: csvFiles.some((file) => file.name.toLowerCase().startsWith('sample_')),
  };
}

export async function loadDatasetsFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<LocalDatasetLoadResult> {
  const files: File[] = [];
  const failedFileNames: string[] = [];
  const readableHandle = directoryHandle as ReadableDirectoryHandle;

  for await (const entry of readableHandle.values()) {
    if (entry.kind !== 'file' || !isCsvFile(entry.name)) {
      continue;
    }

    try {
      files.push(await (entry as FileSystemFileHandle).getFile());
    } catch {
      failedFileNames.push(entry.name);
    }
  }

  const result = await loadLocalCsvFiles(files);
  return {
    ...result,
    failedFileNames: [...failedFileNames, ...result.failedFileNames],
  };
}

export async function requestDirectoryReadPermission(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const readableHandle = directoryHandle as ReadableDirectoryHandle;
  const options = { mode: 'read' } as const;
  const currentPermission = await readableHandle.queryPermission?.(options);

  if (currentPermission === undefined || currentPermission === 'granted') {
    return true;
  }

  return (await readableHandle.requestPermission?.(options)) === 'granted';
}

export async function pickDatasetDirectory(
  browserWindow: Window,
): Promise<FileSystemDirectoryHandle | null> {
  const picker = (browserWindow as DirectoryPickerWindow).showDirectoryPicker;
  return picker ? picker.call(browserWindow) : null;
}
