import { readFileSync, writeFileSync } from 'node:fs';

const ROOT_PACKAGE_PATH = new URL('../../package.json', import.meta.url);
const DIST_PACKAGE_PATH = new URL('../../dist/package.json', import.meta.url);

const rootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_PATH, 'utf8'));

const requireField = (object, fieldName) => {
  const value = object[fieldName];

  if (value === undefined) {
    throw new Error(`package.json 缺少必须字段: ${fieldName}`);
  }

  return value;
};

const stripDistPrefix = (value) => {
  if (typeof value === 'string') {
    if (value.startsWith('./dist/')) {
      return `./${value.slice('./dist/'.length)}`;
    }

    if (value.startsWith('dist/')) {
      return `./${value.slice('dist/'.length)}`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stripDistPrefix);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        stripDistPrefix(nestedValue)
      ])
    );
  }

  return value;
};

const distPackage = {
  name: requireField(rootPackage, 'name'),
  version: requireField(rootPackage, 'version'),
  type: requireField(rootPackage, 'type'),
  description: requireField(rootPackage, 'description'),
  exports: stripDistPrefix(requireField(rootPackage, 'exports')),
  module: stripDistPrefix(requireField(rootPackage, 'module')),
  types: stripDistPrefix(requireField(rootPackage, 'types')),
  author: requireField(rootPackage, 'author'),
  license: requireField(rootPackage, 'license'),
  repository: requireField(rootPackage, 'repository'),
  homepage: requireField(rootPackage, 'homepage'),
  bugs: requireField(rootPackage, 'bugs'),
  keywords: requireField(rootPackage, 'keywords'),
  dependencies: requireField(rootPackage, 'dependencies'),
  publishConfig: requireField(rootPackage, 'publishConfig'),
  packageManager: requireField(rootPackage, 'packageManager'),
  private: false
};

writeFileSync(DIST_PACKAGE_PATH, `${JSON.stringify(distPackage, null, 2)}\n`);
