/** Route validation shared by Page settings and the New page dialog. */
import type { Page } from '@platon/definition'

/** Select value for "no parent" (Reka selects can't use an empty string). */
export const TOP = '__top'

export type RouteError = 'slash' | 'chars' | 'taken' | null

export function routeError(
  route: string,
  pages: Page[],
  selfId?: string,
): { code: RouteError; other?: string } {
  if (!route.startsWith('/')) return { code: 'slash' }
  if (!/^\/[a-z0-9\-/:_]*$/.test(route) || /\/\//.test(route)) return { code: 'chars' }
  const other = pages.find((p) => p.id !== selfId && p.route === route)
  return other ? { code: 'taken', other: other.name } : { code: null }
}

/** "Work orders" → "/work-orders" */
export function routeFromName(name: string, parentRoute?: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${parentRoute && parentRoute !== '/' ? parentRoute.replace(/\/$/, '') : ''}/${slug}`
}
