import { addMerchantReview } from '../../../utils/merchants'

interface CreateReviewPayload {
  reviewerName?: string
  rating?: number | string
  comment?: string
}

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  const numericId = Number(rawId)

  if (!rawId || !Number.isInteger(numericId) || numericId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID mitra UMKM tidak valid.'
    })
  }

  const body = await readBody<CreateReviewPayload>(event)

  if (typeof body?.reviewerName !== 'string' || body.reviewerName.trim().length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama pengulas minimal 2 karakter.'
    })
  }

  const parsedRating = Number(body?.rating)
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Rating harus berupa angka bulat antara 1 sampai 5.'
    })
  }

  if (typeof body?.comment !== 'string' || body.comment.trim().length < 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ulasan minimal 5 karakter.'
    })
  }

  const result = await addMerchantReview(numericId, {
    reviewerName: body.reviewerName,
    rating: parsedRating,
    comment: body.comment
  })

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Mitra UMKM tidak ditemukan.'
    })
  }

  return {
    success: true,
    message: 'Terima kasih! Ulasan Anda berhasil ditambahkan.',
    data: result
  }
})
