<script setup lang="ts">
type PaymentChannel =
  | 'QRIS'
  | 'Virtual Account BCA'
  | 'Virtual Account BRI'
  | 'Virtual Account Mandiri'
  | 'GoPay'
  | 'OVO'
  | 'DANA'

interface MerchantService {
  name: string
  price: number
}

interface MerchantOption {
  id: number
  name: string
  category: string
  district: string
  whatsapp: string
  nextTaxDueDate?: string
  services: MerchantService[]
}

interface ReminderItem {
  id: number
  title: string
  merchantId: number | null
  merchantName: string
  category: string
  amount: number
  dueDate: string
  status: string
}

interface RemindersApiResponse {
  success: boolean
  data: ReminderItem[]
}

interface MerchantsApiResponse {
  success: boolean
  data: MerchantOption[]
}

interface TaxRecordItem {
  id: number
  billingCode: string
  merchantId: number | null
  merchantName: string
  taxType: string
  period: string
  taxAmount: number
  status: string
}

interface TaxesApiResponse {
  success: boolean
  data: TaxRecordItem[]
}

interface PaymentTransaction {
  id: number
  invoiceCode: string
  category: 'Pesanan UMKM' | 'Pajak UMKM'
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

interface PaymentsApiResponse {
  success: boolean
  total: number
  totalVolume: number
  data: PaymentTransaction[]
}

interface CreatePaymentResponse {
  success: boolean
  message: string
  ntpn: string | null
  data: PaymentTransaction
}

useHead({
  title: 'Bayar Instan UMKM & Pajak — MyPajak'
})

const PAYMENT_CHANNELS: Array<{ id: PaymentChannel; group: string; badge: string }> = [
  { id: 'QRIS', group: 'Scan Instan', badge: 'Populer' },
  { id: 'Virtual Account BCA', group: 'Transfer VA', badge: 'Otomatis' },
  { id: 'Virtual Account BRI', group: 'Transfer VA', badge: 'Otomatis' },
  { id: 'Virtual Account Mandiri', group: 'Transfer VA', badge: 'Otomatis' },
  { id: 'GoPay', group: 'E-Wallet', badge: 'Instan' },
  { id: 'OVO', group: 'E-Wallet', badge: 'Instan' },
  { id: 'DANA', group: 'E-Wallet', badge: 'Instan' }
]

const PROMO_VOUCHERS = [
  { code: 'LOKAL10', label: 'Diskon 10% (maks. Rp 50.000)' },
  { code: 'HEMAT15K', label: 'Potongan Rp 15.000 (min. Rp 75.000)' }
]

const route = useRoute()

const [
  { data: merchantsRes },
  { data: taxesRes, refresh: refreshTaxes },
  { data: paymentsRes, refresh: refreshPayments },
  { data: remindersRes }
] = await Promise.all([
  useFetch<MerchantsApiResponse>('/api/merchants', { key: 'merchants-list' }),
  useFetch<TaxesApiResponse>('/api/taxes', { key: 'admin-taxes-list' }),
  useFetch<PaymentsApiResponse>('/api/payments', { key: 'payments-list' }),
  useFetch<RemindersApiResponse>('/api/reminders', { key: 'reminders-list' })
])

const merchants = computed<MerchantOption[]>(() => merchantsRes.value?.data ?? [])
const unpaidTaxes = computed<TaxRecordItem[]>(() =>
  (taxesRes.value?.data ?? []).filter((t) => t.status !== 'Terverifikasi (Lunas)')
)
const paymentHistory = computed<PaymentTransaction[]>(() => paymentsRes.value?.data ?? [])
const totalVolume = computed(() => paymentsRes.value?.totalVolume ?? 0)
const remindersList = computed<ReminderItem[]>(() => remindersRes.value?.data ?? [])

// Mode Tab: 'umkm' atau 'pajak'
const payMode = ref<'umkm' | 'pajak'>(route.query.mode === 'pajak' ? 'pajak' : 'umkm')
const linkedReminderId = ref<number | null>(
  typeof route.query.reminderId === 'string' && Number(route.query.reminderId) > 0
    ? Number(route.query.reminderId)
    : null
)

// Form Pesanan UMKM
const initialMerchant = (() => {
  const qId = typeof route.query.merchantId === 'string' ? route.query.merchantId : ''
  if (qId) {
    const found = merchants.value.find((m) => String(m.id) === qId)
    if (found) return found
  }
  return merchants.value[0]
})()

const selectedMerchantId = ref<string>(initialMerchant ? String(initialMerchant.id) : '')
const selectedServiceName = ref<string>(initialMerchant?.services[0]?.name ?? '')
const quantity = ref<number>(1)
const customerName = ref<string>('')
const promoInput = ref<string>('')
const selectedChannel = ref<PaymentChannel>('QRIS')

// Form Pajak UMKM
const selectedTaxId = ref<string>(unpaidTaxes.value[0] ? String(unpaidTaxes.value[0].id) : '')

const currentMerchant = computed<MerchantOption | undefined>(() =>
  merchants.value.find((m) => String(m.id) === selectedMerchantId.value)
)

const currentService = computed<MerchantService | undefined>(() =>
  currentMerchant.value?.services.find((s) => s.name === selectedServiceName.value)
)

const currentTaxRecord = computed<TaxRecordItem | undefined>(() =>
  unpaidTaxes.value.find((t) => String(t.id) === selectedTaxId.value)
)

const linkedReminder = computed<ReminderItem | undefined>(() =>
  linkedReminderId.value
    ? remindersList.value.find((r) => r.id === linkedReminderId.value)
    : undefined
)

// Hitung tanggal tenggat otomatis berdasarkan Pengingat, Tagihan Pajak, atau Mitra terpilih
const getPeriodFallbackDueDate = (period: string): string => {
  const parts = period.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
    // Tenggat standar PPh Final UMKM / PB1 adalah tanggal 15 bulan berikutnya
    const nextDate = new Date(y, m, 15)
    return nextDate.toISOString().slice(0, 10)
  }
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
}

const defaultDueDate = computed<string>(() => {
  if (linkedReminder.value?.dueDate) {
    return linkedReminder.value.dueDate
  }

  if (payMode.value === 'pajak' && currentTaxRecord.value) {
    const taxMerchantId = currentTaxRecord.value.merchantId
    if (taxMerchantId) {
      const rem = remindersList.value.find(
        (r) => r.status === 'Aktif' && r.merchantId === taxMerchantId && r.category === 'Pajak UMKM'
      )
      if (rem?.dueDate) return rem.dueDate
      const merchantObj = merchants.value.find((m) => m.id === taxMerchantId)
      if (merchantObj?.nextTaxDueDate) return merchantObj.nextTaxDueDate
    }
    return getPeriodFallbackDueDate(currentTaxRecord.value.period)
  }

  if (currentMerchant.value) {
    const rem = remindersList.value.find(
      (r) => r.status === 'Aktif' && r.merchantId === currentMerchant.value!.id
    )
    if (rem?.dueDate) return rem.dueDate
    if (currentMerchant.value.nextTaxDueDate) return currentMerchant.value.nextTaxDueDate
  }

  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
})

const selectedDueDate = ref<string>(defaultDueDate.value)
watch(defaultDueDate, (nextVal) => {
  selectedDueDate.value = nextVal
})

// Countdown Timer real-time mengikuti tanggal tenggat yang diberikan (hingga 23:59:59)
const nowTimestamp = ref<number>(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

const deadlineTimestamp = computed<number>(() => {
  const dateStr = selectedDueDate.value || defaultDueDate.value
  const parsed = new Date(`${dateStr}T23:59:59`).getTime()
  return Number.isNaN(parsed) ? Date.now() + 86400000 : parsed
})

const remainingSeconds = computed<number>(() =>
  Math.max(0, Math.floor((deadlineTimestamp.value - nowTimestamp.value) / 1000))
)

const isDeadlineOverdue = computed<boolean>(() => deadlineTimestamp.value <= nowTimestamp.value)

const formattedDueDateLabel = computed<string>(() => {
  const dateStr = selectedDueDate.value || defaultDueDate.value
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(d)
})

const formattedCountdown = computed<string>(() => {
  if (isDeadlineOverdue.value) return 'LEWAT TENGGAT'
  const total = remainingSeconds.value
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const hms = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return days > 0 ? `${days} Hari ${hms}` : hms
})

onMounted(() => {
  nowTimestamp.value = Date.now()
  timerInterval = setInterval(() => {
    nowTimestamp.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

const handleMerchantChange = () => {
  selectedServiceName.value = currentMerchant.value?.services[0]?.name ?? ''
  quantity.value = 1
}

// Perhitungan harga & diskon
const subtotalAmount = computed(() => {
  if (payMode.value === 'pajak') {
    return currentTaxRecord.value?.taxAmount ?? 0
  }
  return (currentService.value?.price ?? 0) * quantity.value
})

const discountAmount = computed(() => {
  if (payMode.value !== 'umkm') return 0
  const code = promoInput.value.trim().toUpperCase()
  if (code === 'LOKAL10') return Math.min(50000, Math.round(subtotalAmount.value * 0.1))
  if (code === 'HEMAT15K' && subtotalAmount.value >= 75000) return 15000
  return 0
})

const finalPayableAmount = computed(() => Math.max(0, subtotalAmount.value - discountAmount.value))

// Preview VA number jika user memilih Virtual Account
const previewVaNumber = computed(() => {
  if (!selectedChannel.value.startsWith('Virtual Account')) return ''
  const prefix = selectedChannel.value.includes('BCA')
    ? '39010'
    : selectedChannel.value.includes('BRI')
      ? '88810'
      : '89508'
  const idPart =
    payMode.value === 'pajak'
      ? String(currentTaxRecord.value?.id ?? 2003).padStart(6, '0')
      : String(currentMerchant.value?.id ?? 1).padStart(6, '0')
  return `${prefix}82910${idPart}`
})

const copiedVa = ref(false)
const copyVa = async () => {
  if (!previewVaNumber.value) return
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(previewVaNumber.value)
    } else {
      const temp = document.createElement('textarea')
      temp.value = previewVaNumber.value
      temp.style.position = 'fixed'
      temp.style.opacity = '0'
      document.body.appendChild(temp)
      temp.focus()
      temp.select()
      document.execCommand('copy')
      document.body.removeChild(temp)
    }
    copiedVa.value = true
    setTimeout(() => (copiedVa.value = false), 1800)
  } catch {
    copiedVa.value = false
  }
}

// Submit Pembayaran
const isProcessing = ref(false)
const payError = ref('')
const quickNameInput = ref<HTMLInputElement | null>(null)
const receiptModal = ref<{ tx: PaymentTransaction; ntpn: string | null } | null>(null)

const handlePaySubmit = async () => {
  payError.value = ''

  if (customerName.value.trim().length < 2) {
    payError.value = 'Masukkan Nama Pembayar minimal 2 karakter terlebih dahulu.'
    nextTick(() => {
      quickNameInput.value?.focus()
    })
    return
  }

  if (payMode.value === 'umkm' && (!currentMerchant.value || !currentService.value)) {
    payError.value = 'Pilih mitra usaha dan layanan terlebih dahulu.'
    return
  }

  if (payMode.value === 'pajak' && !currentTaxRecord.value) {
    payError.value = 'Tidak ada tagihan pajak belum lunas yang dipilih.'
    return
  }

  isProcessing.value = true
  try {
    const body =
      payMode.value === 'pajak'
        ? {
            category: 'Pajak UMKM',
            merchantId: currentTaxRecord.value!.merchantId,
            merchantName: currentTaxRecord.value!.merchantName,
            itemLabel: `${currentTaxRecord.value!.taxType} (${currentTaxRecord.value!.period}) — Billing ${currentTaxRecord.value!.billingCode}`,
            quantity: 1,
            unitPrice: currentTaxRecord.value!.taxAmount,
            customerName: customerName.value.trim(),
            paymentChannel: selectedChannel.value,
            taxRecordId: currentTaxRecord.value!.id
          }
        : {
            category: 'Pesanan UMKM',
            merchantId: currentMerchant.value!.id,
            merchantName: currentMerchant.value!.name,
            itemLabel: currentService.value!.name,
            quantity: quantity.value,
            unitPrice: currentService.value!.price,
            customerName: customerName.value.trim(),
            promoCode: promoInput.value.trim() || null,
            paymentChannel: selectedChannel.value
          }

    const res = await $fetch<CreatePaymentResponse>('/api/payments', {
      method: 'POST',
      body
    })

    // Jika berasal dari pengingat pembayaran, otomatis tandai pengingat selesai!
    if (linkedReminderId.value) {
      try {
        await $fetch(`/api/reminders/${linkedReminderId.value}`, {
          method: 'PATCH',
          body: { status: 'Selesai' }
        })
        await refreshNuxtData('reminders-list')
      } catch {
        // Abaikan jika reminder sudah dihapus
      }
      linkedReminderId.value = null
    }

    await Promise.all([refreshPayments(), refreshTaxes()])
    if (payMode.value === 'pajak') {
      selectedTaxId.value = unpaidTaxes.value[0] ? String(unpaidTaxes.value[0].id) : ''
    }

    receiptModal.value = { tx: res.data, ntpn: res.ntpn }
    customerName.value = ''
    promoInput.value = ''
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    payError.value =
      fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal memproses pembayaran.'
  } finally {
    isProcessing.value = false
  }
}

const sendReceiptToWhatsapp = (tx: PaymentTransaction) => {
  const merchant = merchants.value.find((m) => m.id === tx.merchantId)
  const phone = merchant?.whatsapp
  if (!phone) return
  const msg = [
    `Halo *${tx.merchantName}*, saya telah melakukan pembayaran melalui *MyPajak*:`,
    '',
    `• *No. Invoice:* ${tx.invoiceCode}`,
    `• *Pesanan:* ${tx.itemLabel} (x${tx.quantity})`,
    `• *Pembayar:* ${tx.customerName}`,
    `• *Metode:* ${tx.paymentChannel}`,
    `• *Total Lunas:* ${formatRupiah(tx.totalPaid)}`,
    '',
    'Mohon diproses ya. Terima kasih!'
  ].join('\n')
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
}

const formatRupiah = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount)

const formatDateTime = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

const printReceipt = () => window.print()

const handleLogout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login?loggedOut=1', { replace: true })
}
</script>

<template>
  <div class="min-h-screen text-[#1F332B] flex flex-col lg:flex-row">
    <AppSidebar active-item="bayar" page-title="Pembayaran" />

    <div class="flex-1 min-w-0 flex flex-col">
    <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      <!-- Header Pembayaran & Tenggat Real-Time -->
      <section class="hero-surface rounded-3xl p-6 sm:p-7 text-white shadow-lg shadow-[#164234]/15 space-y-5">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/14 text-[11px] font-medium text-[#D8EDE1]">
              <span class="w-1.5 h-1.5 rounded-full bg-[#F06A47]"></span>
              Checkout Instan &amp; Struk Resmi
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold mt-2">Pembayaran Pesanan &amp; Pajak</h1>
            <p class="text-sm text-[#D6E7DE] mt-1">
              Pilih jenis tagihan, metode bayar, lalu konfirmasi untuk mendapatkan struk lunas atau NTPN.
            </p>
          </div>

          <!-- Kotak Tenggat Waktu Real-Time -->
          <div class="p-4 rounded-2xl bg-white/12 backdrop-blur-xs border border-white/20 min-w-[270px] flex flex-col sm:items-end gap-1">
            <p class="text-xs font-medium text-[#D8EDE1]">
              Tenggat bayar &middot; {{ formattedDueDateLabel }}
            </p>
            <p
              :class="[
                'text-xl sm:text-2xl font-bold font-mono leading-tight',
                isDeadlineOverdue ? 'text-[#FDE68A]' : 'text-white'
              ]"
            >
              {{ formattedCountdown }}
            </p>
            <div class="pt-1 flex items-center gap-2">
              <label for="payment-due-date" class="text-xs text-[#D8EDE1]">
                Ubah tenggat:
              </label>
              <input
                id="payment-due-date"
                v-model="selectedDueDate"
                type="date"
                class="px-2.5 py-1 rounded-lg border border-white/25 bg-white/95 text-[#1F332B] text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        <!-- Tab Mode Sederhana -->
        <div class="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              @click="payMode = 'umkm'; payError = ''"
              :class="[
                'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer',
                payMode === 'umkm'
                  ? 'bg-[#F06A47] text-white shadow-xs'
                  : 'bg-white/14 text-white hover:bg-white/22'
              ]"
            >
              Pesanan UMKM
            </button>
            <button
              type="button"
              @click="payMode = 'pajak'; payError = ''"
              :class="[
                'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer',
                payMode === 'pajak'
                  ? 'bg-[#F06A47] text-white shadow-xs'
                  : 'bg-white/14 text-white hover:bg-white/22'
              ]"
            >
              Tagihan Pajak ({{ unpaidTaxes.length }} belum lunas)
            </button>
          </div>
          <p class="text-xs text-[#D8EDE1]">
            Total transaksi lunas: <strong class="text-white">{{ formatRupiah(totalVolume) }}</strong>
          </p>
        </div>
      </section>

      <!-- Checkout Grid (Left Form + Right Interactive QRIS/VA Summary) -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 7 Cols: Detail Pembayaran -->
        <div class="lg:col-span-7 brochure-sheet rounded-2xl p-6 sm:p-7 space-y-5">
          <div v-if="payError" role="alert" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {{ payError }}
          </div>

          <!-- MODE 1: BAYAR PESANAN UMKM -->
          <template v-if="payMode === 'umkm'">
            <div class="pb-3 border-b border-[#EFEAE0]">
              <h2 class="text-lg font-bold text-[#1F513F]">
                Detail Pesanan Mitra UMKM
              </h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">
                  Pilih Mitra UMKM
                </label>
                <select
                  v-model="selectedMerchantId"
                  @change="handleMerchantChange"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#2F614A]/20 focus:border-[#2F614A] focus:outline-none"
                >
                  <option v-for="m in merchants" :key="m.id" :value="String(m.id)">
                    {{ m.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">
                  Pilih Layanan / Menu
                </label>
                <select
                  v-model="selectedServiceName"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#2F614A]/20 focus:border-[#2F614A] focus:outline-none"
                >
                  <option
                    v-for="(s, idx) in currentMerchant?.services ?? []"
                    :key="idx"
                    :value="s.name"
                  >
                    {{ s.name }} — {{ formatRupiah(s.price) }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">
                  Jumlah Pesanan
                </label>
                <div class="inline-flex items-center border border-[#DFD8CA] rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    @click="quantity = Math.max(1, quantity - 1)"
                    class="px-4 py-2 text-base font-bold text-[#1F513F] hover:bg-[#EBF3EC] cursor-pointer"
                  >
                    −
                  </button>
                  <span class="px-5 py-2 font-bold text-sm text-[#1F513F]">
                    {{ quantity }}
                  </span>
                  <button
                    type="button"
                    @click="quantity += 1"
                    class="px-4 py-2 text-base font-bold text-[#1F513F] hover:bg-[#EBF3EC] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">
                  Nama Pembayar *
                </label>
                <input
                  v-model="customerName"
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#2F614A]/20 focus:border-[#2F614A] focus:outline-none"
                />
              </div>
            </div>

            <!-- Voucher Promo Lokal -->
            <div class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7E0D3] space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs font-bold text-[#1F513F]">
                  Kode Voucher Promo Lokal
                </span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="v in PROMO_VOUCHERS"
                    :key="v.code"
                    type="button"
                    @click="promoInput = v.code"
                    class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white hover:bg-[#EBF3EC] text-[#1F513F] border border-[#DFD8CA] cursor-pointer transition"
                    :title="v.label"
                  >
                    Pakai {{ v.code }}
                  </button>
                </div>
              </div>
              <input
                v-model="promoInput"
                type="text"
                placeholder="Masukkan kode promo (mis. LOKAL10 atau HEMAT15K)"
                class="w-full px-3.5 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-white uppercase focus:border-[#2F614A] focus:outline-none"
              />
              <p v-if="discountAmount > 0" class="text-xs font-semibold text-[#2F614A]">
                ✓ Voucher {{ promoInput.toUpperCase() }} aktif — hemat {{ formatRupiah(discountAmount) }}.
              </p>
            </div>
          </template>

          <!-- MODE 2: BAYAR TAGIHAN PAJAK UMKM -->
          <template v-else>
            <div class="pb-3 border-b border-[#EFEAE0]">
              <h2 class="text-lg font-bold text-[#1F513F]">
                Lunasi Kode Billing Pajak UMKM
              </h2>
            </div>

            <div
              v-if="unpaidTaxes.length === 0"
              class="p-6 rounded-2xl bg-[#EBF3EC] border border-[#CFE4D4] text-center text-sm text-[#1F513F]"
            >
              Semua tagihan pajak UMKM saat ini sudah berstatus <strong>Terverifikasi (Lunas)</strong>.
            </div>

            <template v-else>
              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">
                  Pilih Tagihan Pajak Belum Lunas
                </label>
                <select
                  v-model="selectedTaxId"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#2F614A]/20 focus:border-[#2F614A] focus:outline-none"
                >
                  <option v-for="t in unpaidTaxes" :key="t.id" :value="String(t.id)">
                    {{ t.merchantName }} — {{ t.taxType }} ({{ t.period }}) — {{ formatRupiah(t.taxAmount) }}
                  </option>
                </select>
              </div>

              <div v-if="currentTaxRecord" class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] text-xs space-y-1.5">
                <div class="flex justify-between">
                  <span class="text-[#6B7F75]">Kode Billing</span>
                  <strong class="font-mono text-[#1F513F]">{{ currentTaxRecord.billingCode }}</strong>
                </div>
                <div class="flex justify-between">
                  <span class="text-[#6B7F75]">Status Saat Ini</span>
                  <strong class="text-[#D97706]">{{ currentTaxRecord.status }}</strong>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">
                  Nama Penyetor / Pemilik Usaha *
                </label>
                <input
                  v-model="customerName"
                  type="text"
                  placeholder="Contoh: Pemilik Usaha"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#2F614A]/20 focus:border-[#2F614A] focus:outline-none"
                />
              </div>
            </template>
          </template>

          <!-- Pilihan Metode Pembayaran -->
          <div class="pt-2">
            <p class="text-xs font-semibold text-[#52675E] mb-2.5">
              Pilih Metode Pembayaran
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                v-for="ch in PAYMENT_CHANNELS"
                :key="ch.id"
                type="button"
                @click="selectedChannel = ch.id"
                :class="[
                  'p-3.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition cursor-pointer',
                  selectedChannel === ch.id
                    ? 'bg-[#EBF3EC] border-[#2F614A] ring-1 ring-[#2F614A]/30'
                    : 'bg-white border-[#EAE4D9] hover:border-[#2F614A]'
                ]"
              >
                <div>
                  <p class="text-xs font-bold text-[#1F513F]">{{ ch.id }}</p>
                  <p class="text-[11px] text-[#6B7F75]">{{ ch.group }}</p>
                </div>
                <span
                  :class="[
                    'px-2.5 py-0.5 rounded-full text-[10px] font-semibold',
                    selectedChannel === ch.id
                      ? 'bg-[#2F614A] text-white'
                      : 'bg-[#F4EFE5] text-[#52675E]'
                  ]"
                >
                  {{ ch.badge }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right 5 Cols: Visual QRIS / VA & Checkout CTA -->
        <div class="lg:col-span-5 brochure-sheet rounded-2xl overflow-hidden">
          <div class="p-6 hero-surface text-white">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#B6D9C6]">
              Ringkasan Pembayaran
            </p>
            <p class="text-3xl font-bold mt-1">
              {{ formatRupiah(finalPayableAmount) }}
            </p>
            <p class="text-xs text-[#D6E7DE] mt-1">Metode: {{ selectedChannel }}</p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Visual QRIS Card -->
            <div
              v-if="selectedChannel === 'QRIS'"
              class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] text-center space-y-2.5"
            >
              <p class="text-xs font-bold text-[#1F513F]">
                Scan QRIS MyPajak
              </p>
              <!-- Crisp Decorative QR SVG -->
              <svg
                class="w-36 h-36 mx-auto bg-white p-2.5 rounded-xl border border-[#DFD8CA] shadow-xs"
                viewBox="0 0 100 100"
                fill="none"
                aria-label="Kode QRIS Pembayaran"
              >
                <rect x="6" y="6" width="26" height="26" stroke="#1F513F" stroke-width="5" />
                <rect x="13" y="13" width="12" height="12" fill="#1F513F" />
                <rect x="68" y="6" width="26" height="26" stroke="#1F513F" stroke-width="5" />
                <rect x="75" y="13" width="12" height="12" fill="#1F513F" />
                <rect x="6" y="68" width="26" height="26" stroke="#1F513F" stroke-width="5" />
                <rect x="13" y="75" width="12" height="12" fill="#1F513F" />
                <rect x="40" y="10" width="8" height="8" fill="#1F513F" />
                <rect x="52" y="18" width="8" height="8" fill="#F06A47" />
                <rect x="40" y="34" width="10" height="10" fill="#1F513F" />
                <rect x="54" y="42" width="10" height="10" fill="#2F614A" />
                <rect x="12" y="42" width="10" height="10" fill="#2F614A" />
                <rect x="28" y="48" width="8" height="12" fill="#1F513F" />
                <rect x="70" y="44" width="12" height="8" fill="#1F513F" />
                <rect x="44" y="64" width="12" height="12" fill="#F06A47" />
                <rect x="64" y="64" width="10" height="10" fill="#1F513F" />
                <rect x="80" y="70" width="12" height="22" fill="#2F614A" />
                <rect x="44" y="82" width="28" height="8" fill="#1F513F" />
              </svg>
              <p class="text-[11px] text-[#6B7F75]">
                Dukung semua aplikasi: BCA Mobile, Livin, BRImo, GoPay, OVO, DANA, ShopeePay.
              </p>
            </div>

            <!-- Visual Virtual Account Card -->
            <div
              v-else-if="previewVaNumber"
              class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] space-y-2"
            >
              <p class="text-xs font-semibold text-[#52675E]">
                Nomor {{ selectedChannel }}
              </p>
              <div class="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-[#DFD8CA]">
                <span class="font-mono font-bold text-base text-[#1F513F]">{{ previewVaNumber }}</span>
                <button
                  type="button"
                  @click="copyVa"
                  class="px-3 py-1 rounded-full bg-[#EBF3EC] text-[#1F513F] text-[11px] font-semibold cursor-pointer"
                >
                  {{ copiedVa ? 'Tersalin!' : 'Salin' }}
                </button>
              </div>
            </div>

            <!-- Visual E-Wallet Info -->
            <div v-else class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] text-xs text-[#445B51]">
              Pembayaran melalui <strong>{{ selectedChannel }}</strong> akan terverifikasi otomatis
              dalam hitungan detik setelah Anda klik tombol konfirmasi.
            </div>

            <!-- Breakdown -->
            <div class="space-y-2 text-xs border-t border-[#EFEAE0] pt-4">
              <div class="flex justify-between">
                <span class="text-[#6B7F75]">Subtotal</span>
                <strong class="text-[#1F332B]">{{ formatRupiah(subtotalAmount) }}</strong>
              </div>
              <div v-if="discountAmount > 0" class="flex justify-between text-[#2F614A]">
                <span>Diskon Promo ({{ promoInput.toUpperCase() }})</span>
                <strong>− {{ formatRupiah(discountAmount) }}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-[#6B7F75]">Biaya Layanan</span>
                <strong class="text-[#2F614A]">Gratis</strong>
              </div>
              <div class="flex justify-between pt-2 border-t border-[#EFEAE0] text-sm">
                <span class="font-bold text-[#1F513F]">Total Bayar</span>
                <strong class="font-bold text-[#F06A47]">
                  {{ formatRupiah(finalPayableAmount) }}
                </strong>
              </div>
            </div>

            <!-- Input Nama Cepat langsung di Ringkasan jika belum diisi -->
            <div class="space-y-1.5">
              <label for="quick-payer-name" class="block text-xs font-semibold text-[#52675E]">
                Nama Pembayar <span class="text-rose-500">*</span>
              </label>
              <input
                id="quick-payer-name"
                ref="quickNameInput"
                v-model="customerName"
                @input="payError = ''"
                type="text"
                placeholder="Ketik nama Anda untuk konfirmasi bayar..."
                :class="[
                  'w-full px-3.5 py-2.5 text-sm rounded-xl border bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#2F614A]/20 focus:border-[#2F614A] focus:outline-none transition',
                  payError && customerName.trim().length < 2
                    ? 'border-rose-400 ring-2 ring-rose-100'
                    : 'border-[#DFD8CA]'
                ]"
              />
            </div>

            <!-- Pesan Error langsung di atas tombol Bayar agar langsung terlihat -->
            <div
              v-if="payError"
              role="alert"
              class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"
            >
              {{ payError }}
            </div>

            <button
              type="button"
              :disabled="isProcessing || finalPayableAmount <= 0"
              @click="handlePaySubmit"
              class="w-full py-3.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] active:scale-[0.99] disabled:opacity-50 text-white text-sm font-semibold shadow-sm shadow-[#F06A47]/25 transition cursor-pointer"
            >
              {{ isProcessing ? 'Memproses Pembayaran...' : `Konfirmasi & Bayar ${formatRupiah(finalPayableAmount)}` }}
            </button>
          </div>
        </div>
      </section>

      <!-- Riwayat Pembayaran Terbaru -->
      <section class="brochure-sheet rounded-2xl p-6 sm:p-7">
        <div class="pb-4 border-b border-[#EFEAE0] flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-[#1F513F]">
              Riwayat Pembayaran Terbaru ({{ paymentHistory.length }})
            </h2>
            <p class="text-xs text-[#6B7F75] mt-0.5">Klik Struk untuk melihat atau mencetak bukti transaksi.</p>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto rounded-2xl border border-[#EAE4D9]">
          <table class="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr class="bg-[#1F513F] text-white text-xs font-semibold">
                <th class="py-3 px-4">Invoice</th>
                <th class="py-3 px-4">Tujuan &amp; Item</th>
                <th class="py-3 px-4">Pembayar</th>
                <th class="py-3 px-4">Metode</th>
                <th class="py-3 px-4 text-right">Total Lunas</th>
                <th class="py-3 px-4 text-center">Struk</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#EFEAE0] text-xs sm:text-sm">
              <tr v-for="tx in paymentHistory" :key="tx.id" class="bg-white hover:bg-[#FAF7F2] transition">
                <td class="py-3 px-4">
                  <p class="font-mono font-semibold text-[#1F513F]">{{ tx.invoiceCode }}</p>
                  <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EBF3EC] text-[#1F513F] mt-0.5">
                    {{ tx.category }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <p class="font-semibold text-[#1F332B]">{{ tx.merchantName }}</p>
                  <p class="text-xs text-[#6B7F75]">{{ tx.itemLabel }} (x{{ tx.quantity }})</p>
                </td>
                <td class="py-3 px-4 text-xs text-[#445B51]">
                  <p class="font-semibold">{{ tx.customerName }}</p>
                  <p class="text-[11px] text-[#7D8F87]">{{ formatDateTime(tx.paidAt) }}</p>
                </td>
                <td class="py-3 px-4 text-xs font-semibold text-[#2F614A]">
                  {{ tx.paymentChannel }}
                </td>
                <td class="py-3 px-4 text-right font-bold text-[#1F513F]">
                  {{ formatRupiah(tx.totalPaid) }}
                </td>
                <td class="py-3 px-4 text-center">
                  <button
                    type="button"
                    @click="receiptModal = { tx, ntpn: null }"
                    class="px-3.5 py-1.5 rounded-full bg-[#2F614A] hover:bg-[#1F513F] text-white text-xs font-semibold cursor-pointer"
                  >
                    Struk
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
    </div>

    <!-- Modal Struk Pembayaran Lunas -->
    <div
      v-if="receiptModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164234]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      @click.self="receiptModal = null"
    >
      <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#EAE4D9] overflow-hidden">
        <div class="px-6 py-6 hero-surface text-white text-center relative">
          <button type="button" @click="receiptModal = null" class="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer">✕</button>
          <div class="w-12 h-12 rounded-full bg-[#F06A47] text-white flex items-center justify-center mx-auto mb-2.5 text-xl font-bold shadow-sm">
            ✓
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-[#B6D9C6]">
            Pembayaran Berhasil (Lunas)
          </p>
          <p class="text-2xl font-bold mt-1">
            {{ formatRupiah(receiptModal.tx.totalPaid) }}
          </p>
          <p class="text-xs font-mono text-[#D6E7DE] mt-0.5">{{ receiptModal.tx.invoiceCode }}</p>
        </div>

        <div class="p-6 space-y-2.5 text-xs">
          <div v-if="receiptModal.ntpn" class="p-3 rounded-xl bg-[#EBF3EC] border border-[#CFE4D4] flex justify-between font-mono">
            <span class="text-[#1F513F] font-bold">NTPN Pajak Terbit</span>
            <strong class="text-[#2F614A]">{{ receiptModal.ntpn }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-[#6B7F75]">Mitra / Tujuan</span>
            <strong class="text-right text-[#1F332B]">{{ receiptModal.tx.merchantName }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-[#6B7F75]">Item</span>
            <strong class="text-right text-[#1F332B]">{{ receiptModal.tx.itemLabel }} (x{{ receiptModal.tx.quantity }})</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-[#6B7F75]">Pembayar</span>
            <strong class="text-[#1F332B]">{{ receiptModal.tx.customerName }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-[#6B7F75]">Metode</span>
            <strong class="text-[#1F332B]">{{ receiptModal.tx.paymentChannel }}</strong>
          </div>
          <div v-if="receiptModal.tx.promoCode" class="flex justify-between text-[#2F614A]">
            <span>Diskon ({{ receiptModal.tx.promoCode }})</span>
            <strong>− {{ formatRupiah(receiptModal.tx.discountAmount) }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-[#6B7F75]">Waktu Bayar</span>
            <strong class="text-[#1F332B]">{{ formatDateTime(receiptModal.tx.paidAt) }}</strong>
          </div>

          <div class="pt-4 border-t border-[#EFEAE0] flex flex-wrap justify-end gap-2">
            <button
              v-if="receiptModal.tx.category === 'Pesanan UMKM' && receiptModal.tx.merchantId"
              type="button"
              @click="sendReceiptToWhatsapp(receiptModal.tx)"
              class="px-4 py-2 rounded-full bg-[#2F614A] hover:bg-[#1F513F] text-white text-xs font-semibold cursor-pointer"
            >
              Kirim ke WA Mitra
            </button>
            <button
              type="button"
              @click="printReceipt"
              class="px-4 py-2 rounded-full border border-[#D8D0C2] bg-white hover:border-[#2F614A] text-[#1F513F] text-xs font-semibold cursor-pointer"
            >
              Cetak
            </button>
            <button
              type="button"
              @click="receiptModal = null"
              class="px-5 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
