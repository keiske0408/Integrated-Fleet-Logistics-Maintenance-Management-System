import { Request, Response, NextFunction } from 'express';
import arcjet, { fixedWindow, detectBot } from '@arcjet/node';
import { logger } from '../lib/logger';

const isProduction = process.env.NODE_ENV === 'production';
const arcjetKey = process.env.ARCJET_KEY;

// Arcjet instance for Procurement & PR Approval rate limiting
export const prRateLimitAj = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        fixedWindow({
          mode: isProduction ? 'LIVE' : 'DRY_RUN',
          max: 10, // Max 10 requests per minute
          window: '1m',
        }),
      ],
    })
  : null;

// Arcjet instance for TSRF Request Intake bot detection
export const tsrfBotDetectionAj = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        detectBot({
          mode: isProduction ? 'LIVE' : 'DRY_RUN',
          allow: [], // Block all automated bots
        }),
      ],
    })
  : null;

/**
 * Middleware: Rate limit PR approval and procurement endpoints.
 * Guards financial approval workflows against automated brute force or spam hammering.
 */
export async function rateLimitPrApproval(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!prRateLimitAj) {
    logger.debug('[Arcjet] ARCJET_KEY not set - skipping PR rate limiting in development/test');
    next();
    return;
  }

  try {
    const decision = await prRateLimitAj.protect(req);
    if (decision.isDenied()) {
      logger.debug({ ip: req.ip }, '[Arcjet] PR approval rate limit exceeded');
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded on procurement/PR approval endpoint. Please retry later.',
      });
      return;
    }
  } catch (error) {
    logger.debug({ error }, '[Arcjet] Error processing PR rate limit decision');
  }

  next();
}

/**
 * Middleware: Bot detection on TSRF request intake.
 * Prevents automated scripts and external bots from flooding dispatch intake forms.
 */
export async function protectTsrfIntake(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!tsrfBotDetectionAj) {
    logger.debug('[Arcjet] ARCJET_KEY not set - skipping TSRF bot detection in development/test');
    next();
    return;
  }

  try {
    const decision = await tsrfBotDetectionAj.protect(req);
    if (decision.isDenied()) {
      logger.debug({ ip: req.ip }, '[Arcjet] TSRF intake blocked by bot detection');
      res.status(403).json({
        error: 'Forbidden',
        message: 'Automated submission blocked by bot protection guardrail.',
      });
      return;
    }
  } catch (error) {
    logger.debug({ error }, '[Arcjet] Error processing TSRF bot detection decision');
  }

  next();
}
