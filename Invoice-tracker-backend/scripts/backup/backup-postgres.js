#!/usr/bin/env node

/**
 * PostgreSQL Database Backup Script
 * Creates timestamped backups of the invoice_tracker database
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Backup configuration
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'invoice_tracker';
const DB_USER = process.env.DB_USER || 'invoice_tracker_user';
const DB_PASSWORD = process.env.DB_PASSWORD;

// Keep backups for 30 days
const RETENTION_DAYS = 30;

async function createBackup() {
  try {
    console.log('=====================================');
    console.log('PostgreSQL Backup Tool');
    console.log('=====================================\n');

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('✓ Created backup directory');
    }

    // Generate timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const backupFile = path.join(BACKUP_DIR, `invoice_tracker_${timestamp}.sql`);

    console.log(`Creating backup: ${path.basename(backupFile)}`);
    console.log(`Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}`);
    console.log('');

    // Set password environment variable for pg_dump
    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };

    // Create pg_dump command
    const dumpCommand = `pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F p -f "${backupFile}"`;

    // Execute backup
    await new Promise((resolve, reject) => {
      exec(dumpCommand, { env }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Backup failed: ${error.message}`));
          return;
        }
        if (stderr && !stderr.includes('WARNING')) {
          console.log('pg_dump output:', stderr);
        }
        resolve();
      });
    });

    // Get backup file size
    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('✓ Backup completed successfully');
    console.log(`  File: ${backupFile}`);
    console.log(`  Size: ${fileSizeInMB} MB`);
    console.log('');

    // Clean up old backups
    await cleanupOldBackups();

    console.log('=====================================');
    console.log('Backup Summary');
    console.log('=====================================');
    console.log(`✓ Backup created: ${path.basename(backupFile)}`);
    console.log(`✓ Size: ${fileSizeInMB} MB`);
    console.log(`✓ Location: ${BACKUP_DIR}`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Ensure PostgreSQL is running');
    console.error('2. Check .env file has correct database credentials');
    console.error('3. Ensure pg_dump is in your PATH');
    console.error('');
    process.exit(1);
  }
}

async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('invoice_tracker_') && f.endsWith('.sql'));

    if (backupFiles.length === 0) {
      return;
    }

    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of backupFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > retentionMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`  Deleted old backup: ${file}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} old backup(s) (older than ${RETENTION_DAYS} days)`);
    }

    const remainingCount = backupFiles.length - deletedCount;
    console.log(`✓ Total backups: ${remainingCount}`);
    console.log('');

  } catch (error) {
    console.warn('⚠ Warning: Could not clean up old backups:', error.message);
  }
}

// List existing backups
function listBackups() {
  console.log('=====================================');
  console.log('Existing Backups');
  console.log('=====================================\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backups found (backup directory does not exist)');
    console.log('');
    return;
  }

  const files = fs.readdirSync(BACKUP_DIR);
  const backupFiles = files
    .filter(f => f.startsWith('invoice_tracker_') && f.endsWith('.sql'))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.log('No backups found');
    console.log('');
    return;
  }

  backupFiles.forEach((file, index) => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const date = new Date(stats.mtime).toLocaleString();

    console.log(`${index + 1}. ${file}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Date: ${date}`);
    console.log('');
  });

  console.log(`Total: ${backupFiles.length} backup(s)`);
  console.log('=====================================\n');
}

// Command line arguments
const command = process.argv[2];

if (command === 'list') {
  listBackups();
} else {
  createBackup();
}
