import { requireVerifiedAdmin } from '../../utils/auth-session'
import { getTaxAuditLogs } from '../../utils/tax-admin'

export default defineEventHandler(async (event) => {
  await requireVerifiedAdmin(event)
  const logs = await getTaxAuditLogs()
  return {
    success: true,
    total: logs.length,
    data: logs
  }
})
