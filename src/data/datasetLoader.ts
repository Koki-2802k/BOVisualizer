import { parseRowingCsv } from '../utils/csvParser';
import type { DatasetCsv, DatasetManifest, DatasetManifestItem, RowingFrame } from '../types/rowing';

/**
 * 静的マニフェストファイル（manifest.json）をフェッチしてデータセットの一覧を返す。
 */
export async function fetchManifest(): Promise<DatasetManifestItem[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`);
  if (!response.ok) {
    throw new Error(`manifest fetch failed: ${response.status}`);
  }
  const json = (await response.json()) as DatasetManifest;
  if (!json || !Array.isArray(json.datasets) || json.datasets.length === 0) {
    throw new Error('マニフェストファイルに有効なデータセットが定義されていません。');
  }
  return json.datasets;
}

/**
 * 指定されたマニフェスト項目のCSVファイルをフェッチしてパースされた DatasetCsv オブジェクトを返す。
 */
export async function fetchDatasetCsv(item: DatasetManifestItem): Promise<DatasetCsv> {
  const path = item.path.startsWith('/') ? item.path.slice(1) : item.path;
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`dataset fetch failed: ${response.status}`);
  }
  const csv = await response.text();
  return parseRowingCsv(csv);
}

/**
 * 与えられたマニフェスト一覧の全CSVファイルを非同期でフェッチ・パースして返す（横断分析用）。
 */
export async function loadAllManifestDatasets(manifest: DatasetManifestItem[]): Promise<
  Array<{ id: string; label: string; frames: RowingFrame[] }>
> {
  const results: Array<{ id: string; label: string; frames: RowingFrame[] }> = [];
  for (const item of manifest) {
    try {
      const data = await fetchDatasetCsv(item);
      results.push({ id: item.id, label: item.label, frames: data.frames ?? [] });
    } catch (err) {
      console.warn(`Failed to preload manifest dataset "${item.label}":`, err);
    }
  }
  return results;
}
