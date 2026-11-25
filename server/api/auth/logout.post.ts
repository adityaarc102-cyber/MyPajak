import { clearSignedSessionCookie } from '../../utils/auth-session'

export default defineEventHandler((event) => {
  clearSignedSessionCookie(event)

  return {
    success: true,
    message: 'Anda telah keluar dari MyPajak.'
  }
})
