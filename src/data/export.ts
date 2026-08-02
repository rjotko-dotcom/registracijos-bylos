import { getRepositories } from './repositories';
import type { ExportBundle } from '../domain/models';

export async function exportToFile(): Promise<void> {
  const bundle = await getRepositories().porter.exportAll();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `freja-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function importFromFile(file: File): Promise<void> {
  const text = await file.text();
  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(text);
  } catch {
    throw new Error('invalid-json');
  }
  await getRepositories().porter.importAll(bundle);
}
