import {
  REMINDER_CATEGORIES,
  addReminder,
  type PaymentReminder,
  type ReminderCategory
} from '../utils/reminders'

interface CreateReminderPayload {
  title?: string
  merchantId?: number | null
  merchantName?: string
  category?: string
  amount?: number | string
  dueDate?: string
  remindBeforeDays?: number | string
  whatsapp?: string
  note?: string
}

const isValidCategory = (v: string): v is ReminderCategory =>
  (REMINDER_CATEGORIES as readonly string[]).includes(v)

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateReminderPayload>(event)

  if (typeof body?.title !== 'string' || body.title.trim().length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Judul pengingat minimal 3 karakter.'
    })
  }

  const parsedAmount = Math.round(Number(body?.amount) || 0)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nominal tagihan harus lebih dari Rp 0.'
    })
  }

  if (typeof body?.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tanggal jatuh tempo wajib dipilih.'
    })
  }

  const category: ReminderCategory =
    typeof body?.category === 'string' && isValidCategory(body.category.trim())
      ? (body.category.trim() as ReminderCategory)
      : 'Tagihan Jasa'

  const cleanedWa =
    typeof body?.whatsapp === 'string' ? body.whatsapp.replace(/[\s\-()+]/g, '') : ''

  const newReminder: PaymentReminder = {
    id: Date.now(),
    title: body.title.trim(),
    merchantId: typeof body?.merchantId === 'number' ? body.merchantId : null,
    merchantName:
      typeof body?.merchantName === 'string' && body.merchantName.trim().length > 0
        ? body.merchantName.trim()
        : body.title.trim(),
    category,
    amount: parsedAmount,
    dueDate: body.dueDate.trim(),
    remindBeforeDays: Math.max(0, Math.min(30, Number(body?.remindBeforeDays) || 1)),
    whatsapp: cleanedWa,
    note: typeof body?.note === 'string' ? body.note.trim() : '',
    status: 'Aktif',
    createdAt: new Date().toISOString()
  }

  await addReminder(newReminder)

  return {
    success: true,
    message: 'Pengingat pembayaran berhasil disimpan!',
    data: newReminder
  }
})
