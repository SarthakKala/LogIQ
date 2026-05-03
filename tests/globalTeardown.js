module.exports = async function globalTeardown() {
  try {
    const pool = require('../collector/db/postgres');
    await pool.end();
  } catch {
    /* ignore */
  }
  try {
    const redis = require('../collector/db/redis');
    if (typeof redis.quit === 'function') {
      await redis.quit();
    } else {
      redis.disconnect();
    }
  } catch {
    /* ignore */
  }
};
