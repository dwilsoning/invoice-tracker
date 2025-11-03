#!/usr/bin/env node

/**
 * Invoice Tracker - AWS Migration Script
 *
 * This script migrates all data from local to AWS EC2:
 * - Database schema and data
 * - Invoice PDFs
 * - Uploaded files
 * - Configuration
 *
 * Usage:
 *   Local machine: node scripts/migrate-to-aws.js --export
 *   AWS EC2: node scripts/migrate-to-aws.js --import --file invoice-tracker-data.tar.gz
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  exportDir: path.join(__dirname, '..', 'migration-export'),
  backupDir: path.join(__dirname, '..', 'backups'),
  pdfDir: path.join(__dirname, '..', 'invoice_pdfs'),
  uploadsDir: path.join(__dirname, '..', 'uploads'),

  // Database settings (from .env)
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || '5432',
  dbName: process.env.DB_NAME || 'invoice_tracker',
  dbUser: process.env.DB_USER || 'invoice_tracker_user',
  dbPassword: process.env.DB_PASSWORD,
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Check if command exists
async function commandExists(cmd) {
  try {
    await execAsync(`which ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

// Get directory size
async function getDirectorySize(dirPath) {
  try {
    const { stdout } = await execAsync(`du -sh "${dirPath}" | cut -f1`);
    return stdout.trim();
  } catch {
    return 'Unknown';
  }
}

// Count files in directory
function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let count = 0;
  function traverse(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        count++;
      }
    });
  }
  traverse(dirPath);
  return count;
}

// Export database
async function exportDatabase() {
  logInfo('Exporting database...');

  const dumpFile = path.join(CONFIG.exportDir, 'database-dump.sql');

  // Check if pg_dump exists
  if (!await commandExists('pg_dump')) {
    throw new Error('pg_dump not found. Please install PostgreSQL client tools.');
  }

  // Build pg_dump command
  const pgDumpCmd = [
    'pg_dump',
    `-h ${CONFIG.dbHost}`,
    `-p ${CONFIG.dbPort}`,
    `-U ${CONFIG.dbUser}`,
    `-d ${CONFIG.dbName}`,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    `--file="${dumpFile}"`
  ].join(' ');

  // Set password environment variable
  const env = { ...process.env, PGPASSWORD: CONFIG.dbPassword };

  try {
    await execAsync(pgDumpCmd, { env });

    // Get file size
    const stats = fs.statSync(dumpFile);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    logSuccess(`Database exported: ${sizeInMB} MB`);

    // Compress database dump
    logInfo('Compressing database dump...');
    await execAsync(`gzip -f "${dumpFile}"`);

    const compressedStats = fs.statSync(`${dumpFile}.gz`);
    const compressedSizeInMB = (compressedStats.size / (1024 * 1024)).toFixed(2);

    logSuccess(`Database compressed: ${compressedSizeInMB} MB`);

    return `${dumpFile}.gz`;
  } catch (error) {
    throw new Error(`Database export failed: ${error.message}`);
  }
}

// Copy directory recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    logWarning(`Directory does not exist: ${src}`);
    return 0;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  let fileCount = 0;
  const items = fs.readdirSync(src);

  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      fileCount += copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
    }
  });

  return fileCount;
}

// Export files
async function exportFiles() {
  logInfo('Exporting invoice PDFs...');

  const exportPdfDir = path.join(CONFIG.exportDir, 'invoice_pdfs');
  const pdfCount = copyDirectory(CONFIG.pdfDir, exportPdfDir);
  const pdfSize = await getDirectorySize(exportPdfDir);

  logSuccess(`Exported ${pdfCount} PDF files (${pdfSize})`);

  logInfo('Exporting uploaded files...');

  const exportUploadsDir = path.join(CONFIG.exportDir, 'uploads');
  const uploadCount = copyDirectory(CONFIG.uploadsDir, exportUploadsDir);
  const uploadSize = await getDirectorySize(exportUploadsDir);

  logSuccess(`Exported ${uploadCount} uploaded files (${uploadSize})`);

  return { pdfCount, uploadCount };
}

// Export metadata
async function exportMetadata() {
  logInfo('Creating migration metadata...');

  const metadata = {
    exportDate: new Date().toISOString(),
    sourceHost: CONFIG.dbHost,
    databaseName: CONFIG.dbName,
    nodeVersion: process.version,
    platform: process.platform,
    files: {
      pdfs: countFiles(CONFIG.pdfDir),
      uploads: countFiles(CONFIG.uploadsDir)
    }
  };

  const metadataFile = path.join(CONFIG.exportDir, 'migration-metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

  logSuccess('Metadata created');

  return metadata;
}

// Create tarball
async function createTarball() {
  logInfo('Creating compressed archive...');

  const tarballName = `invoice-tracker-data-${Date.now()}.tar.gz`;
  const tarballPath = path.join(__dirname, '..', tarballName);

  const tarCmd = `tar -czf "${tarballPath}" -C "${path.dirname(CONFIG.exportDir)}" "${path.basename(CONFIG.exportDir)}"`;

  await execAsync(tarCmd);

  const stats = fs.statSync(tarballPath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  logSuccess(`Archive created: ${tarballName} (${sizeInMB} MB)`);

  return tarballPath;
}

// Export workflow
async function runExport() {
  log('\n=== Invoice Tracker Data Export ===\n', 'cyan');

  try {
    // Create export directory
    if (fs.existsSync(CONFIG.exportDir)) {
      logWarning('Cleaning previous export...');
      fs.rmSync(CONFIG.exportDir, { recursive: true, force: true });
    }
    fs.mkdirSync(CONFIG.exportDir, { recursive: true });

    // Export database
    await exportDatabase();

    // Export files
    await exportFiles();

    // Export metadata
    const metadata = await exportMetadata();

    // Create tarball
    const tarballPath = await createTarball();

    // Cleanup export directory
    fs.rmSync(CONFIG.exportDir, { recursive: true, force: true });

    // Summary
    log('\n=== Export Summary ===\n', 'cyan');
    logSuccess('Export completed successfully!');
    log(`\nExport file: ${path.basename(tarballPath)}`, 'green');
    log(`Location: ${tarballPath}`, 'blue');
    log(`\nFiles exported:`, 'blue');
    log(`  - PDFs: ${metadata.files.pdfs}`);
    log(`  - Uploads: ${metadata.files.uploads}`);
    log(`\nNext steps:`, 'yellow');
    log(`1. Transfer file to EC2:`);
    log(`   scp -i your-key.pem ${path.basename(tarballPath)} ubuntu@<EC2-IP>:~/`);
    log(`2. On EC2, run:`);
    log(`   node scripts/migrate-to-aws.js --import --file ${path.basename(tarballPath)}`);

  } catch (error) {
    logError(`Export failed: ${error.message}`);
    process.exit(1);
  }
}

// Import database
async function importDatabase(dumpFile) {
  logInfo('Importing database...');

  // Check if psql exists
  if (!await commandExists('psql')) {
    throw new Error('psql not found. Please install PostgreSQL client tools.');
  }

  // Decompress if needed
  let sqlFile = dumpFile;
  if (dumpFile.endsWith('.gz')) {
    logInfo('Decompressing database dump...');
    await execAsync(`gunzip -k "${dumpFile}"`);
    sqlFile = dumpFile.replace('.gz', '');
  }

  // Import database
  const psqlCmd = [
    'psql',
    `-h ${CONFIG.dbHost}`,
    `-p ${CONFIG.dbPort}`,
    `-U ${CONFIG.dbUser}`,
    `-d ${CONFIG.dbName}`,
    `-f "${sqlFile}"`
  ].join(' ');

  const env = { ...process.env, PGPASSWORD: CONFIG.dbPassword };

  try {
    await execAsync(psqlCmd, { env });
    logSuccess('Database imported successfully');
  } catch (error) {
    throw new Error(`Database import failed: ${error.message}`);
  }
}

// Import files
async function importFiles(extractDir) {
  logInfo('Importing invoice PDFs...');

  const sourcePdfDir = path.join(extractDir, 'invoice_pdfs');
  const destPdfDir = CONFIG.pdfDir;

  if (!fs.existsSync(destPdfDir)) {
    fs.mkdirSync(destPdfDir, { recursive: true });
  }

  const pdfCount = copyDirectory(sourcePdfDir, destPdfDir);
  logSuccess(`Imported ${pdfCount} PDF files`);

  logInfo('Importing uploaded files...');

  const sourceUploadsDir = path.join(extractDir, 'uploads');
  const destUploadsDir = CONFIG.uploadsDir;

  if (!fs.existsSync(destUploadsDir)) {
    fs.mkdirSync(destUploadsDir, { recursive: true });
  }

  const uploadCount = copyDirectory(sourceUploadsDir, destUploadsDir);
  logSuccess(`Imported ${uploadCount} uploaded files`);

  return { pdfCount, uploadCount };
}

// Verify import
async function verifyImport() {
  logInfo('Verifying import...');

  // Check database connection
  const psqlCmd = `psql -h ${CONFIG.dbHost} -p ${CONFIG.dbPort} -U ${CONFIG.dbUser} -d ${CONFIG.dbName} -c "SELECT COUNT(*) FROM invoices"`;
  const env = { ...process.env, PGPASSWORD: CONFIG.dbPassword };

  try {
    const { stdout } = await execAsync(psqlCmd, { env });
    const match = stdout.match(/\d+/);
    const invoiceCount = match ? parseInt(match[0]) : 0;
    logSuccess(`Database contains ${invoiceCount} invoices`);
  } catch (error) {
    logWarning('Could not verify database (table may not exist yet)');
  }

  // Check files
  const pdfCount = countFiles(CONFIG.pdfDir);
  const uploadCount = countFiles(CONFIG.uploadsDir);

  logSuccess(`Files verified: ${pdfCount} PDFs, ${uploadCount} uploads`);
}

// Import workflow
async function runImport(tarballPath) {
  log('\n=== Invoice Tracker Data Import ===\n', 'cyan');

  try {
    // Verify file exists
    if (!fs.existsSync(tarballPath)) {
      throw new Error(`File not found: ${tarballPath}`);
    }

    // Create temp directory
    const tempDir = path.join(__dirname, '..', 'migration-temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Extract tarball
    logInfo('Extracting archive...');
    await execAsync(`tar -xzf "${tarballPath}" -C "${tempDir}"`);
    logSuccess('Archive extracted');

    const extractDir = path.join(tempDir, 'migration-export');

    // Read metadata
    const metadataFile = path.join(extractDir, 'migration-metadata.json');
    if (fs.existsSync(metadataFile)) {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
      log('\nMigration Info:', 'blue');
      log(`  Export Date: ${new Date(metadata.exportDate).toLocaleString()}`);
      log(`  Source: ${metadata.sourceHost}/${metadata.databaseName}`);
      log(`  Files: ${metadata.files.pdfs} PDFs, ${metadata.files.uploads} uploads`);
      log('');
    }

    // Import database
    const dbDumpFile = path.join(extractDir, 'database-dump.sql.gz');
    await importDatabase(dbDumpFile);

    // Import files
    await importFiles(extractDir);

    // Verify import
    await verifyImport();

    // Cleanup
    logInfo('Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Summary
    log('\n=== Import Summary ===\n', 'cyan');
    logSuccess('Import completed successfully!');
    log('\nNext steps:', 'yellow');
    log('1. Verify data in application');
    log('2. Test user login');
    log('3. Check invoice PDFs are accessible');
    log('4. Run application tests');
    log('5. Create fresh backup of imported data');

  } catch (error) {
    logError(`Import failed: ${error.message}`);
    process.exit(1);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--export')) {
    await runExport();
  } else if (args.includes('--import')) {
    const fileIndex = args.indexOf('--file');
    if (fileIndex === -1 || !args[fileIndex + 1]) {
      logError('Please specify file with --file <path>');
      process.exit(1);
    }
    const tarballPath = path.resolve(args[fileIndex + 1]);
    await runImport(tarballPath);
  } else {
    log('Invoice Tracker - AWS Migration Script\n', 'cyan');
    log('Usage:');
    log('  Export: node scripts/migrate-to-aws.js --export');
    log('  Import: node scripts/migrate-to-aws.js --import --file <tarball-path>');
    log('');
    log('Examples:');
    log('  Local:  node scripts/migrate-to-aws.js --export');
    log('  AWS EC2: node scripts/migrate-to-aws.js --import --file invoice-tracker-data.tar.gz');
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config();

// Run
main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
