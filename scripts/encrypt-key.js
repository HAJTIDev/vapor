const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

let API_KEY = process.env.SGDB_API_KEY;
let ENCRYPTION_KEY = process.env.VAPOR_ENCRYPTION_KEY || 'vapor-default-key-change-me';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value && !key.startsWith('#')) {
      if (key === 'SGDB_API_KEY' && !API_KEY) API_KEY = value;
      if (key === 'VAPOR_ENCRYPTION_KEY' && !ENCRYPTION_KEY) ENCRYPTION_KEY = value;
    }
  });
}

if (!API_KEY || API_KEY === 'none' || API_KEY === '""' || API_KEY === "''" || API_KEY === '') {
  const keyFile = path.join(buildDir, 'sgdb.enc.json');
  if (fs.existsSync(keyFile)) {
    fs.unlinkSync(keyFile);
  }
  console.log('No valid SGDB_API_KEY in .env, encrypted key removed if existed');
  process.exit(0);
}

const key = Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32);
const iv = crypto.randomBytes(16);

const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
let encrypted = cipher.update(API_KEY, 'utf8', 'hex');
encrypted += cipher.final('hex');

const result = {
  iv: iv.toString('hex'),
  data: encrypted
};

const outputPath = path.join(buildDir, 'sgdb.enc.json');
fs.writeFileSync(outputPath, JSON.stringify(result));

console.log(`Encrypted API key written to ${outputPath}`);
console.log(`Key length: ${API_KEY.length} characters`);
