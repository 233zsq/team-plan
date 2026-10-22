import type { Express } from 'express';
import type { AppConfig } from '../../config';
import type { DatabaseHandle } from '../../db/connection';
import { healthRouter, type SchemaGuard } from './health';
import { testOnlyRouter } from './test-only';

export function registerRoutes(
  app: Express,
  config: AppConfig,
  db: DatabaseHandle,
  schema?: SchemaGuard,
): void {
  app.use('/api/v1', healthRouter({ config, db, schema }));

  if (config.env === 'test') {
    app.use('/api/v1', testOnlyRouter());
  }
}
