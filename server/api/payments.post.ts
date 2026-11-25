import {
  PAYMENT_CHANNELS,
  addPayment,
  generateInvoiceCode,
  generateVaNumber,
  type PaymentCategory,
  type PaymentChannel,
  type PaymentTransaction
} from '../utils/payments'
import { updateTaxRecord } from '../utils/taxes'

interface CreatePaymentPayload {
  category?: string
  merchantId?: number | null
  merchantName?: string
  itemLabel?: string
  quantity?: number | string
  customerName?: string
  unitPrice?: number | string
  promoCode?: string | null
  paymentChannel?: string
  taxRecordId?: number | null
}

const isValidChannel = (val: string): val is PaymentChannel =>
  (PAYMENT_CHANNELS as readonly string[]).includes(val)

export default defineEventHandler(async (event) => {
  const body = await readBody<CreatePaymentPayload>(event)

  if (typeof body?.merchantName !== 'string' || body.merchantName.trim().length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama mitra / tujuan pembayaran wajib diisi.'
    })
  }

  if (typeof body?.itemLabel !== 'string' || body.itemLabel.trim().length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama layanan atau tagihan wajib diisi.'
    })
  }

  if (typeof body?.customerName !== 'string' || body.customerName.trim().length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama pembayar wajib diisi minimal 2 karakter.'
    })
  }

  if (typeof body?.paymentChannel !== 'string' || !isValidChannel(body.paymentChannel.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Metode pembayaran tidak valid.'
    })
  }
  const paymentChannel = body.paymentChannel.trim() as PaymentChannel

  const quantity = Math.max(1, Math.round(Number(body?.quantity) || 1))
  const unitPrice = Math.round(Number(body?.unitPrice) || 0)
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nominal pembayaran harus lebih dari Rp 0.'
    })
  }

  const category: PaymentCategory =
    body?.category === 'Pajak UMKM' ? 'Pajak UMKM' : 'Pesanan UMKM'

  const subtotal = unitPrice * quantity
  const normalizedPromo =
    typeof body?.promoCode === 'string' ? body.promoCode.trim().toUpperCase() : ''

  let discountAmount = 0
  let appliedPromo: string | null = null

  // Voucher hanya untuk Pesanan UMKM
  if (category === 'Pesanan UMKM' && normalizedPromo) {
    if (normalizedPromo === 'LOKAL10') {
      discountAmount = Math.min(50000, Math.round(subtotal * 0.1))
      appliedPromo = 'LOKAL10'
    } else if (normalizedPromo === 'HEMAT15K' && subtotal >= 75000) {
      discountAmount = 15000
      appliedPromo = 'HEMAT15K'
    }
  }

  const totalPaid = Math.max(0, subtotal - discountAmount)

  // Jika ini pembayaran tagihan pajak terdaftar, otomatis lunaskan & terbitkan NTPN
  let settledTaxNtpn: string | null = null
  if (category === 'Pajak UMKM' && typeof body?.taxRecordId === 'number' && body.taxRecordId > 0) {
    const updatedTax = await updateTaxRecord(body.taxRecordId, {
      status: 'Terverifikasi (Lunas)',
      adminNote: `Dibayar langsung melalui ${paymentChannel}.`
    })
    settledTaxNtpn = updatedTax?.ntpn ?? null
  }

  const newTx: PaymentTransaction = {
    id: Date.now(),
    invoiceCode: generateInvoiceCode(),
    category,
    merchantId: typeof body?.merchantId === 'number' ? body.merchantId : null,
    merchantName: body.merchantName.trim(),
    itemLabel: body.itemLabel.trim(),
    quantity,
    customerName: body.customerName.trim(),
    subtotal,
    discountAmount,
    promoCode: appliedPromo,
    totalPaid,
    paymentChannel,
    virtualAccountNumber: generateVaNumber(paymentChannel),
    status: 'Lunas',
    paidAt: new Date().toISOString()
  }

  await addPayment(newTx)

  return {
    success: true,
    message: 'Pembayaran berhasil diproses dan berstatus Lunas!',
    ntpn: settledTaxNtpn,
    data: newTx
  }
})
