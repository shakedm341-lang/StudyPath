import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const packageJsonPath = path.join(rootDir, 'package.json');
const metadataJsonPath = path.join(rootDir, 'metadata.json');

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const version = packageJson?.version;

if (typeof version !== 'string' || version.trim() === '') {
  console.error(`[sync-metadata-version] Invalid package.json version: ${String(version)}`);
  process.exit(1);
}

const metadataJson = JSON.parse(await readFile(metadataJsonPath, 'utf8'));

if (metadataJson.version === version) {
  process.exit(0);
}

metadataJson.version = version;
await writeFile(metadataJsonPath, JSON.stringify(metadataJson, null, 2) + '\n', 'utf8');

console.log(`[sync-metadata-version] Updated metadata.json version -> ${version}`);

