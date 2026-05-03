const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { buildApp } = require('./createApp');

const PORT = Number(process.env.COLLECTOR_PORT) || 4000;

async function main() {
  const app = await buildApp({ startWebSocket: true });
  app.listen(PORT, () => {
    console.log(`LogIQ collector listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Collector failed to start', err);
  process.exit(1);
});
