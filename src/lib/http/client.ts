"use client";
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    cache: "no-store",
    credentials: "same-origin",
    ...(options.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }),
  });
  const result = (await response.json()) as {
    data?: T;
    error?: { message: string; fieldErrors?: Record<string, string[]> };
  };
  if (!response.ok || result.error)
    throw new ApiClientError(
      result.error?.message ?? "The request could not be completed.",
      response.status,
      result.error?.fieldErrors,
    );
  return result.data as T;
}
