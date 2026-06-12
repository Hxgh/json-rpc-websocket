import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ROOT_PACKAGE_PATH = new URL('../../package.json', import.meta.url);
const MIN_TRUSTED_PUBLISH_NPM = [11, 5, 1];
const EXPECTED_WORKFLOW_FILE = 'release.yml';
const EXPECTED_ENVIRONMENT = 'npm-release';

const rootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_PATH, 'utf8'));

const getRepositoryUrl = () => {
  if (typeof rootPackage.repository === 'string') {
    return rootPackage.repository;
  }

  if (
    rootPackage.repository &&
    typeof rootPackage.repository === 'object' &&
    typeof rootPackage.repository.url === 'string'
  ) {
    return rootPackage.repository.url;
  }

  throw new Error(
    'package.json.repository.url 缺失，无法校验 Trusted Publisher 配置。'
  );
};

const setOutput = (name, value) => {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

const run = (command, args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit'
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} 退出码 ${code ?? -1}`));
    });
  });
};

const parseVersion = (value) => {
  const [major = '0', minor = '0', patch = '0'] = value
    .trim()
    .split('.')
    .map((segment) => segment.replace(/\D.*$/, ''));

  return [major, minor, patch].map((segment) => Number(segment || '0'));
};

const isVersionAtLeast = (version, minimumVersion) => {
  for (let index = 0; index < minimumVersion.length; index += 1) {
    const current = version[index] ?? 0;
    const minimum = minimumVersion[index] ?? 0;

    if (current > minimum) {
      return true;
    }

    if (current < minimum) {
      return false;
    }
  }

  return true;
};

const getCommandOutput = (command, args) =>
  execFileSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

const normalizeGitHubRepository = (value) => {
  const normalized = value
    .trim()
    .replace(/^git\+/, '')
    .replace(/^ssh:\/\/git@github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  if (!normalized.includes('/')) {
    return null;
  }

  return normalized;
};

const getTrustedPublisherRepository = () =>
  process.env.GITHUB_REPOSITORY ||
  normalizeGitHubRepository(getRepositoryUrl()) ||
  '<owner/repo>';

const assertTrustedPublishingEnvironment = () => {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return;
  }

  if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    throw new Error(
      '当前 GitHub Actions job 未提供 OIDC token 接口，请确认 workflow permissions 包含 id-token: write。'
    );
  }

  const repositoryFromPackage = normalizeGitHubRepository(getRepositoryUrl());

  if (!repositoryFromPackage) {
    throw new Error(
      `无法从 package.json.repository.url 解析 GitHub 仓库，请检查当前值是否为标准 GitHub URL：${getRepositoryUrl()}`
    );
  }

  if (repositoryFromPackage !== process.env.GITHUB_REPOSITORY) {
    throw new Error(
      [
        'package.json.repository.url 与当前 GitHub 仓库不匹配。',
        `package.json: ${repositoryFromPackage}`,
        `GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`,
        'npm Trusted Publisher 会校验该字段；请先修正仓库元数据，再重跑当前未发布版本。'
      ].join(' ')
    );
  }
};

const printTrustedPublisherTroubleshooting = () => {
  const trustedRepository = getTrustedPublisherRepository();
  const repositoryUrl = getRepositoryUrl();

  console.error('');
  console.error('npm publish 失败，优先按 Trusted Publisher 配置不匹配处理：');
  console.error(`- package: ${rootPackage.name}`);
  console.error(`- repo: ${trustedRepository}`);
  console.error(`- workflow file: ${EXPECTED_WORKFLOW_FILE}`);
  console.error(`- environment: ${EXPECTED_ENVIRONMENT}`);
  console.error(`- package.json.repository.url: ${repositoryUrl}`);
  console.error('');
  console.error('若要在本地用 npm CLI 补配置，请先 npm login，然后执行：');
  console.error(
    `npm trust github ${rootPackage.name} --repo ${trustedRepository} --file ${EXPECTED_WORKFLOW_FILE} --env ${EXPECTED_ENVIRONMENT} --yes`
  );
  console.error('');
  console.error(
    '修正 Trusted Publisher 后，不要改版本号；直接重跑当前未发布版本即可。'
  );
};

const ensureTrustedPublishingToolchain = () => {
  const npmVersion = getCommandOutput('npm', ['--version']);
  const nodeVersion = getCommandOutput('node', ['--version']);

  console.log(`发布环境: node ${nodeVersion}, npm ${npmVersion}`);

  if (!isVersionAtLeast(parseVersion(npmVersion), MIN_TRUSTED_PUBLISH_NPM)) {
    throw new Error(
      [
        `当前 npm 版本为 ${npmVersion}，低于 Trusted Publishing 所需的最低版本 ${MIN_TRUSTED_PUBLISH_NPM.join('.')}`,
        '请在发布 workflow 中先升级 npm，再执行 npm publish。'
      ].join('。')
    );
  }
};

const isVersionPublished = () => {
  try {
    const output = getCommandOutput('npm', [
      'view',
      `${rootPackage.name}@${rootPackage.version}`,
      'version',
      '--json'
    ]);

    return JSON.parse(output) === rootPackage.version;
  } catch (error) {
    const stderr = error.stderr?.toString() ?? '';

    if (stderr.includes('E404')) {
      return false;
    }

    throw error;
  }
};

setOutput('version', rootPackage.version);
ensureTrustedPublishingToolchain();
assertTrustedPublishingEnvironment();

if (isVersionPublished()) {
  console.log(
    `${rootPackage.name}@${rootPackage.version} 已存在于 npm，跳过重复发布。`
  );
  setOutput('already_published', 'true');
  process.exit(0);
}

setOutput('already_published', 'false');

try {
  await run('pnpm', ['validate:release']);
  await run('npm', ['publish', './dist', '--access', 'public']);
} catch (error) {
  if (error instanceof Error && error.message.startsWith('npm publish ')) {
    printTrustedPublisherTroubleshooting();
  }

  throw error;
}
