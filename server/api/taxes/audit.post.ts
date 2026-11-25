import { requireVerifiedAdmin } from '../../utils/auth-session'
import { appendTaxAuditLog } from '../../utils/tax-admin'

interface CreateAuditPayload {
  action?: string
  targetName?: string
  detail?: string
  actor?: string
}

export default defineEventHandler(async (event) => {
  const admin = await requireVerifiedAdmin(event)
  const body = await readBody<CreateAuditPayload>(event)

  if (typeof body?.action !== 'string' || body.action.trim().length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Jenis aktivitas wajib diisi.' })
  }

  const created = await appendTaxAuditLog({
    action: body.action.trim(),
    targetName: typeof body?.targetName === 'string' && body.targetName.trim() ? body.targetName.trim() : 'Wajib Pajak',
    detail: typeof body?.detail === 'string' ? body.detail.trim() : '',
    actor: admin.email
  })

  return {
    success: true,
    data: created
  }
})
