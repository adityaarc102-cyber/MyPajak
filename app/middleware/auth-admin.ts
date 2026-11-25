interface AuthMeResponse {
  authenticated: boolean
  user: {
    role: string
    profileCompleted?: boolean
  } | null
}

export default defineNuxtRouteMiddleware(async (to) => {
  const fetchWithCookies = useRequestFetch()

  try {
    const res = await fetchWithCookies<AuthMeResponse>('/api/auth/me', {
      headers: { 'cache-control': 'no-cache' }
    })
    if (!res?.authenticated || res.user?.role !== 'admin_pajak') {
      return navigateTo({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    }
    if (!res.user?.profileCompleted) {
      return navigateTo({
        path: '/verifikasi-admin',
        query: { setup: '1' }
      })
    }
  } catch {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
