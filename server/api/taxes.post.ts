import {
  PAYMENT_METHODS,
  TAX_STATUSES,
  TAX_TYPES,
  addTaxRecord,
  generateBillingCode,
  generateNtpn,
  getTaxRatePercent,
  type PaymentMethod,
  type TaxRecord,
  type TaxStatus,
  type TaxType
} from '../utils/taxes'

interface CreateTaxPayload {
  merchantId?: number | null
  merchantName?: string
  district?: string
  npwp?: string
  taxType?: string
  period?: string
  grossRevenue?: number | string
  taxAmount?: number | string
  paymentMethod?: string
  status?: string
  adminNote?: string
}

const isValidTaxType = (value: string): value is TaxType =>
  (TAX_TYPES as readonly string[]).includes(value)

const isValidPaymentMethod = (value: string): value is PaymentMethod =>
  (PAYMENT_METHODS as readonly string[]).includes(value)

const isValidStatus = (value: string): value is TaxStatus =>
  (TAX_STATUSES as readonly string[]).includes(value)

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateTaxPayload>(event)

  if (typeof body?.merchantName !== 'string' || body.merchantName.trim().length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama usaha / wajib pajak minimal 3 karakter.'
    })
  }

  const cleanedNpwp = typeof body?.npwp === 'string' ? body.npwp.replace(/[\s.\-]/g, '') : ''
  if (!/^\d{15,16}$/.test(cleanedNpwp)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'NPWP / NIK wajib berupa 15 hingga 16 digit angka.'
    })
  }

  if (typeof body?.taxType !== 'string' || !isValidTaxType(body.taxType.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Jenis pajak tidak valid.'
    })
  }
  const taxType = body.taxType.trim() as TaxType

  if (typeof body?.period !== 'string' || !/^\d{4}-\d{2}$/.test(body.period.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Masa pajak wajib diisi (format YYYY-MM).'
    })
  }

  if (typeof body?.paymentMethod !== 'string' || !isValidPaymentMethod(body.paymentMethod.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Metode pembayaran tidak valid.'
    })
  }
  const paymentMethod = body.paymentMethod.trim() as PaymentMethod

  const taxRatePercent = getTaxRatePercent(taxType)
  let grossRevenue = 0
  let calculatedTaxAmount = 0

  if (taxRatePercent > 0) {
    const parsedRevenue = Number(body?.grossRevenue)
    if (!Number.isFinite(parsedRevenue) || parsedRevenue < 100000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Omzet bruto bulanan minimal Rp 100.000.'
      })
    }
    grossRevenue = Math.round(parsedRevenue)
    calculatedTaxAmount = Math.round(grossRevenue * (taxRatePercent / 100))
  } else {
    const parsedAmount = Number(body?.taxAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 10000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nominal retribusi minimal Rp 10.000.'
      })
    }
    calculatedTaxAmount = Math.round(parsedAmount)
  }

  const requestedStatus: TaxStatus =
    typeof body?.status === 'string' && isValidStatus(body.status.trim())
      ? (body.status.trim() as TaxStatus)
      : 'Menunggu Verifikasi'

  const nowIso = new Date().toISOString()

  const newRecord: TaxRecord = {
    id: Date.now(),
    billingCode: generateBillingCode(),
    ntpn: requestedStatus === 'Terverifikasi (Lunas)' ? generateNtpn() : null,
    merchantId: typeof body?.merchantId === 'number' ? body.merchantId : null,
    merchantName: body.merchantName.trim(),
    district:
      typeof body?.district === 'string' && body.district.trim().length > 0
        ? body.district.trim()
        : 'Area Lokal',
    npwp: cleanedNpwp,
    taxType,
    period: body.period.trim(),
    grossRevenue,
    taxRatePercent,
    taxAmount: calculatedTaxAmount,
    paymentMethod,
    status: requestedStatus,
    adminNote: typeof body?.adminNote === 'string' ? body.adminNote.trim() : '',
    isArchived: false,
    archivedAt: null,
    submittedAt: nowIso,
    verifiedAt: requestedStatus === 'Terverifikasi (Lunas)' ? nowIso : null
  }

  await addTaxRecord(newRecord)

  return {
    success: true,
    message: 'Data setoran pajak berhasil dicatat.',
    data: newRecord
  }
})
