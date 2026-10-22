import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DatabaseNotInitializedError } from './errors';

export interface DatabaseHandle {
  readonly raw: Database.Database;
  probe(): void;
  close(): void;
}

/**
 * Open the configured database without creating a replacement empty file.
 * A missing file is a startup error; initialization is an explicit step.
 */
export function openDatabase(databasePath: string): DatabaseHandle {
  const absolutePath = path.resolve(databasePath);

  if (!fs.existsSync(absolutePath)) {
    throw new DatabaseNotInitializedError();
  }

  const raw = new Database(absolutePath);
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');

  let closed = false;

  return {
    raw,
    probe(): void {
      probeReadable(absolutePath);
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;
      if (raw.open) {
        raw.close();
      }
    },
  };
}

/**
 * Read-only probe on its own connection with a short busy timeout, so a write
 * lock cannot hold the health endpoint for the full 5000 ms.
 */
export function probeReadable(databasePath: string): void {
  const probe = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    probe.pragma('busy_timeout = 200');
    probe.prepare('SELECT 1').get();
  } finally {
    try {
      probe.close();
    } catch {
      // The probe connection may already be closed after a failed open.
    }
  }
}
