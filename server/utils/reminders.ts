import { readCollection, writeCollection } from './db'

export type ReminderCategory = 'Pajak UMKM' | 'Tagihan Jasa' | 'Langganan Katering'
export type ReminderStatus = 'Aktif' | 'Selesai'

export interface PaymentReminder {
  id: number
  title: string
  merchantId: number | null
  merchantName: string
  category: ReminderCategory
  amount: number
  dueDate: string
  remindBeforeDays: number
  whatsapp: string
  note: string
  status: ReminderStatus
  createdAt: string
}

export const REMINDER_CATEGORIES: readonly ReminderCategory[] = [
  'Pajak UMKM',
  'Tagihan Jasa',
  'Langganan Katering'
] as const

const initialReminders: PaymentReminder[] = [
  {
    id: 7001,
    title: 'Bayar Pajak PB1 November — RM Sunda Mang Ujang',
    merchantId: 5,
    merchantName: 'Rumah Makan Sunda Mang Ujang',
    category: 'Pajak UMKM',
    amount: 1850000,
    dueDate: '2026-11-25',
    remindBeforeDays: 2,
    whatsapp: '6281299001122',
    note: 'Jatuh tempo pajak restoran PB1 10% bulan November.',
    status: 'Aktif',
    createdAt: '2026-11-18T08:00:00.000Z'
  },
  {
    id: 7002,
    title: 'Perpanjang Langganan Katering Harian 5 Hari',
    merchantId: 3,
    merchantName: 'Dapur Bu Sari — Rumah Makan & Katering',
    category: 'Langganan Katering',
    amount: 125000,
    dueDate: '2026-11-24',
    remindBeforeDays: 1,
    whatsapp: '6281398765432',
    note: 'Bayar sebelum jam 17.00 agar pengiriman besok berjalan.',
    status: 'Aktif',
    createdAt: '2026-11-20T09:30:00.000Z'
  },
  {
    id: 7003,
    title: 'Bayar Pajak PB1 November — Dapur Bu Sari',
    merchantId: 3,
    merchantName: 'Dapur Bu Sari — Rumah Makan & Katering',
    category: 'Pajak UMKM',
    amount: 2450000,
    dueDate: '2026-11-28',
    remindBeforeDays: 3,
    whatsapp: '6281398765432',
    note: 'Setoran pajak restoran & katering sebelum akhir bulan.',
    status: 'Aktif',
    createdAt: '2026-11-19T10:00:00.000Z'
  }
]

const REMINDERS_KEY = 'reminders.json'

export async function getReminders(): Promise<PaymentReminder[]> {
  const list = await readCollection<PaymentReminder>(REMINDERS_KEY, initialReminders)
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Aktif' ? -1 : 1
    return a.dueDate.localeCompare(b.dueDate)
  })
}

export async function addReminder(reminder: PaymentReminder): Promise<PaymentReminder> {
  const list = await readCollection<PaymentReminder>(REMINDERS_KEY, initialReminders)
  list.unshift(reminder)
  await writeCollection(REMINDERS_KEY, list)
  return reminder
}

export async function updateReminderStatus(
  id: number,
  status: ReminderStatus
): Promise<PaymentReminder | null> {
  const list = await readCollection<PaymentReminder>(REMINDERS_KEY, initialReminders)
  const target = list.find((r) => r.id === id)
  if (!target) return null
  target.status = status
  await writeCollection(REMINDERS_KEY, list)
  return target
}

export async function deleteReminderById(id: number): Promise<PaymentReminder | null> {
  const list = await readCollection<PaymentReminder>(REMINDERS_KEY, initialReminders)
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) return null
  const [removed] = list.splice(idx, 1)
  await writeCollection(REMINDERS_KEY, list)
  return removed ?? null
}
