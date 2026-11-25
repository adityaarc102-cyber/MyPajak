import { requireVerifiedAdmin } from '../../utils/auth-session'
import { TAX_STATUSES, updateTaxRecord, type TaxStatus } from '../../utils/taxes'

interface UpdateTaxPayload {
  status?: string
  adminNote?: string
  isArchived?: boolean
}

const isValidStatus = (value: string): value is TaxStatus =>
  (TAX_STATUSES as readonly string[]).includes(value)

export default defineEventHandler(async (event) => {
  await requireVerifiedAdmin(event)

  const rawId = getRouterParam(event, 'id')
  const numericId = Number(rawId)

  if (!rawId || !Number.isInteger(numericId) || numericId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID setoran pajak tidak valid.'
    })
  }

  const body = await readBody<UpdateTaxPayload>(event)

  const hasStatus = typeof body?.status === 'string' && body.status.trim().length > 0
  const hasArchive = typeof body?.isArchived === 'boolean'

  if (!hasStatus && !hasArchive) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kirim minimal satu perubahan (status atau isArchived).'
    })
  }

  let nextStatus: TaxStatus | undefined
  if (hasStatus) {
    if (!isValidStatus(body.status!.trim())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status verifikasi pajak tidak valid.'
      })
    }
    nextStatus = body.status!.trim() as TaxStatus

    const note = typeof body?.adminNote === 'string' ? body.adminNote : ''
    if (nextStatus === 'Ditolak' && note.trim().length < 5) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Mohon isi alasan penolakan minimal 5 karakter.'
      })
    }
  }

  const updated = await updateTaxRecord(numericId, {
    status: nextStatus,
    adminNote: typeof body?.adminNote === 'string' ? body.adminNote : undefined,
    isArchived: hasArchive ? body.isArchived : undefined
  })

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Data setoran pajak tidak ditemukan.'
    })
  }

  const actionMsg = hasArchive
    ? updated.isArchived
      ? `Setoran "${updated.merchantName}" berhasil dipindahkan ke Arsip.`
      : `Setoran "${updated.merchantName}" berhasil dipulihkan dari Arsip.`
    : `Status pajak "${updated.merchantName}" diperbarui menjadi ${updated.status}.`

  return {
    success: true,
    message: actionMsg,
    data: updated
  }
})
