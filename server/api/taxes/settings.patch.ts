import { requireVerifiedAdmin } from '../../utils/auth-session'
import { appendTaxAuditLog, updateTaxSettings } from '../../utils/tax-admin'

interface UpdateTaxSettingsPayload {
  monthlyTargetAmount?: number | string
  latePenaltyPercentPerMonth?: number | string
  taxOfficeName?: string
}

export default defineEventHandler(async (event) => {
  const admin = await requireVerifiedAdmin(event)
  const body = await readBody<UpdateTaxSettingsPayload>(event)

  const parsedTarget =
    body?.monthlyTargetAmount !== undefined ? Number(body.monthlyTargetAmount) : undefined
  const parsedPenalty =
    body?.latePenaltyPercentPerMonth !== undefined ? Number(body.latePenaltyPercentPerMonth) : undefined

  if (parsedTarget !== undefined && (!Number.isFinite(parsedTarget) || parsedTarget < 100000)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Target anggaran bulanan minimal Rp 100.000.'
    })
  }

  if (parsedPenalty !== undefined && (!Number.isFinite(parsedPenalty) || parsedPenalty < 0 || parsedPenalty > 25)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tarif denda keterlambatan harus antara 0% sampai 25% per bulan.'
    })
  }

  const updated = await updateTaxSettings({
    monthlyTargetAmount: parsedTarget,
    latePenaltyPercentPerMonth: parsedPenalty,
    taxOfficeName: body?.taxOfficeName
  })

  await appendTaxAuditLog({
    action: 'Perubahan Pengaturan Pajak',
    targetName: updated.taxOfficeName,
    detail: `Target bulanan diatur menjadi Rp ${updated.monthlyTargetAmount.toLocaleString('id-ID')} · Denda ${updated.latePenaltyPercentPerMonth}%/bulan.`,
    actor: admin.email
  })

  return {
    success: true,
    message: 'Pengaturan target anggaran dan tarif denda berhasil disimpan.',
    data: updated
  }
})
