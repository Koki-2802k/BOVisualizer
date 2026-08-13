import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  loadDatasetsFromDirectory,
  loadLocalCsvFiles,
  pickDatasetDirectory,
  requestDirectoryReadPermission,
  type LocalDatasetLoadResult,
} from '../data/localDatasetLoader';
import type { LocalDatasetItem } from '../types/rowing';

interface UseLocalDatasetsOptions {
  directoryHandle: FileSystemDirectoryHandle | null;
  autoReloadEnabled: boolean;
  autoReloadIntervalSeconds: number;
  onDatasetsLoaded?: (datasets: LocalDatasetItem[]) => void;
  onDirectoryHandleChange?: (handle: FileSystemDirectoryHandle | null) => void;
  onReload?: () => void;
}

const showLoadResult = (
  result: LocalDatasetLoadResult,
  onDatasetsLoaded?: (datasets: LocalDatasetItem[]) => void,
): void => {
  if (result.datasets.length === 0) {
    window.alert('選択されたフォルダに読み込み可能なCSVファイルが見つかりませんでした。');
    onDatasetsLoaded?.([]);
    return;
  }

  if (!result.hasSampleCsv) {
    window.alert('【注意】選択されたフォルダ内に "sample_*.csv" のパターンに合致するファイルが見つかりませんでした。');
  }

  if (result.failedFileNames.length > 0) {
    window.alert(`次のCSVファイルは読み込めなかったためスキップしました:\n${result.failedFileNames.join('\n')}`);
  }

  onDatasetsLoaded?.(result.datasets);
};

export function useLocalDatasets({
  directoryHandle,
  autoReloadEnabled,
  autoReloadIntervalSeconds,
  onDatasetsLoaded,
  onDirectoryHandleChange,
  onReload,
}: UseLocalDatasetsOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  const triggerReloadAnimation = useCallback(() => {
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
    setIsReloading(true);
    animationTimerRef.current = window.setTimeout(() => setIsReloading(false), 600);
  }, []);

  useEffect(() => () => {
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
  }, []);

  const loadDirectory = useCallback(async (handle: FileSystemDirectoryHandle): Promise<void> => {
    const result = await loadDatasetsFromDirectory(handle);
    showLoadResult(result, onDatasetsLoaded);
  }, [onDatasetsLoaded]);

  const selectDirectory = useCallback(async (): Promise<void> => {
    try {
      const handle = await pickDatasetDirectory(window);
      if (!handle) {
        fileInputRef.current?.click();
        return;
      }
      onDirectoryHandleChange?.(handle);
      await loadDirectory(handle);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Directory picker failed, falling back to file input:', error);
      fileInputRef.current?.click();
    }
  }, [loadDirectory, onDirectoryHandleChange]);

  const reloadDirectory = useCallback(async (): Promise<void> => {
    if (!directoryHandle) {
      window.alert('フォルダがまだ選択されていません。再度フォルダを選択してください。');
      fileInputRef.current?.click();
      return;
    }

    try {
      if (!(await requestDirectoryReadPermission(directoryHandle))) {
        window.alert('フォルダの読み取り権限が拒否されたため、再読み込みできませんでした。');
        return;
      }
      await loadDirectory(directoryHandle);
      triggerReloadAnimation();
      onReload?.();
    } catch (error) {
      console.error('Reload directory failed:', error);
      window.alert(`再読み込みに失敗しました:\n${error instanceof Error ? error.message : String(error)}`);
    }
  }, [directoryHandle, loadDirectory, onReload, triggerReloadAnimation]);

  const loadFileInput = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;

    showLoadResult(await loadLocalCsvFiles(files), onDatasetsLoaded);
    input.value = '';
  }, [onDatasetsLoaded]);

  useEffect(() => {
    if (!autoReloadEnabled || !directoryHandle) return;

    const timerId = window.setInterval(() => {
      void (async () => {
        try {
          if (!(await requestDirectoryReadPermission(directoryHandle))) return;
          await loadDirectory(directoryHandle);
          triggerReloadAnimation();
          onReload?.();
        } catch (error) {
          console.warn('Background auto reload failed:', error);
        }
      })();
    }, autoReloadIntervalSeconds * 1000);

    return () => window.clearInterval(timerId);
  }, [
    autoReloadEnabled,
    autoReloadIntervalSeconds,
    directoryHandle,
    loadDirectory,
    onReload,
    triggerReloadAnimation,
  ]);

  return {
    fileInputRef,
    isReloading,
    loadFileInput,
    reloadDirectory,
    selectDirectory,
  };
}
