import { getTaxSettings } from '../utils/tax-admin'
import { getMonthlyBudgetSummary, getTaxRecords } from '../utils/taxes'

export default defineEventHandler(async () => {
  const [records, monthlyBudget, settings] = await Promise.all([
    getTaxRecords(),
    getMonthlyBudgetSummary(),
    getTaxSettings()
  ])
  const activeRecords = records.filter((item) => !item.isArchived)
  const archivedRecords = records.filter((item) => item.isArchived)

  const verifiedRecords = records.filter((item) => item.status === 'Terverifikasi (Lunas)')
  const pendingRecords = activeRecords.filter((item) => item.status === 'Menunggu Verifikasi')
  const rejectedRecords = activeRecords.filter((item) => item.status === 'Ditolak')

  const totalCollected = verifiedRecords.reduce((sum, item) => sum + item.taxAmount, 0)
  const pendingAmount = pendingRecords.reduce((sum, item) => sum + item.taxAmount, 0)
  const currentMonthBudget = monthlyBudget[monthlyBudget.length - 1] ?? null

  return {
    success: true,
    total: records.length,
    summary: {
      totalCollected,
      pendingAmount,
      totalCount: activeRecords.length,
      archivedCount: archivedRecords.length,
      verifiedCount: verifiedRecords.length,
      pendingCount: pendingRecords.length,
      rejectedCount: rejectedRecords.length,
      currentMonthCollected: currentMonthBudget?.collectedAmount ?? 0,
      currentMonthTarget: currentMonthBudget?.targetAmount ?? settings.monthlyTargetAmount,
      currentMonthLabel: currentMonthBudget?.label ?? '-'
    },
    monthlyBudget,
    data: records
  }
})
