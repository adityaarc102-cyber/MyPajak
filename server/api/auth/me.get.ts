import { readSignedSession } from '../../utils/auth-session'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setHeader(event, 'Pragma', 'no-cache')

  const user = await readSignedSession(event)

  if (!user) {
    return {
      authenticated: false,
      user: null
    }
  }

  return {
    authenticated: true,
    user
  }
})
