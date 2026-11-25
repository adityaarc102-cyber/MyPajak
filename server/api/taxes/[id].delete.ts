import { requireVerifiedAdmin } from '../../utils/auth-session'
import { deleteTaxRecordById } from '../../utils/taxes'

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

  const deleted = await deleteTaxRecordById(numericId)

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Data setoran pajak tidak ditemukan.'
    })
  }

  return {
    success: true,
    message: `Data pajak "${deleted.merchantName}" berhasil dihapus.`,
    data: deleted
  }
})
