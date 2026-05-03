const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { migrate } = require('../collector/db/migrate');

const COMPLETED_COUNT_FILE = path.join(__dirname, '.jest-completed-file-count');

module.exports = async function globalSetup() {
  try {
    fs.unlinkSync(COMPLETED_COUNT_FILE);
  } catch {
    /* ignore */
  }
  await migrate();
};
