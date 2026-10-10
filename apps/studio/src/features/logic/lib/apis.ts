/** API protocol helpers: labels, status codes per protocol, example payloads (requirements §3.3 APIs). */
import {
  exampleOf,
  pascal,
  pathParams,
  type Api,
  type ApiResponse,
  type TypedField,
} from '@platon/definition'
import type { Tone } from '@platon/ui'

export type Protocol = Api['protocol']

export const PROTOCOLS: Record<Protocol, { label: string; desc: string; icon: string }> = {
  rest: { label: 'REST', desc: 'HTTP verbs + JSON', icon: 'globe' },
  soap: { label: 'SOAP', desc: 'XML envelope · WSDL', icon: 'file-code' },
  grpc: { label: 'gRPC', desc: 'Protobuf over HTTP/2', icon: 'zap' },
  jsonrpc: { label: 'JSON-RPC', desc: 'JSON-RPC 2.0 over HTTP', icon: 'braces' },
}

export const PROTO_CODES: Record<Protocol, string[]> = {
  rest: ['200', '400', '401', '403', '500'],
  soap: ['Response', 'Fault'],
  grpc: ['OK', 'INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'INTERNAL'],
  jsonrpc: ['result', '-32602', '-32001', '-32603'],
}

export const CODE_DESC: Record<string, string> = {
  '200': 'Success',
  '400': 'Validation failed',
  '401': 'Missing or invalid credentials',
  '403': 'Caller lacks the role or permission',
  '500': 'A function failed',
  Response: 'Successful SOAP response',
  Fault: 'SOAP Fault · returned for any error',
  OK: 'Call succeeded · status 0',
  INVALID_ARGUMENT: 'Validation failed · status 3',
  UNAUTHENTICATED: 'Missing or invalid credentials · status 16',
  PERMISSION_DENIED: 'Caller lacks the role or permission · status 7',
  INTERNAL: 'A function failed · status 13',
  result: 'Success · returned in "result"',
  '-32602': 'Invalid params',
  '-32001': 'Unauthorized · server-defined error',
  '-32603': 'Internal error',
}

export const PROTO_CT: Record<Protocol, string> = {
  rest: 'application/json',
  soap: 'text/xml; charset=utf-8',
  grpc: 'application/grpc+proto',
  jsonrpc: 'application/json',
}

export const REST_CTS = [
  'application/json',
  'multipart/form-data',
  'application/x-www-form-urlencoded',
  'text/plain',
]

export const METHOD_TONE: Record<Api['method'], Tone> = {
  GET: 'ok',
  POST: 'primary',
  PUT: 'warn',
  PATCH: 'warn',
  DELETE: 'danger',
}

/** Badge + text shown in lists and headers, e.g. ["GET", "/api/work-orders"] or ["SOAP", "Svc.Op"]. */
export function apiLabel(a: Pick<Api, 'protocol' | 'method' | 'path' | 'service' | 'operation'>): {
  badge: string
  text: string
  tone: Tone
} {
  if (a.protocol === 'soap')
    return { badge: 'SOAP', text: `${a.service || 'Service'}.${a.operation || 'Operation'}`, tone: 'purple' }
  if (a.protocol === 'grpc')
    return { badge: 'gRPC', text: `${a.service || 'Service'}/${a.operation || 'Method'}`, tone: 'teal' }
  if (a.protocol === 'jsonrpc') return { badge: 'RPC', text: a.operation || 'method', tone: 'info' }
  return { badge: a.method, text: a.path, tone: METHOD_TONE[a.method] }
}

export function apiTitle(a: Api): string {
  const l = apiLabel(a)
  return a.name || `${l.badge} ${l.text}`
}

export function accessLabel(a: Pick<Api, 'access'>): string {
  const x = a.access
  if (x.type === 'public') return 'Public'
  const t = x.type === 'basic' ? 'Basic auth' : 'Token'
  if (x.who !== 'roles') return `${t} · anyone ${x.type === 'basic' ? 'with valid credentials' : 'signed in'}`
  const l = [...(x.roles ?? []), ...(x.perms ?? [])]
  return `${t} · ${l.length ? l.join(', ') : 'no roles yet'}`
}

const F = (name: string, type: string, req = true): TypedField => ({ name, type, req })

export function errorResponse(p: Protocol, code: string): ApiResponse {
  const ct = PROTO_CT[p]
  if (p === 'soap')
    return {
      contentType: ct,
      fields: [F('faultcode', 'string'), F('faultstring', 'string'), F('detail', 'string', false)],
    }
  if (p === 'grpc')
    return {
      contentType: ct,
      fields: [F('code', 'integer'), F('message', 'string'), F('details', 'array<string>', false)],
    }
  if (p === 'jsonrpc')
    return {
      contentType: ct,
      fields: [F('code', 'integer'), F('message', 'string'), F('data', 'string', false)],
    }
  if (code === '400')
    return { contentType: ct, fields: [F('error', 'string'), F('missing', 'array<string>')] }
  if (code === '500') return { contentType: ct, fields: [F('error', 'string'), F('message', 'string')] }
  return { contentType: ct, fields: [F('error', 'string')] }
}

/**
 * Switch an API to another protocol, keeping its inputs and success fields: everything the
 * caller sends moves to the body (path/query only exist in REST), error shapes follow the protocol.
 */
export function convertProtocol(a: Api, to: Protocol): Api {
  if (a.protocol === to) return a
  const okFields = a.responses[PROTO_CODES[a.protocol][0]!]?.fields ?? []
  const inputs = [...a.request.path, ...a.request.query, ...a.request.body]
  const responses: Api['responses'] = {}
  PROTO_CODES[to].forEach(
    (code, i) =>
      (responses[code] = i === 0 ? { contentType: PROTO_CT[to], fields: okFields } : errorResponse(to, code)),
  )
  const name = pascal(a.id)
  const next: Api = {
    ...a,
    protocol: to,
    method: to === 'rest' ? a.method : 'POST',
    request: {
      contentType: PROTO_CT[to],
      headers: a.request.headers,
      path: to === 'rest' ? a.request.path : [],
      query: [],
      body: to === 'rest' ? [...a.request.query, ...a.request.body] : inputs,
    },
    responses,
  }
  if (to === 'rest') {
    next.path = a.protocol === 'rest' ? a.path : `/api/${a.id.replace(/_/g, '-')}`
    next.request.path = pathParams(next.path).map((n) => F(n, 'string'))
    next.request.body = inputs.filter((f) => !next.request.path.some((p) => p.name === f.name))
    if (next.method === 'GET' || next.method === 'DELETE') {
      next.request.query = next.request.body
      next.request.body = []
    }
  }
  if (to === 'soap') {
    next.service = a.service || 'Service'
    next.operation = a.operation || name
    next.path = `/soap/${a.id.replace(/_/g, '-')}`
  }
  if (to === 'grpc') {
    next.service = a.service?.includes('.') ? a.service : `app.v1.${a.service || 'Service'}`
    next.operation = a.operation || name
    next.path = `/${next.service}/${next.operation}`
  }
  if (to === 'jsonrpc') {
    next.operation = a.operation || name.charAt(0).toLowerCase() + name.slice(1)
    next.path = '/rpc'
  }
  return next
}

/** Keep `request.path` in sync with `:params` in the REST path (path params are always required). */
export function syncPathParams(a: Api): Api {
  if (a.protocol !== 'rest') return a
  const names = pathParams(a.path)
  const current = a.request.path
  if (names.length === current.length && names.every((n, i) => current[i]?.name === n)) return a
  return {
    ...a,
    request: {
      ...a.request,
      path: names.map((n) => ({ ...(current.find((f) => f.name === n) ?? F(n, 'string')), req: true })),
    },
  }
}

export function soapEnvelope(lines: string[], header: string[] = []): string {
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"',
    '    xmlns:tns="urn:app:v1">',
  ]
  if (header.length) out.push('  <soap:Header>', ...header.map((l) => `    ${l}`), '  </soap:Header>')
  out.push('  <soap:Body>', ...lines.map((l) => `    ${l}`), '  </soap:Body>', '</soap:Envelope>')
  return out.join('\n')
}

function xmlOf(fields: TypedField[], indent = ''): string[] {
  const ex = exampleOf(fields)
  return fields.flatMap((f) => {
    if ((f.type === 'object' || f.type === 'array<object>') && f.fields?.length)
      return [`${indent}<tns:${f.name}>`, ...xmlOf(f.fields, `${indent}  `), `${indent}</tns:${f.name}>`]
    return [
      `${indent}<tns:${f.name}>${String(JSON.stringify(ex[f.name])).replace(/^"|"$/g, '')}</tns:${f.name}>`,
    ]
  })
}

export function soapExample(element: string, fields: TypedField[]): string {
  return soapEnvelope([`<tns:${element}>`, ...xmlOf(fields, '  '), `</tns:${element}>`])
}

const PB: Record<string, string> = {
  string: 'string',
  number: 'double',
  integer: 'int64',
  boolean: 'bool',
  date: 'string',
  datetime: 'google.protobuf.Timestamp',
  enum: 'string',
  file: 'bytes',
  'array<string>': 'repeated string',
  'array<number>': 'repeated double',
  any: 'google.protobuf.Any',
}

export function protoMessage(name: string, fields: TypedField[]): string[] {
  const out = [`message ${name} {`]
  const nested: string[] = []
  fields.forEach((f, i) => {
    let ty = PB[f.type] ?? 'string'
    if (f.type === 'object' || f.type === 'array<object>') {
      const nm = pascal(f.name)
      nested.push(...protoMessage(nm, f.fields ?? []).map((l) => `  ${l}`))
      ty = `${f.type === 'array<object>' ? 'repeated ' : ''}${nm}`
    } else if (!f.req && !ty.startsWith('repeated')) ty = `optional ${ty}`
    out.push(`  ${ty} ${f.name} = ${i + 1};`)
  })
  return [...out, ...nested, '}']
}

/** Example request/response text for the selected protocol. */
export function payloadExample(
  p: Protocol,
  fields: TypedField[],
  kind: 'request' | 'response',
  a: Pick<Api, 'operation'>,
  code?: string,
): string {
  const op = a.operation || 'Operation'
  if (p === 'soap')
    return soapExample(kind === 'request' ? op : code === 'Fault' ? 'soap:Fault' : `${op}Response`, fields)
  if (p === 'grpc')
    return protoMessage(
      `${op}${kind === 'request' ? 'Request' : code === 'OK' || !code ? 'Response' : 'Error'}`,
      fields,
    ).join('\n')
  if (p === 'jsonrpc') {
    if (kind === 'request')
      return JSON.stringify({ jsonrpc: '2.0', method: op, params: exampleOf(fields), id: 1 }, null, 2)
    return JSON.stringify(
      code === 'result' || !code
        ? { jsonrpc: '2.0', result: exampleOf(fields), id: 1 }
        : { jsonrpc: '2.0', error: exampleOf(fields), id: 1 },
      null,
      2,
    )
  }
  return JSON.stringify(exampleOf(fields), null, 2)
}
