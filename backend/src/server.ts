import path from 'node:path';
import dotenv from 'dotenv';
import { createApp } from './app';
import { ConfigError, loadConfig, type AppConfig } from './config';
import { openDatabase, type DatabaseHandle } from './db/connection';
import { DatabaseNotInitializedError } from './db/errors';
import { assertSchemaCompatible, MigrationError } from './db/migrations';
import { createLogger } from './http/logger';
import { ERROR_MESSAGES } from './http/messages';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

function fatal(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main(): void {
  dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });

  const logger = createLogger();

  let config: AppConfig;
  try {
    config = loadConfig(process.env, PROJECT_ROOT);
  } catch (error) {
    if (error instanceof ConfigError) {
      fatal(
        [
          '启动失败：配置无效',
          ...error.problems.map((problem) => `- ${problem}`),
          '请对照 .env.example 修正后重试；未打开数据库、未写入任何文件。',
        ].join('\n'),
      );
    }
    throw error;
  }

  let db: DatabaseHandle;
  try {
    db = openDatabase(config.databasePath);
  } catch (error) {
    if (error instanceof DatabaseNotInitializedError) {
      fatal(`启动失败：${error.message}`);
    }
    fatal('启动失败：无法打开数据库（请检查 DATABASE_PATH 与文件权限）');
  }

  try {
    assertSchemaCompatible(db.raw, MIGRATIONS_DIR);
  } catch (error) {
    db.close();
    const message =
      error instanceof MigrationError
        ? error.message
        : '数据库结构不兼容（请执行 npm run db:init 后重试）';
    fatal(`启动失败：${message}`);
  }

  const app = createApp({
    config,
    db,
    logger,
    schema: {
      assertCompatible: () => assertSchemaCompatible(db.raw, MIGRATIONS_DIR),
    },
  });

  const server = app.listen(config.port, config.host, () => {
    logger.info('server_started', {
      host: config.host,
      port: config.port,
      node: process.version,
    });
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    const message =
      error.code === 'EADDRINUSE'
        ? `端口 ${config.port} 已被占用`
        : '无法监听端口（请检查 HOST 与 PORT）';
    logger.error('server_error', { code: error.code }, error);
    try {
      db.close();
    } catch {
      // The handle may not have finished opening; the process exits anyway.
    }
    fatal(`启动失败：${message}`);
  });

  server.on('clientError', (_error, socket) => {
    if (!socket.writable || socket.destroyed) {
      return;
    }

    const body = JSON.stringify({
      error: {
        code: 'BAD_REQUEST',
        message: ERROR_MESSAGES.BAD_REQUEST,
      },
    });

    socket.end(
      [
        'HTTP/1.1 400 Bad Request',
        'Content-Type: application/json; charset=utf-8',
        `Content-Length: ${Buffer.byteLength(body)}`,
        'Connection: close',
        '',
        body,
      ].join('\r\n'),
    );
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info('server_stopping', { signal });
    server.close(() => {
      try {
        db.close();
      } catch {
        // Closing an already-closed handle is harmless.
      }
      process.exit(0);
    });
    const timer = setTimeout(() => process.exit(1), 5000);
    timer.unref();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main();
