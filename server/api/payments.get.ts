import { getPayments } from '../utils/payments'

export default defineEventHandler(async () => {
  const items = await getPayments()
  const totalVolume = items.reduce((sum, tx) => sum + tx.totalPaid, 0)

  return {
    success: true,
    total: items.length,
    totalVolume,
    data: items
  }
})
