import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import {
  isPrApproved,
  assertPrApproved,
  PurchaseRequisitionGatingError,
} from '../src/domain/prGating';

describe('Domain Rule 4: Single Centralized Purchase Requisition (PR) Gatekeeper', () => {
  describe('Unit Gatekeeper Logic', () => {
    it('should identify only "approved" status as valid and unlocked', () => {
      expect(isPrApproved('approved')).toBe(true);
      expect(isPrApproved('Approved')).toBe(true);
      expect(isPrApproved('APPROVED')).toBe(true);
    });

    it('should reject non-approved PR statuses ("pending", "draft", "rejected", null)', () => {
      expect(isPrApproved('pending')).toBe(false);
      expect(isPrApproved('draft')).toBe(false);
      expect(isPrApproved('rejected')).toBe(false);
      expect(isPrApproved(null)).toBe(false);
      expect(isPrApproved(undefined)).toBe(false);
    });

    it('should throw PurchaseRequisitionGatingError when asserting non-approved PR', () => {
      expect(() => assertPrApproved('pending')).toThrow(PurchaseRequisitionGatingError);
      expect(() => assertPrApproved('draft')).toThrow(PurchaseRequisitionGatingError);
      expect(() => assertPrApproved(null)).toThrow(PurchaseRequisitionGatingError);
    });

    it('should succeed silently without throwing when asserting approved PR', () => {
      expect(() => assertPrApproved('approved')).not.toThrow();
    });
  });

  describe('Integration / Express Gated Endpoint', () => {
    // Create minimal test app mimicking repair work order unlock
    const app = express();
    app.use(express.json());

    app.post('/api/repair/:id/unlock', (req: Request, res: Response) => {
      const { prStatus } = req.body;
      try {
        assertPrApproved(prStatus);
        res
          .status(200)
          .json({ status: 'unlocked', message: 'Work order unlocked for procurement.' });
      } catch (err) {
        if (err instanceof PurchaseRequisitionGatingError) {
          res.status(403).json({ error: 'PR Gating Block', message: err.message });
          return;
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    it('should block repair work order progression if linked PR is "pending"', async () => {
      const res = await request(app)
        .post('/api/repair/order-123/unlock')
        .send({ prStatus: 'pending' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PR Gating Block');
      expect(res.body.message).toContain('must be in "approved" status');
    });

    it('should block repair work order progression if linked PR is missing or "draft"', async () => {
      const res = await request(app)
        .post('/api/repair/order-123/unlock')
        .send({ prStatus: 'draft' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PR Gating Block');
    });

    it('should unlock repair work order progression when linked PR status is "approved"', async () => {
      const res = await request(app)
        .post('/api/repair/order-123/unlock')
        .send({ prStatus: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unlocked');
    });
  });
});
