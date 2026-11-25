import { readCollection, writeCollection } from './db'

export type PaymentChannel =
  | 'QRIS'
  | 'Virtual Account BCA'
  | 'Virtual Account BRI'
  | 'Virtual Account Mandiri'
  | 'GoPay'
  | 'OVO'
  | 'DANA'

export type PaymentCategory = 'Pesanan UMKM' | 'Pajak UMKM'

export interface PaymentTransaction {
  id: number
  invoiceCode: string
  category: PaymentCategory
  merchantId: number | null
  merchantName: string
  itemLabel: string
  quantity: number
  customerName: string
  subtotal: number
  discountAmount: number
  promoCode: string | null
  totalPaid: number
  paymentChannel: PaymentChannel
  virtualAccountNumber: string | null
  status: 'Lunas'
  paidAt: string
}

export const PAYMENT_CHANNELS: readonly PaymentChannel[] = [
  'QRIS',
  'Virtual Account BCA',
  'Virtual Account BRI',
  'Virtual Account Mandiri',
  'GoPay',
  'OVO',
  'DANA'
] as const

export function generateInvoiceCode(): string {
  const num = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  return `INV-LV-${num}`
}

export function generateVaNumber(channel: PaymentChannel): string | null {
  if (!channel.startsWith('Virtual Account')) return null
  const prefix = channel.includes('BCA')
    ? '39010'
    : channel.includes('BRI')
      ? '88810'
      : '89508'
  const suffix = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('')
  return `${prefix}${suffix}`
}

const initialPayments: PaymentTransaction[] = [
  {
    id: 5001,
    invoiceCode: 'INV-LV-842109',
    category: 'Pesanan UMKM',
    merchantId: 1,
    merchantName: 'Berkah Teknik AC & Kelistrikan',
    itemLabel: 'Cuci AC Split (0.5 - 1 PK)',
    quantity: 2,
    customerName: 'Raka Pratama',
    subtotal: 150000,
    discountAmount: 15000,
    promoCode: 'LOKAL10',
    totalPaid: 135000,
    paymentChannel: 'QRIS',
    virtualAccountNumber: null,
    status: 'Lunas',
    paidAt: '2026-11-21T08:40:00.000Z'
  },
  {
    id: 5002,
    invoiceCode: 'INV-LV-915320',
    category: 'Pesanan UMKM',
    merchantId: 5,
    merchantName: 'Rumah Makan Sunda Mang Ujang',
    itemLabel: 'Paket Bancakan 4 Orang',
    quantity: 1,
    customerName: 'Siti Rahma',
    subtotal: 175000,
    discountAmount: 15000,
    promoCode: 'HEMAT15K',
    totalPaid: 160000,
    paymentChannel: 'GoPay',
    virtualAccountNumber: null,
    status: 'Lunas',
    paidAt: '2026-11-22T12:15:00.000Z'
  }
]

const PAYMENTS_KEY = 'payments.json'

export async function getPayments(): Promise<PaymentTransaction[]> {
  const list = await readCollection<PaymentTransaction>(PAYMENTS_KEY, initialPayments)
  return [...list].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  )
}

export async function addPayment(tx: PaymentTransaction): Promise<PaymentTransaction> {
  const list = await readCollection<PaymentTransaction>(PAYMENTS_KEY, initialPayments)
  list.unshift(tx)
  await writeCollection(PAYMENTS_KEY, list)
  return tx
}
