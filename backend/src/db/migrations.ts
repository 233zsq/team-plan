import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationFile {
  version: string;
  fileName: string;
  checksum: string;
  sql: string;
}

export interface MigrationPlan {
  files: MigrationFile[];
  applied: string[];
  pending: MigrationFile[];
  initialized: boolean;
  currentVersion: string | null;
}

export interface ApplyMigrationsResult {
  applied: string[];
  currentVersion: string | null;
}

interface AppliedRow {
  version: string;
  checksum: string;
}

const MIGRATION_FILE_PATTERN = /^(\d{4})_.+\.sql$/;

/** Normalize line endings so a Windows checkout and a Linux checkout hash alike. */
export function normalizeSql(sql: string): string {
  return sql.replace(/\r\n?/g, '\n');
}

export function checksumSql(sql: string): string {
  return crypto.createHash('sha256').update(normalizeSql(sql), 'utf8').digest('hex');
}

export function discoverMigrations(directory: string): MigrationFile[] {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new MigrationError('迁移目录不存在');
  }

  const fileNames = fs
    .readdirSync(directory)
    .filter((name) => MIGRATION_FILE_PATTERN.test(name))
    .sort();

  const seen = new Set<string>();
  const files: MigrationFile[] = [];

  for (const fileName of fileNames) {
    const version = fileName.slice(0, 4);
    if (seen.has(version)) {
      throw new MigrationError(`迁移编号重复：${version}`);
    }
    seen.add(version);

    const sql = normalizeSql(fs.readFileSync(path.join(directory, fileName), 'utf8'));
    files.push({ version, fileName, checksum: checksumSql(sql), sql });
  }

  files.forEach((file, index) => {
    const expected = String(index + 1).padStart(4, '0');
    if (file.version !== expected) {
      throw new MigrationError(`迁移编号不连续：期望 ${expected}，实际 ${file.version}`);
    }
  });

  return files;
}

function schemaTableExists(db: Database.Database): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  return row !== undefined;
}

function readApplied(db: Database.Database): AppliedRow[] {
  if (!schemaTableExists(db)) {
    return [];
  }
  return db
    .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
    .all() as AppliedRow[];
}

export function planMigrations(db: Database.Database, directory: string): MigrationPlan {
  const files = discoverMigrations(directory);
  const initialized = schemaTableExists(db);
  const appliedRows = readApplied(db);
  const filesByVersion = new Map(files.map((file) => [file.version, file]));

  let maxApplied = 0;
  for (const row of appliedRows) {
    const file = filesByVersion.get(row.version);
    if (file === undefined) {
      throw new MigrationError(`已应用迁移缺少文件：${row.version}`);
    }
    if (file.checksum !== row.checksum) {
      throw new MigrationError(`迁移校验和不一致：${row.version}`);
    }
    maxApplied = Math.max(maxApplied, Number(row.version));
  }

  const appliedVersions = new Set(appliedRows.map((row) => row.version));
  const pending = files.filter((file) => !appliedVersions.has(file.version));

  for (const file of pending) {
    if (Number(file.version) <= maxApplied) {
      throw new MigrationError(`迁移顺序异常：${file.version} 低于已应用版本`);
    }
  }

  return {
    files,
    applied: appliedRows.map((row) => row.version),
    pending,
    initialized,
    currentVersion: appliedRows.length === 0 ? null : appliedRows[appliedRows.length - 1]!.version,
  };
}

export function applyMigrations(
  db: Database.Database,
  directory: string,
  now: () => string = () => new Date().toISOString(),
): ApplyMigrationsResult {
  const plan = planMigrations(db, directory);

  if (plan.pending.length === 0) {
    return { applied: [], currentVersion: plan.currentVersion };
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, checksum, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of plan.pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, migration.checksum, now());
    })();
  }

  const applied = readApplied(db);
  return {
    applied: plan.pending.map((migration) => migration.version),
    currentVersion: applied.length === 0 ? null : applied[applied.length - 1]!.version,
  };
}

/** Startup/health guard: every migration must be applied with the expected checksum. */
export function assertSchemaCompatible(db: Database.Database, directory: string): void {
  const plan = planMigrations(db, directory);

  if (plan.files.length === 0) {
    throw new MigrationError('迁移目录为空');
  }
  if (!plan.initialized) {
    throw new MigrationError('数据库尚未初始化，请执行 npm run db:init');
  }
  if (plan.pending.length > 0) {
    const versions = plan.pending.map((migration) => migration.version).join(', ');
    throw new MigrationError(`数据库结构版本落后，请执行 npm run db:init（待执行：${versions}）`);
  }
}

export function currentSchemaVersion(db: Database.Database): string | null {
  const applied = readApplied(db);
  return applied.length === 0 ? null : applied[applied.length - 1]!.version;
}
