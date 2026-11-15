import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from './database.js';

const backupDirectory = path.resolve(process.cwd(), process.env.BACKUP_DIR ?? './backups');
const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDirectory, `server-expiry-${timestamp}.sqlite`);

fs.mkdirSync(backupDirectory, { recursive: true });
const database = openDatabase();

try {
  await database.backup(backupPath);
  const cutoff = Date.now() - Math.max(retentionDays, 1) * 24 * 60 * 60 * 1000;

  for (const entry of fs.readdirSync(backupDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith('server-expiry-') || !entry.name.endsWith('.sqlite')) {
      continue;
    }

    const filePath = path.join(backupDirectory, entry.name);
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.rmSync(filePath, { force: true });
    }
  }

  console.log(`Database backup created: ${backupPath}`);
} finally {
  database.close();
}
