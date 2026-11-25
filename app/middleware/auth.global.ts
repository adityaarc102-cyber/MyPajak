interface AuthMeResponse {
  authenticated: boolean
  user: {
    name: string
    email: string
    role: string
    profileCompleted?: boolean
    adminVerified?: boolean
  } | null
}

export default defineNuxtRouteMiddleware(async (to) => {
  const fetchWithCookies = useRequestFetch()

  let auth: AuthMeResponse = { authenticated: false, user: null }
  try {
    auth = await fetchWithCookies<AuthMeResponse>('/api/auth/me', {
      headers: { 'cache-control': 'no-cache' }
    })
  } catch {
    auth = { authenticated: false, user: null }
  }

  // Halaman pendaftaran & biodata khusus Admin Pajak selalu dapat dibuka (untuk buat akun baru atau kelola biodata)
  if (to.path === '/verifikasi-admin') {
    return
  }

  // Halaman login: jika sudah masuk sebagai Admin Pajak, arahkan sesuai status biodata
  if (to.path === '/login') {
    if (auth.authenticated && auth.user?.role === 'admin_pajak') {
      if (!auth.user.profileCompleted) {
        return navigateTo('/verifikasi-admin?setup=1')
      }
      return navigateTo('/')
    }
    return
  }

  // Semua halaman website wajib login akun Admin Pajak terlebih dahulu
  if (!auth.authenticated || auth.user?.role !== 'admin_pajak') {
    return navigateTo({
      path: '/login',
      query: to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
    })
  }

  // Panel Admin Pajak mewajibkan biodata akun admin sudah dilengkapi & disimpan
  if (to.path.startsWith('/admin-pajak') && !auth.user?.profileCompleted) {
    return navigateTo({
      path: '/verifikasi-admin',
      query: { setup: '1' }
    })
  }
})
