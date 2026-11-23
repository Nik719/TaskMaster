import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { errorHandler, toApiError } from '../../src/middleware/errorHandler.js';
import { validate } from '../../src/middleware/validate.js';
import { ApiError } from '../../src/utils/ApiError.js';

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function prismaError(code) {
  return new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });
}

describe('toApiError', () => {
  it('passes ApiError through unchanged', () => {
    const err = ApiError.forbidden();
    expect(toApiError(err)).toBe(err);
  });

  it('maps a Prisma unique-constraint error (P2002) to 409 CONFLICT', () => {
    expect(toApiError(prismaError('P2002'))).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });

  it('maps a Prisma record-not-found error (P2025) to 404 NOT_FOUND', () => {
    expect(toApiError(prismaError('P2025'))).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('treats other Prisma errors and plain errors as unexpected', () => {
    expect(toApiError(prismaError('P1001'))).toBeNull();
    expect(toApiError(new Error('boom'))).toBeNull();
  });
});

describe('errorHandler', () => {
  it('hides the message of unexpected errors behind a generic 500', () => {
    const res = mockRes();
    const req = { log: { error: vi.fn() } };

    errorHandler(new Error('secret internal detail'), req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret internal detail');
    expect(req.log.error).toHaveBeenCalled();
  });

  it('includes details when the ApiError has them', () => {
    const res = mockRes();
    errorHandler(ApiError.validation([{ path: 'email', message: 'Invalid' }]), {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ path: 'email', message: 'Invalid' }],
      },
    });
  });
});

describe('validate middleware', () => {
  const schema = {
    body: z.object({ name: z.string().min(1) }),
    query: z.object({ page: z.coerce.number() }),
  };

  it('stores parsed values on req.validated and strips unknown fields', () => {
    const req = { body: { name: 'Alpha', role: 'OWNER' }, query: { page: '2' } };
    const next = vi.fn();

    validate(schema)(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.validated).toEqual({ body: { name: 'Alpha' }, query: { page: 2 } });
  });

  it('collects issues from every location into one VALIDATION_ERROR', () => {
    const req = { body: { name: '' }, query: { page: 'abc' } };
    const next = vi.fn();

    validate(schema)(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details.map((d) => d.location).sort()).toEqual(['body', 'query']);
  });
});
