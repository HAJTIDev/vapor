import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = 'HAJTIDev/vapor';
const distDir = path.resolve('release');
const args = new Set(process.argv.slice(2));
const isLinuxPublish = args.has('--linux');
const shouldBumpVersion = args.has('--no-bump') ? false : !isLinuxPublish;

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCommandWithResult(command, args, options = {}) {
  return spawnSync(command, args, {
    shell: process.platform === 'win32',
    ...options,
  });
}

function getGhEnv() {
  const env = {...process.env};
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

function getGhToken() {
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: getGhEnv(),
      shell: process.platform === 'win32',
    }).trim();

    if (!token) {
      throw new Error('Empty token from gh auth token');
    }

    return token;
  } catch {
    console.error('GitHub CLI auth token is not available. Run `gh auth login` first.');
    process.exit(1);
  }
}

function bumpVersion() {
  try {
    const bumpedVersion = execFileSync('npm', ['version', 'patch', '--no-git-tag-version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: process.platform === 'win32',
    }).trim();

    return bumpedVersion.startsWith('v') ? bumpedVersion.slice(1) : bumpedVersion;
  } catch {
    console.error('Failed to bump package version.');
    process.exit(1);
  }
}

function getPackageVersion() {
  try {
    const packageJsonPath = path.resolve('package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = String(packageJson.version || '').trim();
    if (!version) throw new Error('Missing package version');
    return version;
  } catch {
    console.error('Failed to read version from package.json.');
    process.exit(1);
  }
}

const version = shouldBumpVersion ? bumpVersion() : getPackageVersion();
const tag = `v${version}`;
const ghToken = getGhToken();

function getAuthenticatedGhEnv() {
  return {
    ...getGhEnv(),
    GH_TOKEN: ghToken,
    GITHUB_TOKEN: ghToken,
  };
}

function fileMustExist(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Expected build artifact is missing: ${filePath}`);
    process.exit(1);
  }
}

function listLinuxArtifacts() {
  return [path.join(distDir, `vapor-${version}.tar.gz`)];
}

function getReleaseAssetNames() {
  const result = runCommandWithResult('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets'], {
    env: getAuthenticatedGhEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed.assets) ? parsed.assets.map(asset => asset.name) : [];
  } catch {
    return [];
  }
}

function releaseExists() {
  return runCommandWithResult('gh', ['release', 'view', tag, '--repo', repo], {
    stdio: 'ignore',
    env: getAuthenticatedGhEnv(),
  }).status === 0;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForRelease(maxAttempts = 10, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (releaseExists()) {
      return;
    }

    sleep(delayMs);
  }

  console.error(`Release ${tag} was not found after creation attempts.`);
  process.exit(1);
}

function uploadAssetWithRetry(filePath, maxAttempts = 3) {
  const assetName = path.basename(filePath);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    runCommand('gh', ['release', 'upload', tag, filePath, '--repo', repo, '--clobber'], {env: getAuthenticatedGhEnv()});

    const assets = getReleaseAssetNames();
    if (assets.includes(assetName)) {
      return;
    }

    console.error(`Upload verification failed for ${assetName} (attempt ${attempt}/${maxAttempts}).`);
  }

  console.error(`Failed to verify upload for ${assetName}.`);
  process.exit(1);
}

runCommand('gh', ['auth', 'status'], {env: getAuthenticatedGhEnv()});
if (isLinuxPublish) {
  runCommand('npm', ['run', 'build', '--', '--linux', 'tar.gz']);
} else {
  runCommand('npm', ['run', 'build']);
}

const artifacts = isLinuxPublish
  ? listLinuxArtifacts()
  : [
      path.join(distDir, `Vapor-${version}-setup.exe`),
      path.join(distDir, `Vapor-${version}-setup.exe.blockmap`),
      path.join(distDir, 'latest.yml'),
    ];

if (artifacts.length === 0) {
  console.error(`No ${isLinuxPublish ? 'Linux' : 'Windows'} build artifacts were found in ${distDir}.`);
  process.exit(1);
}

artifacts.forEach(fileMustExist);

if (!releaseExists()) {
  runCommand('gh', ['release', 'create', tag, '--repo', repo, '--title', tag, '--latest', '--generate-notes'], {env: getAuthenticatedGhEnv()});
}

waitForRelease();

runCommand('gh', ['release', 'edit', tag, '--repo', repo, '--latest'], {env: getAuthenticatedGhEnv()});

runCommand(
  'gh',
  ['release', 'view', tag, '--repo', repo],
  {env: getAuthenticatedGhEnv()},
);
if (shouldBumpVersion) {
  runCommand('git', ['add', '.']);
  runCommand('git', ['commit', '-m', `chore: publish ${tag}`]);
  runCommand('git', ['push']);
}

artifacts.forEach((artifact) => uploadAssetWithRetry(artifact));
