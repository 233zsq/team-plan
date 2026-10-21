import { Router } from 'express';
import { AppError } from '../errors';
import { writeRoute } from '../middleware/json-body';
import { assertAllowedKeys } from '../validation';

/**
 * Test-only fault and echo routes. Mounted only when NODE_ENV=test so that
 * 413/415/422/500 behaviour can be exercised without polluting a real app.
 */
export function testOnlyRouter(): Router {
  const router = Router();

  router.post(
    '/__test/echo',
    ...writeRoute((req, res) => {
      const body = req.body as Record<string, unknown>;
      assertAllowedKeys(body, ['payload']);
      res.status(200).json({ data: { ok: true } });
    }),
  );

  router.post(
    '/__test/keys',
    ...writeRoute((req, res) => {
      const body = req.body as Record<string, unknown>;
      assertAllowedKeys(body, ['name']);
      res.status(200).json({ data: { name: body.name } });
    }),
  );

  router.get('/__test/boom', () => {
    throw new Error('SELECT * FROM secret at C:\\private\\db.sqlite');
  });

  router.get('/__test/validation', () => {
    throw new AppError(422, 'VALIDATION_ERROR', {
      fields: { title: '标题不能为空' },
    });
  });

  return router;
}
