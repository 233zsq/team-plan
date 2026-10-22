import express, { type Express } from 'express';
import type { AppConfig } from './config';
import type { DatabaseHandle } from './db/connection';
import type { Logger } from './http/logger';
import { errorHandler } from './http/middleware/error-handler';
import { hostGuard } from './http/middleware/host-guard';
import { apiNotFound } from './http/middleware/not-found';
import { requestLog } from './http/middleware/request-log';
import { securityHeaders } from './http/middleware/security-headers';
import { registerRoutes } from './http/routes';
import type { SchemaGuard } from './http/routes/health';

export interface AppDependencies {
  config: AppConfig;
  db: DatabaseHandle;
  logger: Logger;
  schema?: SchemaGuard;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('query parser', 'simple');

  app.use(securityHeaders());
  app.use(requestLog(deps.logger));
  app.use(hostGuard(deps.config.allowedHosts));

  registerRoutes(app, deps.config, deps.db, deps.schema);

  app.use('/api', apiNotFound());
  app.use(errorHandler(deps.logger));

  return app;
}
