import { updateReminderStatus, type ReminderStatus } from '../../utils/reminders'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  const numericId = Number(rawId)
  if (!rawId || !Number.isInteger(numericId) || numericId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID pengingat tidak valid.' })
  }

  const body = await readBody<{ status?: string }>(event)
  const nextStatus: ReminderStatus = body?.status === 'Aktif' ? 'Aktif' : 'Selesai'

  const updated = await updateReminderStatus(numericId, nextStatus)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Pengingat tidak ditemukan.' })
  }

  return {
    success: true,
    message: `Pengingat "${updated.title}" ditandai ${updated.status}.`,
    data: updated
  }
})
