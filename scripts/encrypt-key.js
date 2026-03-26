const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) return;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });

  return env;
}

const fileEnv = parseEnvFile(envPath);

const API_KEY = String(
  process.env.SGDB_API_KEY ||
  process.env.SGDB_KEY ||
  fileEnv.SGDB_API_KEY ||
  fileEnv.SGDB_KEY ||
  ''
).trim();

const ENCRYPTION_KEY = String(
  process.env.VAPOR_ENCRYPTION_KEY ||
  fileEnv.VAPOR_ENCRYPTION_KEY ||
  'vapor-default-key-change-me'
).trim();

function encryptJsonPayload(payload, encryptionKey) {
  const keyHash = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    data: encrypted,
  };
}

function encryptTextPayload(text, encryptionKey) {
  const keyHash = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
  let encrypted = cipher.update(String(text || ''), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    data: encrypted,
  };
}

const ENV_EXCLUDED_KEYS = new Set(['SGDB_API_KEY', 'SGDB_KEY', 'VAPOR_ENCRYPTION_KEY']);
const encryptedEnvPayload = Object.fromEntries(
  Object.entries(fileEnv).filter(([key]) => !ENV_EXCLUDED_KEYS.has(key))
);
const encryptedEnvPath = path.join(buildDir, 'env.enc.json');
fs.writeFileSync(encryptedEnvPath, JSON.stringify(encryptJsonPayload(encryptedEnvPayload, ENCRYPTION_KEY)));
console.log(`Encrypted env payload written to ${encryptedEnvPath}`);

const runtimeKeyPath = path.join(buildDir, 'runtime-key.json');
fs.writeFileSync(runtimeKeyPath, JSON.stringify({ encryptionKey: ENCRYPTION_KEY }));
console.log(`Runtime encryption key written to ${runtimeKeyPath}`);

if (!API_KEY || API_KEY === 'none' || API_KEY === '""' || API_KEY === "''" || API_KEY === '') {
  const keyFile = path.join(buildDir, 'sgdb.enc.json');
  if (fs.existsSync(keyFile)) {
    fs.unlinkSync(keyFile);
  }
  console.log('No valid SGDB_API_KEY in .env, encrypted key removed if existed');
  process.exit(0);
}

const result = encryptTextPayload(API_KEY, ENCRYPTION_KEY);

const outputPath = path.join(buildDir, 'sgdb.enc.json');
fs.writeFileSync(outputPath, JSON.stringify(result));

console.log(`Encrypted API key written to ${outputPath}`);
console.log(`Key length: ${API_KEY.length} characters`);
