import { readCollection, writeCollection } from './db'
import { appendTaxAuditLog, getTaxSettings } from './tax-admin'

export type TaxType =
  | 'PPh Final UMKM (0,5%)'
  | 'Pajak Daerah / Restoran (PB1 10%)'
  | 'Retribusi Daerah'

export type TaxStatus =
  | 'Menunggu Verifikasi'
  | 'Terverifikasi (Lunas)'
  | 'Ditolak'

export type PaymentMethod =
  | 'QRIS'
  | 'Virtual Account BCA'
  | 'Virtual Account BRI'
  | 'Virtual Account Mandiri'
  | 'Transfer Bank'

export interface TaxRecord {
  id: number
  billingCode: string
  ntpn: string | null
  merchantId: number | null
  merchantName: string
  district: string
  npwp: string
  taxType: TaxType
  period: string
  grossRevenue: number
  taxRatePercent: number
  taxAmount: number
  paymentMethod: PaymentMethod
  status: TaxStatus
  adminNote: string
  isArchived: boolean
  archivedAt: string | null
  submittedAt: string
  verifiedAt: string | null
}

export interface MonthlyBudgetItem {
  period: string
  label: string
  targetAmount: number
  collectedAmount: number
  pendingAmount: number
  transactionCount: number
  achievementPercent: number
}

export const TAX_TYPES: readonly TaxType[] = [
  'PPh Final UMKM (0,5%)',
  'Pajak Daerah / Restoran (PB1 10%)',
  'Retribusi Daerah'
] as const

export const TAX_STATUSES: readonly TaxStatus[] = [
  'Menunggu Verifikasi',
  'Terverifikasi (Lunas)',
  'Ditolak'
] as const

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'QRIS',
  'Virtual Account BCA',
  'Virtual Account BRI',
  'Virtual Account Mandiri',
  'Transfer Bank'
] as const

export const MONTHLY_BUDGET_TARGET = 4000000

export function getTaxRatePercent(taxType: TaxType): number {
  if (taxType === 'PPh Final UMKM (0,5%)') return 0.5
  if (taxType === 'Pajak Daerah / Restoran (PB1 10%)') return 10
  return 0
}

export function generateBillingCode(): string {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
  return `026${digits}`
}

export function generateNtpn(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const initialTaxRecords: TaxRecord[] = [
  // Arsip bulan-bulan sebelumnya (untuk fitur Arsip + Anggaran Bulanan)
  {
    id: 1998,
    billingCode: '026082348112001',
    ntpn: 'A7B2C9D4E6F8H3J5',
    merchantId: 5,
    merchantName: 'Rumah Makan Sunda Mang Ujang',
    district: 'Kec. Sukajadi',
    npwp: '3273051103870002',
    taxType: 'Pajak Daerah / Restoran (PB1 10%)',
    period: '2026-08',
    grossRevenue: 19500000,
    taxRatePercent: 10,
    taxAmount: 1950000,
    paymentMethod: 'Virtual Account Mandiri',
    status: 'Terverifikasi (Lunas)',
    adminNote: 'Diarsipkan setelah rekonsiliasi bulan Agustus 2026.',
    isArchived: true,
    archivedAt: '2026-09-02T10:00:00.000Z',
    submittedAt: '2026-08-27T09:00:00.000Z',
    verifiedAt: '2026-08-27T11:30:00.000Z'
  },
  {
    id: 1999,
    billingCode: '026092348224019',
    ntpn: 'M3N5P7Q9R2S4T6V8',
    merchantId: 3,
    merchantName: 'Dapur Bu Sari — Rumah Makan & Katering',
    district: 'Kec. Coblong',
    npwp: '3273022204880001',
    taxType: 'Pajak Daerah / Restoran (PB1 10%)',
    period: '2026-09',
    grossRevenue: 22000000,
    taxRatePercent: 10,
    taxAmount: 2200000,
    paymentMethod: 'Virtual Account BCA',
    status: 'Terverifikasi (Lunas)',
    adminNote: 'Diarsipkan setelah tutup buku September 2026.',
    isArchived: true,
    archivedAt: '2026-10-03T08:45:00.000Z',
    submittedAt: '2026-09-26T13:10:00.000Z',
    verifiedAt: '2026-09-26T15:00:00.000Z'
  },
  {
    id: 2000,
    billingCode: '026092399114502',
    ntpn: 'W4X6Y8Z2B4C6D8F2',
    merchantId: 6,
    merchantName: 'Warung Bakso & Mie Ayam Mas Hendra',
    district: 'Kec. Cicendo',
    npwp: '3273061807910005',
    taxType: 'Pajak Daerah / Restoran (PB1 10%)',
    period: '2026-09',
    grossRevenue: 8200000,
    taxRatePercent: 10,
    taxAmount: 820000,
    paymentMethod: 'QRIS',
    status: 'Terverifikasi (Lunas)',
    adminNote: 'Setoran PB1 bulan September lengkap.',
    isArchived: true,
    archivedAt: '2026-10-03T08:50:00.000Z',
    submittedAt: '2026-09-28T10:15:00.000Z',
    verifiedAt: '2026-09-28T11:20:00.000Z'
  },
  // Setoran aktif (Oktober & November 2026)
  {
    id: 2001,
    billingCode: '026112348291045',
    ntpn: 'K8M4P2R9X7V3Q5N2',
    merchantId: 1,
    merchantName: 'Berkah Teknik AC & Kelistrikan',
    district: 'Kec. Sukajadi',
    npwp: '3273011508920004',
    taxType: 'PPh Final UMKM (0,5%)',
    period: '2026-10',
    grossRevenue: 18500000,
    taxRatePercent: 0.5,
    taxAmount: 92500,
    paymentMethod: 'QRIS',
    status: 'Terverifikasi (Lunas)',
    adminNote: 'Pembayaran sesuai mutasi kas daerah.',
    isArchived: false,
    archivedAt: null,
    submittedAt: '2026-10-25T08:30:00.000Z',
    verifiedAt: '2026-10-25T09:15:00.000Z'
  },
  {
    id: 2002,
    billingCode: '026112399104821',
    ntpn: 'D4H9W6T2B8J5L3C7',
    merchantId: 3,
    merchantName: 'Dapur Bu Sari — Rumah Makan & Katering',
    district: 'Kec. Coblong',
    npwp: '3273022204880001',
    taxType: 'Pajak Daerah / Restoran (PB1 10%)',
    period: '2026-10',
    grossRevenue: 24000000,
    taxRatePercent: 10,
    taxAmount: 2400000,
    paymentMethod: 'Virtual Account BCA',
    status: 'Terverifikasi (Lunas)',
    adminNote: 'Laporan omzet & setoran PB1 terkonfirmasi.',
    isArchived: false,
    archivedAt: null,
    submittedAt: '2026-10-28T11:20:00.000Z',
    verifiedAt: '2026-10-28T13:42:00.000Z'
  },
  {
    id: 2005,
    billingCode: '026112388201944',
    ntpn: 'G5J7K9L2M4N6P8R3',
    merchantId: 5,
    merchantName: 'Rumah Makan Sunda Mang Ujang',
    district: 'Kec. Sukajadi',
    npwp: '3273051103870002',
    taxType: 'Pajak Daerah / Restoran (PB1 10%)',
    period: '2026-11',
    grossRevenue: 17500000,
    taxRatePercent: 10,
    taxAmount: 1750000,
    paymentMethod: 'Virtual Account Mandiri',
    status: 'Terverifikasi (Lunas)',
    adminNote: 'Setoran termin pertama November lunas.',
    isArchived: false,
    archivedAt: null,
    submittedAt: '2026-11-18T10:15:00.000Z',
    verifiedAt: '2026-11-18T11:00:00.000Z'
  },
  {
    id: 2003,
    billingCode: '026112377451209',
    ntpn: null,
    merchantId: 2,
    merchantName: 'Print Cepat Nusantara & Fotokopi',
    district: 'Kec. Cicendo',
    npwp: '3273031001900008',
    taxType: 'PPh Final UMKM (0,5%)',
    period: '2026-11',
    grossRevenue: 14200000,
    taxRatePercent: 0.5,
    taxAmount: 71000,
    paymentMethod: 'Virtual Account BRI',
    status: 'Menunggu Verifikasi',
    adminNote: '',
    isArchived: false,
    archivedAt: null,
    submittedAt: '2026-11-22T07:10:00.000Z',
    verifiedAt: null
  },
  {
    id: 2004,
    billingCode: '026112366820314',
    ntpn: null,
    merchantId: 4,
    merchantName: 'Bengkel Motor Mas Joko 24 Jam',
    district: 'Kec. Antapani',
    npwp: '3273041905850003',
    taxType: 'Retribusi Daerah',
    period: '2026-11',
    grossRevenue: 0,
    taxRatePercent: 0,
    taxAmount: 50000,
    paymentMethod: 'Transfer Bank',
    status: 'Ditolak',
    adminNote: 'Nominal bukti transfer belum terbaca, mohon input ulang.',
    isArchived: false,
    archivedAt: null,
    submittedAt: '2026-11-20T14:05:00.000Z',
    verifiedAt: null
  }
]

const TAXES_KEY = 'taxes.json'

export async function getTaxRecords(): Promise<TaxRecord[]> {
  const list = await readCollection<TaxRecord>(TAXES_KEY, initialTaxRecords)
  return [...list].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )
}

export async function getMonthlyBudgetSummary(): Promise<MonthlyBudgetItem[]> {
  const [list, settings] = await Promise.all([
    readCollection<TaxRecord>(TAXES_KEY, initialTaxRecords),
    getTaxSettings()
  ])
  const targetAmount = settings.monthlyTargetAmount || MONTHLY_BUDGET_TARGET
  const periodMap = new Map<string, { collected: number; pending: number; count: number }>()

  for (const r of list) {
    const existing = periodMap.get(r.period) ?? { collected: 0, pending: 0, count: 0 }
    existing.count += 1
    if (r.status === 'Terverifikasi (Lunas)') {
      existing.collected += r.taxAmount
    } else if (r.status === 'Menunggu Verifikasi') {
      existing.pending += r.taxAmount
    }
    periodMap.set(r.period, existing)
  }

  return Array.from(periodMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, stats]) => {
      const [y, m] = period.split('-')
      const label = new Intl.DateTimeFormat('id-ID', {
        month: 'long',
        year: 'numeric'
      }).format(new Date(Number(y), Number(m) - 1, 1))

      return {
        period,
        label,
        targetAmount,
        collectedAmount: stats.collected,
        pendingAmount: stats.pending,
        transactionCount: stats.count,
        achievementPercent: Math.min(100, Math.round((stats.collected / targetAmount) * 100))
      }
    })
}

export async function addTaxRecord(record: TaxRecord): Promise<TaxRecord> {
  const list = await readCollection<TaxRecord>(TAXES_KEY, initialTaxRecords)
  list.unshift(record)
  await writeCollection(TAXES_KEY, list)
  await appendTaxAuditLog({
    action: 'Catat Setoran Pajak',
    targetName: record.merchantName,
    detail: `${record.taxType} (${record.period}) sebesar Rp ${record.taxAmount.toLocaleString('id-ID')} · Billing ${record.billingCode}`,
    actor: 'admin@mypajak.id'
  })
  return record
}

export async function updateTaxRecord(
  id: number,
  updates: { status?: TaxStatus; adminNote?: string; isArchived?: boolean }
): Promise<TaxRecord | null> {
  const list = await readCollection<TaxRecord>(TAXES_KEY, initialTaxRecords)
  const target = list.find((item) => item.id === id)
  if (!target) return null

  if (typeof updates.adminNote === 'string') {
    target.adminNote = updates.adminNote.trim()
  }

  if (updates.status) {
    target.status = updates.status
    if (updates.status === 'Terverifikasi (Lunas)') {
      target.ntpn = target.ntpn || generateNtpn()
      target.verifiedAt = new Date().toISOString()
    } else {
      target.verifiedAt = null
      if (updates.status === 'Ditolak') {
        target.ntpn = null
      }
    }
  }

  if (typeof updates.isArchived === 'boolean') {
    target.isArchived = updates.isArchived
    target.archivedAt = updates.isArchived ? new Date().toISOString() : null
  }

  await writeCollection(TAXES_KEY, list)

  const actionLabel =
    typeof updates.isArchived === 'boolean'
      ? updates.isArchived
        ? 'Arsip Setoran'
        : 'Pulihkan dari Arsip'
      : updates.status === 'Terverifikasi (Lunas)'
        ? 'Verifikasi & Terbit NTPN'
        : 'Penolakan Setoran'

  await appendTaxAuditLog({
    action: actionLabel,
    targetName: target.merchantName,
    detail: `Masa ${target.period} · Rp ${target.taxAmount.toLocaleString('id-ID')}${target.ntpn ? ` · NTPN ${target.ntpn}` : ''}${target.adminNote ? ` · ${target.adminNote}` : ''}`,
    actor: 'admin@mypajak.id'
  })

  return target
}

export async function deleteTaxRecordById(id: number): Promise<TaxRecord | null> {
  const list = await readCollection<TaxRecord>(TAXES_KEY, initialTaxRecords)
  const idx = list.findIndex((item) => item.id === id)
  if (idx === -1) return null
  const [removed] = list.splice(idx, 1)
  await writeCollection(TAXES_KEY, list)
  if (removed) {
    await appendTaxAuditLog({
      action: 'Hapus Data Setoran',
      targetName: removed.merchantName,
      detail: `Billing ${removed.billingCode} (${removed.period}) sebesar Rp ${removed.taxAmount.toLocaleString('id-ID')} dihapus.`,
      actor: 'admin@mypajak.id'
    })
  }
  return removed ?? null
}
