/**
 * Studio API client. Adds the bearer token, a request id and idempotency keys for POSTs,
 * and normalises errors to ApiError so callers and toasts get one shape.
 */
import axios, { AxiosError, type AxiosInstance } from 'axios'
import { API_BASE, type ApiErrorBody } from '@platon/definition'
import { auth } from './auth'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorBody['details'] = [],
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get isConflict() {
    return this.status === 409
  }
}

const rid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const http: AxiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}${API_BASE}`,
  timeout: 30_000,
})

http.interceptors.request.use(async (config) => {
  const token = await auth.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Request-Id', rid())
  if (config.method === 'post' && !config.headers.has('Idempotency-Key'))
    config.headers.set('Idempotency-Key', rid())
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiErrorBody>) => {
    if (err.response) {
      const b = err.response.data
      if (err.response.status === 401) auth.onUnauthorized()
      return Promise.reject(
        new ApiError(
          err.response.status,
          b?.error ?? 'http_error',
          b?.message ?? err.message,
          b?.details ?? [],
          b,
        ),
      )
    }
    return Promise.reject(
      new ApiError(0, 'network', 'Can’t reach Platon. Check your connection and try again.'),
    )
  },
)

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}
