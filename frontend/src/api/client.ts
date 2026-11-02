const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

async function request<T>(method: string, path: string, body?: unknown, opts?: { silent401?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor. Verificá que el backend esté en ejecución.');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: unknown } } | null;
  if (!res.ok) {
    if (res.status === 401 && !opts?.silent401) onUnauthorized?.();
    const details = data?.error?.details;
    const fields = details && typeof details === 'object' ? (details as Record<string, string>) : undefined;
    throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Ocurrió un error inesperado.', fields);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string, opts?: { silent401?: boolean }) => request<T>('GET', path, undefined, opts),
  post: <T,>(path: string, body?: unknown, opts?: { silent401?: boolean }) => request<T>('POST', path, body ?? {}, opts),
  put: <T,>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T,>(path: string) => request<T>('DELETE', path),
};

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
