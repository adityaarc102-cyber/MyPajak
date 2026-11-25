import { getReminders } from '../utils/reminders'

export default defineEventHandler(async () => {
  const items = await getReminders()
  const activeItems = items.filter((r) => r.status === 'Aktif')
  const activeTotalAmount = activeItems.reduce((sum, r) => sum + r.amount, 0)

  return {
    success: true,
    total: items.length,
    activeCount: activeItems.length,
    activeTotalAmount,
    data: items
  }
})
