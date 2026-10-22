import type Database from 'better-sqlite3';

export interface SeedMember {
  id: string;
  displayName: string;
  seedOrder: number;
}

export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedError';
  }
}

export const SEED_MEMBERS: readonly SeedMember[] = Object.freeze([
  {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: '成员 A',
    seedOrder: 1,
  },
  {
    id: '11111111-1111-4111-8111-111111111112',
    displayName: '成员 B',
    seedOrder: 2,
  },
  {
    id: '11111111-1111-4111-8111-111111111113',
    displayName: '成员 C',
    seedOrder: 3,
  },
  {
    id: '11111111-1111-4111-8111-111111111114',
    displayName: '成员 D',
    seedOrder: 4,
  },
]);

const SEED_CREATED_AT = '2026-10-20T00:00:00.000Z';

interface SeedRow {
  display_name: string;
  seed_order: number;
}

/**
 * Idempotent seed with fixed IDs and order. It never updates or deletes existing
 * members, and fails loudly if the fixed seed conflicts with existing data.
 */
export function seedMembers(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO members (id, display_name, seed_order, created_at) VALUES (?, ?, ?, ?)',
  );

  db.transaction(() => {
    for (const member of SEED_MEMBERS) {
      insert.run(member.id, member.displayName, member.seedOrder, SEED_CREATED_AT);
    }
  })();

  const select = db.prepare('SELECT display_name, seed_order FROM members WHERE id = ?');

  for (const member of SEED_MEMBERS) {
    const row = select.get(member.id) as SeedRow | undefined;
    if (row === undefined) {
      throw new SeedError(`成员种子冲突：缺少固定成员 ${member.id}`);
    }
    if (row.seed_order !== member.seedOrder || row.display_name !== member.displayName) {
      throw new SeedError(`成员种子冲突：${member.id} 的既有数据与固定种子不一致`);
    }
  }
}

export function countMembers(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM members').get() as { count: number };
  return row.count;
}
