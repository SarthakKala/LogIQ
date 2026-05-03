const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/** Persisted on disk — Jest clears `globalThis` and custom `process` props between files. */
const COMPLETED_COUNT_FILE = path.join(__dirname, '.jest-completed-file-count');

/** All *.test.js under tests/ (recursive). */
function collectTestFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectTestFiles(p));
    else if (ent.isFile() && ent.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

/**
 * How many test files this Jest invocation will run (same worker with --runInBand).
 * Supports `jest path/to/foo.test.js` and full-suite runs.
 */
function expectedTestFileCount() {
  const argv = process.argv;
  const direct = argv.filter(
    (a) => typeof a === 'string' && a.endsWith('.test.js')
  );
  if (direct.length > 0) return direct.length;

  const all = collectTestFiles(__dirname);
  const eq = argv.find((a) => a.startsWith('--testPathPattern='));
  if (eq) {
    const raw = eq.split('=')[1] || '';
    const pat = raw.replace(/^["']|["']$/g, '').toLowerCase();
    if (!pat) return all.length;
    return all.filter((f) => f.toLowerCase().includes(pat)).length || all.length;
  }
  const idx = argv.indexOf('--testPathPattern');
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('-')) {
    const pat = argv[idx + 1].toLowerCase();
    return all.filter((f) => f.toLowerCase().includes(pat)).length || all.length;
  }
  return all.length;
}

function readCompletedCount() {
  try {
    return parseInt(fs.readFileSync(COMPLETED_COUNT_FILE, 'utf8').trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function closeSharedConnections() {
  try {
    const pool = require('../collector/db/postgres');
    if (typeof pool.end === 'function') await pool.end();
  } catch {
    /* ignore */
  }
  try {
    const redisPath = require.resolve('../collector/db/redis');
    if (require.cache[redisPath]) {
      const redis = require('../collector/db/redis');
      if (redis && typeof redis.removeAllListeners === 'function') {
        redis.removeAllListeners();
      }
      if (redis && typeof redis.quit === 'function') {
        await redis.quit();
      }
      if (redis && typeof redis.disconnect === 'function') {
        redis.disconnect(false);
      }
    }
  } catch {
    /* ignore */
  }
}

afterAll(async () => {
  const prev = readCompletedCount();
  const done = prev + 1;
  fs.writeFileSync(COMPLETED_COUNT_FILE, String(done));
  const total = expectedTestFileCount();
  if (done < total) return;
  await closeSharedConnections();
  try {
    fs.unlinkSync(COMPLETED_COUNT_FILE);
  } catch {
    /* ignore */
  }
});
