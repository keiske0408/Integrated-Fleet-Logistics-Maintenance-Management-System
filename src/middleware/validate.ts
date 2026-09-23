import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../lib/logger';

export interface ValidatedRequest<T> extends Request {
  validatedBody?: T;
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = result.error as ZodError;
      logger.debug(
        { issues: error.issues },
        '[ValidationMiddleware] Request body validation failed',
      );
      res.status(400).json({
        error: 'Validation failed',
        issues: error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    (req as ValidatedRequest<T>).validatedBody = result.data;
    next();
  };
}
