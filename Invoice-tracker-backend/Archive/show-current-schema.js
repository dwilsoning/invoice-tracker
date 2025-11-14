const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('=================================================');
    console.log('Current Database Schema');
    console.log('=================================================\n');

    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      // Get columns for this table
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      console.log(`\n${tableName.toUpperCase()} (${columnsResult.rows.length} columns):`);
      console.log('-'.repeat(50));

      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
      });

      // Get row count
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`\n  → ${countResult.rows[0].count} rows`);
      } catch (err) {
        console.log(`\n  → Could not count rows: ${err.message}`);
      }
    }

    console.log('\n=================================================');
    console.log('End of Schema Report');
    console.log('=================================================\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
})();
