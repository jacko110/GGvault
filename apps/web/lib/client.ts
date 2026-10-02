'use client';
import { ApiError } from './errors';
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/backend${path}`, {
      ...options,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError('SERVICE_UNAVAILABLE', 503);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== 'undefined')
      window.location.assign('/login?expired=1');
    throw new ApiError(data.code ?? 'UNKNOWN', response.status);
  }
  return response.json() as Promise<T>;
}
export const post = <T>(
  path: string,
  body: object = {},
  headers?: Record<string, string>,
) => api<T>(path, { method: 'POST', body: JSON.stringify(body), headers });
