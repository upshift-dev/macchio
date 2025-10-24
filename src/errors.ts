import { Data } from "effect";

export type NormalizedError = {
  name: string; // e.g. "TypeError"
  message: string; // human readable
  stack?: string; // if available
  cause?: NormalizedError; // chained causes
  extras?: Record<string, unknown>; // safe, small metadata
};

// 3) Type guards / helpers
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]) =>
  keys.reduce((acc, k) => {
    if (k in obj) (acc as Record<K, unknown>)[k] = obj[k];
    return acc;
  }, {} as Pick<T, K>);

// Avoid blowing up on huge / circular objects
function safeJsonSummary(value: unknown, maxLen = 2_000): string | undefined {
  try {
    const seen = new WeakSet();
    const s = JSON.stringify(
      value,
      (_, v) => {
        if (isObject(v)) {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        return v;
      },
      0
    );
    return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
  } catch {
    return undefined;
  }
}

// 4) The normalizer
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export function normalizeUnknownError(err: unknown): NormalizedError {
  // Proper Error (includes DOMException/TypeError/etc.)
  if (err instanceof Error) {
    const base: NormalizedError = {
      name: err.name || "Error",
      message: err.message || "(no message)",
      stack: err.stack,
    };

    // Handle cause chains (Node 16+/modern TS)
    // @ts-ignore - cause may not exist on older libs
    const cause = (err as Record<string, unknown>).cause;
    if (cause) base.cause = normalizeUnknownError(cause);

    // Preserve a few interesting fields if present
    const extras: Record<string, unknown> = {};
    for (const key of ["code", "status", "statusText", "type"]) {
      const v = (err as unknown as Record<string, unknown>)[key];
      if (v !== undefined) extras[key] = v;
    }
    if (Object.keys(extras).length) base.extras = extras;

    // AggregateError: unwrap children
    if (err instanceof AggregateError) {
      base.extras = {
        ...base.extras,
        errors: Array.from(err.errors ?? []).map(normalizeUnknownError),
      };
    }
    return base;
  }

  // Plain object thrown (yes, people do this)
  if (isObject(err)) {
    const name = typeof err.name === "string" ? err.name : "NonErrorObject";
    const message =
      typeof err.message === "string"
        ? err.message
        : safeJsonSummary(err) ?? "(object thrown)";
    const stack = typeof err.stack === "string" ? err.stack : undefined;

    const extras = pick(err, Object.keys(err) as (keyof typeof err)[]);
    // biome-ignore lint/performance/noDelete: <explanation>
    delete (extras as Record<string, unknown>).name;
    // biome-ignore lint/performance/noDelete: <explanation>
    delete (extras as Record<string, unknown>).message;
    // biome-ignore lint/performance/noDelete: <explanation>
    delete (extras as Record<string, unknown>).stack;

    const out: NormalizedError = { name, message, stack };
    if (Object.keys(extras).length) out.extras = extras;
    return out;
  }

  // Primitive thrown: coerce
  return {
    name: "NonError",
    message:
      typeof err === "string"
        ? err
        : err === null
        ? "null thrown"
        : `thrown value: ${String(err)}`,
  };
}

// 5) Optional: a helper that guarantees an Error instance (for throw/reject)
export function ensureError(err: unknown): Error {
  if (err instanceof Error) return err;
  const n = normalizeUnknownError(err);
  const e = new Error(n.message);
  e.name = n.name;
  (e as unknown as Record<string, unknown>).stack = n.stack;
  return e;
}

interface AppError extends Error {
  cause?: NormalizedError;
}

export class ServiceError extends Data.TaggedError("ServiceError")<AppError> {
  static make(e: unknown): ServiceError {
    const normalizedError = normalizeUnknownError(e);
    return new ServiceError({
      name: normalizedError.name,
      message: normalizedError.message,
      cause: normalizedError,
    });
  }
}

export type MacchioError = ServiceError;
