import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from './connection';
import { applyMigrations } from './migrations';
import { countMembers, seedMembers } from './seed';

export interface InitializeDatabaseOptions {
  databasePath: string;
  migrationsDir: string;
  now?: () => string;
}

export interface InitializeDatabaseResult {
  created: boolean;
  applied: string[];
  currentVersion: string | null;
  memberCount: number;
}

/**
 * Explicit initialization: create the file when absent, apply pending
 * migrations in order, then seed the four fixed members. Existing boards and
 * tasks are never deleted.
 */
export function initializeDatabase(
  options: InitializeDatabaseOptions,
): InitializeDatabaseResult {
  const absolutePath = path.resolve(options.databasePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  let created = false;
  if (!fs.existsSync(absolutePath)) {
    try {
      fs.writeFileSync(absolutePath, Buffer.alloc(0), { flag: 'wx' });
      created = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  const db = openDatabase(absolutePath);
  try {
    const migration = applyMigrations(db.raw, options.migrationsDir, options.now);
    seedMembers(db.raw);

    return {
      created,
      applied: migration.applied,
      currentVersion: migration.currentVersion,
      memberCount: countMembers(db.raw),
    };
  } finally {
    db.close();
  }
}
