const { pool } = require('./db-postgres');
const fs = require('fs');

(async () => {
  try {
    console.log('Exporting complete database schema from LOCAL database...\n');

    let schemaSQL = `-- =====================================================
-- Invoice Tracker Complete Database Schema
-- Exported from local database
-- PostgreSQL with snake_case naming convention
-- =====================================================\n\n`;

    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`Found ${tablesResult.rows.length} tables:\n`);

    // For each table, generate CREATE TABLE statement
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      console.log(`Processing table: ${tableName}`);

      // Get columns
      const columnsResult = await pool.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      schemaSQL += `-- =====================================================\n`;
      schemaSQL += `-- ${tableName.toUpperCase()} Table\n`;
      schemaSQL += `-- =====================================================\n`;
      schemaSQL += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n\n`;
      schemaSQL += `CREATE TABLE ${tableName} (\n`;

      const columnDefs = [];
      for (const col of columnsResult.rows) {
        let colDef = `  ${col.column_name}`;

        // Data type
        if (col.character_maximum_length) {
          colDef += ` VARCHAR(${col.character_maximum_length})`;
        } else if (col.data_type === 'character varying') {
          colDef += ` VARCHAR(255)`;
        } else if (col.data_type === 'integer') {
          colDef += ` INTEGER`;
        } else if (col.data_type === 'numeric') {
          colDef += ` NUMERIC`;
        } else if (col.data_type === 'text') {
          colDef += ` TEXT`;
        } else if (col.data_type === 'boolean') {
          colDef += ` BOOLEAN`;
        } else if (col.data_type === 'date') {
          colDef += ` DATE`;
        } else if (col.data_type === 'timestamp without time zone') {
          colDef += ` TIMESTAMP`;
        } else if (col.data_type === 'timestamp with time zone') {
          colDef += ` TIMESTAMPTZ`;
        } else if (col.data_type === 'json') {
          colDef += ` JSON`;
        } else if (col.data_type === 'jsonb') {
          colDef += ` JSONB`;
        } else {
          colDef += ` ${col.data_type.toUpperCase()}`;
        }

        // Nullable
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }

        // Default
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }

        columnDefs.push(colDef);
      }

      schemaSQL += columnDefs.join(',\n');
      schemaSQL += '\n);\n\n';

      // Get indexes
      const indexesResult = await pool.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
        ORDER BY indexname
      `, [tableName]);

      if (indexesResult.rows.length > 0) {
        schemaSQL += `-- Indexes for ${tableName}\n`;
        for (const idx of indexesResult.rows) {
          schemaSQL += `${idx.indexdef};\n`;
        }
        schemaSQL += '\n';
      }

      // Get foreign keys
      const fkResult = await pool.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
      `, [tableName]);

      if (fkResult.rows.length > 0) {
        schemaSQL += `-- Foreign keys for ${tableName}\n`;
        for (const fk of fkResult.rows) {
          schemaSQL += `ALTER TABLE ${tableName} ADD CONSTRAINT ${fk.constraint_name} `;
          schemaSQL += `FOREIGN KEY (${fk.column_name}) `;
          schemaSQL += `REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name});\n`;
        }
        schemaSQL += '\n';
      }
    }

    // Get triggers
    const triggersResult = await pool.query(`
      SELECT
        trigger_name,
        event_object_table,
        action_statement,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name
    `);

    if (triggersResult.rows.length > 0) {
      schemaSQL += `-- =====================================================\n`;
      schemaSQL += `-- Triggers\n`;
      schemaSQL += `-- =====================================================\n\n`;

      for (const trigger of triggersResult.rows) {
        schemaSQL += `-- Trigger: ${trigger.trigger_name}\n`;
        schemaSQL += `CREATE TRIGGER ${trigger.trigger_name}\n`;
        schemaSQL += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
        schemaSQL += `  ON ${trigger.event_object_table}\n`;
        schemaSQL += `  FOR EACH ROW\n`;
        schemaSQL += `  ${trigger.action_statement};\n\n`;
      }
    }

    // Get functions
    const functionsResult = await pool.query(`
      SELECT
        routine_name,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);

    if (functionsResult.rows.length > 0) {
      schemaSQL += `-- =====================================================\n`;
      schemaSQL += `-- Functions\n`;
      schemaSQL += `-- =====================================================\n\n`;

      for (const func of functionsResult.rows) {
        schemaSQL += `-- Function: ${func.routine_name}\n`;
        if (func.routine_definition) {
          schemaSQL += `CREATE OR REPLACE FUNCTION ${func.routine_name}()\n`;
          schemaSQL += `RETURNS TRIGGER AS $$\n`;
          schemaSQL += `BEGIN\n`;
          schemaSQL += `  ${func.routine_definition}\n`;
          schemaSQL += `END;\n`;
          schemaSQL += `$$ LANGUAGE plpgsql;\n\n`;
        }
      }
    }

    schemaSQL += `-- =====================================================\n`;
    schemaSQL += `-- Grant permissions\n`;
    schemaSQL += `-- =====================================================\n`;
    schemaSQL += `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_admin;\n`;
    schemaSQL += `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_admin;\n`;
    schemaSQL += `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO invoice_admin;\n`;

    // Write to file
    const outputFile = 'complete-schema-export.sql';
    fs.writeFileSync(outputFile, schemaSQL);

    console.log(`\n✓ Schema exported to: ${outputFile}`);
    console.log(`\nFile size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
    console.log('\nYou can now use this file to recreate the database on EC2');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
})();
