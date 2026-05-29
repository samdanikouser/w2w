import { z } from 'zod';

// ── Shared Zod preprocessors ──
// The frontend sends empty strings "" for optional fields.
// These preprocessors convert "" → null before Zod validation runs.

/** For optional string fields — converts "" to null */
export const emptyToNull = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().nullish()
);

/** For optional UUID fields — converts "" to null, then validates UUID */
export const emptyToNullUuid = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().uuid().nullish()
);
