/**
 * OIDC (Keycloak) login. With no VITE_OIDC_AUTHORITY configured — local development and the
 * mock backend — the Studio runs with a dev session and no token.
 */
import type { User, UserManager } from 'oidc-client-ts'

const authority = import.meta.env.VITE_OIDC_AUTHORITY
let manager: UserManager | null = null
let user: User | null = null

async function getManager(): Promise<UserManager | null> {
  if (!authority) return null
  if (!manager) {
    const { UserManager, WebStorageStateStore } = await import('oidc-client-ts')
    manager = new UserManager({
      authority,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
      redirect_uri: `${location.origin}/auth/callback`,
      post_logout_redirect_uri: `${location.origin}/signed-out`,
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: sessionStorage }),
    })
  }
  return manager
}

export const auth = {
  enabled: !!authority,
  async init(): Promise<void> {
    const m = await getManager()
    if (!m) return
    if (location.pathname === '/auth/callback') {
      user = await m.signinRedirectCallback()
      history.replaceState(null, '', (user.state as string | undefined) ?? '/')
      return
    }
    user = await m.getUser()
    if (!user || user.expired) await m.signinRedirect({ state: location.pathname + location.search })
  },
  async getToken(): Promise<string | null> {
    if (!authority) return null
    if (user && !user.expired) return user.access_token
    user = (await (await getManager())?.getUser()) ?? null
    return user?.access_token ?? null
  },
  async logout(): Promise<void> {
    const m = await getManager()
    if (m) await m.signoutRedirect()
  },
  onUnauthorized(): void {
    if (authority) void getManager().then((m) => m?.signinRedirect({ state: location.pathname }))
  },
}
