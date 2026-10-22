import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TempDatabase {
  dir: string;
  path: string;
  cleanup(): void;
}

/** A real, disposable SQLite file so tests never touch the repo `data/` dir. */
export function createTempDatabase(): TempDatabase {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-plan-test-'));
  const databasePath = path.join(dir, 'test.sqlite');
  fs.writeFileSync(databasePath, Buffer.alloc(0));

  return {
    dir,
    path: databasePath,
    cleanup(): void {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
