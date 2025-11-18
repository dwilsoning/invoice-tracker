const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
});

async function checkTableCounts() {
  try {
    console.log('\n📊 PostgreSQL Invoice Tracker Database - Table Row Counts\n');
    console.log('Database:', process.env.DB_NAME || 'invoice_tracker');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('\n' + '='.repeat(70) + '\n');

    // Get all tables from the schema
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name ASC
    `);

    const tables = result.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables in the database:\n`);

    const tableCounts = [];

    // Get row count for each table
    for (const table of tables) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
      const count = parseInt(countResult.rows[0].count);
      tableCounts.push({ table, count });
    }

    // Sort by count descending
    tableCounts.sort((a, b) => b.count - a.count);

    // Display all tables
    console.log('ALL TABLES:');
    console.log('-'.repeat(70));
    tableCounts.forEach(({ table, count }) => {
      const isSmall = count < 1000 ? '✓' : ' ';
      console.log(`${isSmall} ${table.padEnd(35)} : ${count.toString().padStart(10)} rows`);
    });

    // Highlight tables with < 1000 rows
    console.log('\n' + '='.repeat(70) + '\n');
    const smallTables = tableCounts.filter(t => t.count < 1000);
    console.log(`📌 TABLES WITH < 1000 ROWS (${smallTables.length} tables):\n`);
    
    if (smallTables.length === 0) {
      console.log('No tables found with < 1000 rows');
    } else {
      smallTables.forEach(({ table, count }) => {
        console.log(`   • ${table.padEnd(40)} : ${count} rows`);
      });
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Show invoices table specifically
    const invoicesTable = tableCounts.find(t => t.table === 'invoices');
    if (invoicesTable) {
      console.log(`📌 INVOICES TABLE DETAIL:\n`);
      console.log(`   Table: invoices`);
      console.log(`   Total Invoice Records: ${invoicesTable.count}\n`);
      
      // Get invoice status breakdown if table has data
      if (invoicesTable.count > 0) {
        const statusResult = await pool.query(`
          SELECT status, COUNT(*) as count 
          FROM invoices 
          GROUP BY status 
          ORDER BY count DESC
        `);
        
        console.log('   Invoice Status Breakdown:');
        statusResult.rows.forEach(row => {
          console.log(`      • ${row.status.padEnd(20)} : ${row.count}`);
        });
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('Error querying database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkTableCounts();
