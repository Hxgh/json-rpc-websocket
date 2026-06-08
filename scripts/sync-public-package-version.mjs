import { readFile, writeFile } from 'node:fs/promises';

const rootPackagePath = new URL('../package.json', import.meta.url);
const publicPackagePath = new URL('../public/package.json', import.meta.url);

const rootPackage = JSON.parse(await readFile(rootPackagePath, 'utf8'));
const publicPackage = JSON.parse(await readFile(publicPackagePath, 'utf8'));

publicPackage.version = rootPackage.version;

await writeFile(
  publicPackagePath,
  `${JSON.stringify(publicPackage, null, 2)}\n`,
);
