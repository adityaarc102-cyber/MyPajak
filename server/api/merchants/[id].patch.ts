import { requireVerifiedAdmin } from '../../utils/auth-session'
import { updateMerchantFlags } from '../../utils/merchants'

interface PatchMerchantPayload {
  isVerified?: boolean
  isOpen?: boolean
}

export default defineEventHandler(async (event) => {
  await requireVerifiedAdmin(event)

  const rawId = getRouterParam(event, 'id')
  const numericId = Number(rawId)

  if (!rawId || !Number.isInteger(numericId) || numericId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID mitra UMKM tidak valid.'
    })
  }

  const body = await readBody<PatchMerchantPayload>(event)

  if (typeof body?.isVerified !== 'boolean' && typeof body?.isOpen !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Minimal satu status (isVerified atau isOpen) harus dikirim.'
    })
  }

  const updated = await updateMerchantFlags(numericId, {
    isVerified: body.isVerified,
    isOpen: body.isOpen
  })

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Mitra UMKM tidak ditemukan.'
    })
  }

  return {
    success: true,
    message: `Status mitra "${updated.name}" berhasil diperbarui.`,
    data: updated
  }
})
