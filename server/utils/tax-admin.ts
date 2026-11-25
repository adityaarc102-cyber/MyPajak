import { readCollection, readDocument, writeCollection, writeDocument } from './db'

export interface TaxSettings {
  monthlyTargetAmount: number
  latePenaltyPercentPerMonth: number
  taxOfficeName: string
  updatedAt: string
}

export interface TaxAuditEntry {
  id: number
  action: string
  targetName: string
  detail: string
  actor: string
  createdAt: string
}

const SETTINGS_KEY = 'tax-settings.json'
const AUDIT_KEY = 'tax-audit.json'

const DEFAULT_SETTINGS: TaxSettings = {
  monthlyTargetAmount: 4000000,
  latePenaltyPercentPerMonth: 2,
  taxOfficeName: 'Unit Pelayanan Pajak Daerah — MyPajak',
  updatedAt: '2026-11-01T08:00:00.000Z'
}

const INITIAL_AUDIT_LOGS: TaxAuditEntry[] = [
  {
    id: 9001,
    action: 'Verifikasi & Terbit NTPN',
    targetName: 'Rumah Makan Sunda Mang Ujang',
    detail: 'Setoran PB1 10% (2026-11) sebesar Rp 1.750.000 terverifikasi. NTPN: G5J7K9L2M4N6P8R3',
    actor: 'admin@mypajak.id',
    createdAt: '2026-11-18T11:00:00.000Z'
  },
  {
    id: 9002,
    action: 'Arsip Setoran',
    targetName: 'Dapur Bu Sari — Rumah Makan & Katering',
    detail: 'Setoran masa 2026-09 (Rp 2.200.000) diarsipkan setelah tutup buku.',
    actor: 'admin@mypajak.id',
    createdAt: '2026-10-03T08:45:00.000Z'
  }
]

export async function getTaxSettings(): Promise<TaxSettings> {
  const saved = await readDocument<TaxSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  if (saved && typeof saved.monthlyTargetAmount === 'number' && saved.monthlyTargetAmount > 0) {
    return saved
  }
  await writeDocument(SETTINGS_KEY, DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function updateTaxSettings(
  updates: Partial<Pick<TaxSettings, 'monthlyTargetAmount' | 'latePenaltyPercentPerMonth' | 'taxOfficeName'>>
): Promise<TaxSettings> {
  const current = await getTaxSettings()
  const next: TaxSettings = {
    monthlyTargetAmount:
      typeof updates.monthlyTargetAmount === 'number' && updates.monthlyTargetAmount >= 100000
        ? Math.round(updates.monthlyTargetAmount)
        : current.monthlyTargetAmount,
    latePenaltyPercentPerMonth:
      typeof updates.latePenaltyPercentPerMonth === 'number' &&
      updates.latePenaltyPercentPerMonth >= 0 &&
      updates.latePenaltyPercentPerMonth <= 25
        ? Number(updates.latePenaltyPercentPerMonth.toFixed(1))
        : current.latePenaltyPercentPerMonth,
    taxOfficeName:
      typeof updates.taxOfficeName === 'string' && updates.taxOfficeName.trim().length >= 3
        ? updates.taxOfficeName.trim()
        : current.taxOfficeName,
    updatedAt: new Date().toISOString()
  }

  await writeDocument(SETTINGS_KEY, next)
  return next
}

export async function getTaxAuditLogs(): Promise<TaxAuditEntry[]> {
  return await readCollection<TaxAuditEntry>(AUDIT_KEY, INITIAL_AUDIT_LOGS)
}

export async function appendTaxAuditLog(entry: Omit<TaxAuditEntry, 'id' | 'createdAt'>): Promise<TaxAuditEntry> {
  const logs = await getTaxAuditLogs()
  const next: TaxAuditEntry = {
    id: Date.now(),
    action: entry.action,
    targetName: entry.targetName,
    detail: entry.detail,
    actor: entry.actor || 'admin@mypajak.id',
    createdAt: new Date().toISOString()
  }
  logs.unshift(next)
  const trimmed = logs.slice(0, 100)
  await writeCollection(AUDIT_KEY, trimmed)
  return next
}
