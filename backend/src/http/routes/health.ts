import { Router } from 'express';
import type { AppConfig } from '../../config';
import type { DatabaseHandle } from '../../db/connection';
import { parseQuery } from '../validation';
import { AppError } from '../errors';

export interface SchemaGuard {
  assertCompatible(): void;
}

export interface HealthDependencies {
  config: AppConfig;
  db: DatabaseHandle;
  schema?: SchemaGuard;
}

export function healthRouter(deps: HealthDependencies): Router {
  const router = Router();

  router.get('/health', (req, res) => {
    parseQuery(req.query as Record<string, unknown>, []);

    try {
      deps.db.probe();
      deps.schema?.assertCompatible();
    } catch {
      throw new AppError(503, 'SERVICE_UNAVAILABLE');
    }

    res.status(200).json({
      data: {
        status: 'ok',
        features: deps.config.features,
      },
    });
  });

  return router;
}
