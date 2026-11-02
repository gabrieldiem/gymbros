/** Typed fetch client. Every API call in the app goes through here; components never call fetch. */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const TIMEOUT_MS = 15_000;
const FILE_TIMEOUT_MS = 60_000;

/** A gym with one bar of signal can leave a request hanging: give up, so saving can carry on. */
function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal | null {
  if (typeof AbortSignal.timeout !== 'function') return signal ?? null;
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

/** True when the request never got an answer from the server, so it's worth trying again. */
export function isConnectionError(error: unknown): boolean {
  return !(error instanceof ApiError);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as it is, for an uploaded file. */
  file?: Blob;
  signal?: AbortSignal | undefined;
};

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Request `/api{path}` on the same origin (Vite or nginx proxies it), with the session cookie. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: withTimeout(options.signal, options.file ? FILE_TIMEOUT_MS : TIMEOUT_MS),
  };
  if (options.body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }
  if (options.file) {
    init.headers = { ...init.headers, 'Content-Type': options.file.type };
    init.body = options.file;
  }
  const response = await fetch(`/api${path}`, init);
  const body = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}
