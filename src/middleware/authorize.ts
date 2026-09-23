import { Request, Response, NextFunction } from 'express';
import { Action, Subject, AuthUser, defineAbilityFor } from '../auth/abilities';
import { logger } from '../lib/logger';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function requireAbility(action: Action, subject: Subject) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // If no user attached to request, reject with 401 Unauthorized
    if (!req.user) {
      logger.debug('[RBAC] Request rejected: No authenticated user found on request');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required to access this resource.',
      });
      return;
    }

    const ability = defineAbilityFor(req.user);

    if (!ability.can(action, subject)) {
      logger.debug(
        { userId: req.user.id, role: req.user.role, action, subject },
        '[RBAC] Access denied: User lacks required CASL ability',
      );
      res.status(403).json({
        error: 'Forbidden',
        message: `Forbidden: Role "${req.user.role}" cannot perform "${action}" on "${subject}".`,
      });
      return;
    }

    next();
  };
}
