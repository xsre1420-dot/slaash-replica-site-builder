import fs from 'fs';

if (!fs.existsSync('.env')) {
  console.log('ENV_FILE: missing');
  process.exit(1);
}

const text = fs.readFileSync('.env', 'utf8');
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) {
    console.log(`${key}: MISSING`);
    continue;
  }
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  const placeholder = /your-|placeholder|example|missing-anon-key/i.test(value);
  console.log(`${key}: len=${value.length} placeholder=${placeholder}`);
}
