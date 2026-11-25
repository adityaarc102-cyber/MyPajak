import { deleteReminderById } from '../../utils/reminders'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  const numericId = Number(rawId)
  if (!rawId || !Number.isInteger(numericId) || numericId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID pengingat tidak valid.' })
  }

  const deleted = await deleteReminderById(numericId)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Pengingat tidak ditemukan.' })
  }

  return {
    success: true,
    message: `Pengingat "${deleted.title}" dihapus.`,
    data: deleted
  }
})
