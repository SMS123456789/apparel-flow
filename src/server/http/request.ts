import "server-only";
import type { z } from "zod";
import { NextResponse } from "next/server";
import {
  AppError,
  AuthorizationError,
  RequestFormatError,
  ValidationError,
} from "./errors";
export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "form";
    (fields[path] ??= []).push(issue.message);
  }
  throw new ValidationError(fields);
}
export function requireOrigin(request: Request) {
  const trusted = process.env.APP_ORIGIN;
  if (!trusted) throw new Error("APP_ORIGIN not configured");
  let configured: URL;
  try {
    configured = new URL(trusted);
  } catch {
    throw new Error("APP_ORIGIN invalid");
  }
  if (
    configured.origin !== trusted ||
    !["http:", "https:"].includes(configured.protocol)
  )
    throw new Error("APP_ORIGIN invalid");
  if (request.headers.get("origin") !== configured.origin)
    throw new AuthorizationError(
      "Use this application's own origin for changes.",
    );
}
export async function readJson(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new RequestFormatError();
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 16384)
    throw new ValidationError();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RequestFormatError();
  }
}
export function queryObject(request: Request) {
  const params = new URL(request.url).searchParams;
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in result) throw new RequestFormatError();
    result[key] = value;
  }
  return result;
}
export async function apiResponse(
  action: (
    headers: Headers,
    requestId: string,
  ) => Promise<{ data: unknown; status?: number }>,
) {
  const requestId = crypto.randomUUID();
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  });
  try {
    const result = await action(headers, requestId);
    return NextResponse.json(
      { data: result.data, meta: { requestId } },
      { status: result.status ?? 200, headers },
    );
  } catch (error) {
    const known = error instanceof AppError;
    if (!known || error.status >= 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId,
          code: known ? error.code : "INTERNAL_ERROR",
        }),
      );
    return NextResponse.json(
      {
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message: known
            ? error.message
            : "An unexpected server error occurred.",
          ...(known && error.violations
            ? { violations: error.violations }
            : {}),
          ...(known && error.fieldErrors
            ? { fieldErrors: error.fieldErrors }
            : {}),
        },
        meta: { requestId },
      },
      { status: known ? error.status : 500, headers },
    );
  }
}
