const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  // Required for Supabase (hosted Postgres over TLS)
  ...(connectionString?.includes('supabase.co') && {
    ssl: { rejectUnauthorized: false },
  }),
});

module.exports = pool;
