import { authenticateAdminAccount } from '../../utils/admin-accounts'
import { buildAdminSessionUser, setSignedSessionCookie } from '../../utils/auth-session'

interface LoginPayload {
  username?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginPayload>(event)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password.trim() : ''

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email / NIP Admin dan kata sandi wajib diisi.'
    })
  }

  const account = await authenticateAdminAccount(username, password)

  if (!account) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Akun Admin Pajak atau kata sandi tidak sesuai. Belum punya akun? Silakan buat akun admin.'
    })
  }

  const sessionUser = buildAdminSessionUser(account)
  await setSignedSessionCookie(event, sessionUser)

  return {
    success: true,
    requiresProfileSetup: !account.profileCompleted,
    message: account.profileCompleted
      ? `Selamat datang kembali, ${account.fullName}.`
      : 'Login berhasil! Lengkapi biodata akun Admin Pajak Anda terlebih dahulu.',
    user: sessionUser
  }
})
