import path from 'node:path';
import dotenv from 'dotenv';
import { ConfigError, loadConfig } from '../config';
import { initializeDatabase } from './initialize';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });

try {
  const config = loadConfig({ DATABASE_PATH: process.env.DATABASE_PATH }, PROJECT_ROOT);
  const result = initializeDatabase({
    databasePath: config.databasePath,
    migrationsDir: MIGRATIONS_DIR,
  });

  process.stdout.write(
    [
      `${result.created ? '已创建' : '已使用现有'}数据库：${config.databasePath}`,
      `迁移：${result.applied.length === 0 ? '无待执行' : result.applied.join(', ')}；当前版本 ${result.currentVersion ?? '无'}`,
      `成员：${result.memberCount} 条`,
    ].join('\n') + '\n',
  );
} catch (error) {
  if (error instanceof ConfigError) {
    process.stderr.write(
      ['初始化失败：配置无效', ...error.problems.map((problem) => `- ${problem}`)].join('\n') + '\n',
    );
  } else {
    process.stderr.write(
      `初始化失败：${error instanceof Error ? error.message : '未知错误'}\n`,
    );
  }
  process.exit(1);
}
