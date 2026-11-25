import { findAdminAccountByEmail, listAdminAccounts } from '../../utils/admin-accounts'
import { requireAdminSession } from '../../utils/auth-session'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  const session = await requireAdminSession(event)

  const [currentAccount, allAccounts] = await Promise.all([
    findAdminAccountByEmail(session.email),
    listAdminAccounts()
  ])

  return {
    success: true,
    current: currentAccount,
    accounts: allAccounts
  }
})
