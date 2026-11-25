<script setup lang="ts">
type MerchantCategory =
  | 'Jasa Rumah Tangga'
  | 'Kuliner & Katering'
  | 'Percetakan & ATK'
  | 'Otomotif'

type SortOption = 'distance' | 'rating' | 'price'

type TaxType =
  | 'PPh Final UMKM (0,5%)'
  | 'Pajak Daerah / Restoran (PB1 10%)'
  | 'Retribusi Daerah'

type PaymentMethod =
  | 'QRIS'
  | 'Virtual Account BCA'
  | 'Virtual Account BRI'
  | 'Virtual Account Mandiri'
  | 'Transfer Bank'

interface MerchantService {
  name: string
  price: number
}

interface MerchantReview {
  id: number
  reviewerName: string
  rating: number
  comment: string
  createdAt: string
}

interface Merchant {
  id: number
  name: string
  category: MerchantCategory
  district: string
  address: string
  latitude: number
  longitude: number
  openingHours: string
  distanceKm: number
  isVerified: boolean
  isOpen: boolean
  rating: number
  reviewCount: number
  whatsapp: string
  description: string
  imageUrl?: string
  services: MerchantService[]
  reviews?: MerchantReview[]
}

interface MerchantsApiResponse {
  success: boolean
  total: number
  data: Merchant[]
}

interface TaxRecordSummaryItem {
  id: number
  merchantId: number | null
  merchantName: string
  taxAmount?: number
  status: string
}

interface TaxesApiResponse {
  success: boolean
  data: TaxRecordSummaryItem[]
}

interface PaymentTransactionItem {
  id: number
  invoiceCode: string
  category: string
  merchantId: number | null
  merchantName: string
  itemLabel: string
  customerName: string
  totalPaid: number
  paymentChannel: string
  status: string
  paidAt: string
}

interface PaymentsApiResponse {
  success: boolean
  total: number
  totalVolume: number
  data: PaymentTransactionItem[]
}

interface PaymentReminder {
  id: number
  title: string
  merchantId: number | null
  merchantName: string
  category: 'Pajak UMKM' | 'Tagihan Jasa' | 'Langganan Katering'
  amount: number
  dueDate: string
  remindBeforeDays: number
  whatsapp: string
  note: string
  status: 'Aktif' | 'Selesai'
  createdAt: string
}

interface RemindersApiResponse {
  success: boolean
  total: number
  activeCount: number
  activeTotalAmount: number
  data: PaymentReminder[]
}

interface QuickOrderForm {
  selectedServiceName: string
  customerName: string
  address: string
  notes: string
}

useHead({
  title: 'MyPajak — Direktori UMKM, Pembayaran & Pajak Lokal'
})

const CATEGORIES: MerchantCategory[] = [
  'Jasa Rumah Tangga',
  'Kuliner & Katering',
  'Percetakan & ATK',
  'Otomotif'
]

const CATEGORY_META: Record<
  MerchantCategory,
  { number: string; image: string; subtitle: string }
> = {
  'Jasa Rumah Tangga': {
    number: '01',
    image: '/images/cat-rumah-tangga.jpg',
    subtitle: 'Servis AC, listrik & perawatan rumah'
  },
  'Kuliner & Katering': {
    number: '02',
    image: '/images/cat-kuliner.jpg',
    subtitle: 'Nasi kotak, tumpeng & katering harian'
  },
  'Percetakan & ATK': {
    number: '03',
    image: '/images/cat-percetakan.jpg',
    subtitle: 'Print kilat, jilid skripsi & banner'
  },
  Otomotif: {
    number: '04',
    image: '/images/cat-otomotif.jpg',
    subtitle: 'Bengkel motor, tune up & tambal ban'
  }
}

const KULINER_IMAGES = [
  '/images/kuliner-dimsum.jpg',
  '/images/kuliner-sunda.jpg',
  '/images/kuliner-padang.jpg',
  '/images/kuliner-warung.jpg',
  '/images/cat-kuliner.jpg'
]

const getCategoryImage = (category: MerchantCategory): string =>
  CATEGORY_META[category]?.image ?? '/images/cat-kuliner.jpg'

const getMerchantImage = (merchant: Merchant): string => {
  if (merchant.imageUrl) return merchant.imageUrl
  if (merchant.category !== 'Kuliner & Katering') {
    return getCategoryImage(merchant.category)
  }

  const text = `${merchant.name} ${merchant.description} ${merchant.services.map((s) => s.name).join(' ')}`.toLowerCase()
  if (/dimsum|siomay|hakau|gyoza|bakpao|pangsit/.test(text)) return '/images/kuliner-dimsum.jpg'
  if (/sunda|liwet|gurame|karedok|bancakan/.test(text)) return '/images/kuliner-sunda.jpg'
  if (/padang|rendang|minang|gulai|kapau/.test(text)) return '/images/kuliner-padang.jpg'
  if (/tumpeng|katering|nasi kotak/.test(text)) return '/images/cat-kuliner.jpg'
  if (/bakso|mie\s*ayam|mi\s*ayam|soto|geprek|warung|kafe|cafe|kopi|ayam|sate|nasi/.test(text)) {
    return '/images/kuliner-warung.jpg'
  }

  // Rotasi unik berdasarkan ID agar setiap restoran memiliki foto berbeda
  return KULINER_IMAGES[Math.abs(merchant.id) % KULINER_IMAGES.length] ?? '/images/kuliner-warung.jpg'
}

const TAX_TYPES: TaxType[] = [
  'PPh Final UMKM (0,5%)',
  'Pajak Daerah / Restoran (PB1 10%)',
  'Retribusi Daerah'
]

const PAYMENT_METHODS: PaymentMethod[] = [
  'QRIS',
  'Virtual Account BCA',
  'Virtual Account BRI',
  'Virtual Account Mandiri',
  'Transfer Bank'
]

interface AuthSessionResponse {
  authenticated: boolean
  user: {
    name: string
    email: string
    role: string
  } | null
}

const route = useRoute()

// Ambil daftar UMKM, status kepatuhan pajak, daftar pengingat bayar, riwayat pembayaran & sesi login
const [
  { data: response, status, error, refresh },
  { data: taxesResponse, refresh: refreshTaxes },
  { data: remindersResponse, refresh: refreshReminders },
  { data: paymentsResponse },
  { data: authResponse }
] = await Promise.all([
  useFetch<MerchantsApiResponse>('/api/merchants', { key: 'merchants-list' }),
  useFetch<TaxesApiResponse>('/api/taxes', { key: 'admin-taxes-list' }),
  useFetch<RemindersApiResponse>('/api/reminders', { key: 'reminders-list' }),
  useFetch<PaymentsApiResponse>('/api/payments', { key: 'dashboard-payments-list' }),
  useFetch<AuthSessionResponse>('/api/auth/me', { key: 'auth-session-me' })
])

const currentUser = computed(() => authResponse.value?.user ?? null)
const isAdminUser = computed(() => currentUser.value?.role === 'admin_pajak')
const isLoggingOut = ref(false)
const showAdminAccessNotice = ref(route.query.access === 'admin-only')

const handleLogout = async () => {
  isLoggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login?loggedOut=1', { replace: true })
  } finally {
    isLoggingOut.value = false
  }
}

// State navigasi & ringkasan nyata
const activeNav = ref<'dashboard' | 'direktori' | 'maps'>('dashboard')

const payments = computed<PaymentTransactionItem[]>(() => paymentsResponse.value?.data ?? [])
const totalPaymentVolume = computed(() => paymentsResponse.value?.totalVolume ?? 0)
const totalVerifiedTax = computed(() =>
  (taxesResponse.value?.data ?? [])
    .filter((t) => t.status === 'Terverifikasi (Lunas)')
    .reduce((sum, t) => sum + (Number(t.taxAmount) || 0), 0)
)
const activeReminderTotalAmount = computed(() => remindersResponse.value?.activeTotalAmount ?? 0)

// State Fitur "Ingat untuk Bayar" (Pengingat Pembayaran)
const reminders = computed<PaymentReminder[]>(() => remindersResponse.value?.data ?? [])
const activeReminders = computed<PaymentReminder[]>(() =>
  reminders.value.filter((r) => r.status === 'Aktif')
)
const activeReminderCount = computed(() => remindersResponse.value?.activeCount ?? 0)
const urgentReminder = computed<PaymentReminder | null>(() => activeReminders.value[0] ?? null)

const isReminderModalOpen = ref(false)
const showUrgentBanner = ref(true)
const isSavingReminder = ref(false)
const reminderError = ref('')
const reminderNotice = ref('')
const browserNotifStatus = ref('')

const reminderForm = reactive({
  title: '',
  merchantId: '' as string,
  merchantName: '',
  category: 'Pajak UMKM' as 'Pajak UMKM' | 'Tagihan Jasa' | 'Langganan Katering',
  amount: 100000 as number | null,
  dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  whatsapp: '',
  note: ''
})

const getDaysUntil = (dateStr: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

const getDueLabel = (dateStr: string): string => {
  const d = getDaysUntil(dateStr)
  if (d < 0) return `Lewat ${Math.abs(d)} hari`
  if (d === 0) return 'Jatuh Tempo Hari Ini!'
  return `H-${d}`
}

const openReminderModalForMerchant = (merchant?: Merchant) => {
  reminderError.value = ''
  reminderNotice.value = ''
  if (merchant) {
    reminderForm.merchantId = String(merchant.id)
    reminderForm.merchantName = merchant.name
    reminderForm.title = `Bayar Layanan — ${merchant.name}`
    reminderForm.category =
      merchant.category === 'Kuliner & Katering' ? 'Langganan Katering' : 'Tagihan Jasa'
    reminderForm.amount = getMinPrice(merchant) || 50000
    reminderForm.whatsapp = merchant.whatsapp
  } else {
    reminderForm.merchantId = ''
    reminderForm.merchantName = ''
    reminderForm.title = ''
    reminderForm.category = 'Pajak UMKM'
    reminderForm.amount = 100000
    reminderForm.whatsapp = ''
  }
  reminderForm.note = ''
  isReminderModalOpen.value = true
}

const submitNewReminder = async () => {
  reminderError.value = ''
  reminderNotice.value = ''

  if (reminderForm.title.trim().length < 3) {
    reminderError.value = 'Judul pengingat minimal 3 karakter.'
    return
  }
  if (!reminderForm.amount || Number(reminderForm.amount) <= 0) {
    reminderError.value = 'Nominal tagihan harus lebih dari Rp 0.'
    return
  }

  isSavingReminder.value = true
  try {
    const mId = reminderForm.merchantId ? Number(reminderForm.merchantId) : null
    const res = await $fetch<{ success: boolean; message: string }>('/api/reminders', {
      method: 'POST',
      body: {
        title: reminderForm.title.trim(),
        merchantId: Number.isFinite(mId) ? mId : null,
        merchantName: reminderForm.merchantName.trim() || reminderForm.title.trim(),
        category: reminderForm.category,
        amount: Number(reminderForm.amount),
        dueDate: reminderForm.dueDate,
        whatsapp: reminderForm.whatsapp.trim(),
        note: reminderForm.note.trim()
      }
    })
    await refreshReminders()
    reminderNotice.value = res.message
    reminderForm.title = ''
    reminderForm.note = ''
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    reminderError.value = fetchErr?.data?.statusMessage || 'Gagal menambah pengingat.'
  } finally {
    isSavingReminder.value = false
  }
}

const toggleReminderDone = async (rem: PaymentReminder) => {
  const nextStatus = rem.status === 'Aktif' ? 'Selesai' : 'Aktif'
  await $fetch(`/api/reminders/${rem.id}`, {
    method: 'PATCH',
    body: { status: nextStatus }
  })
  await refreshReminders()
}

const removeReminder = async (id: number) => {
  await $fetch(`/api/reminders/${id}`, { method: 'DELETE' })
  await refreshReminders()
}

const triggerBrowserNotification = async () => {
  if (!import.meta.client || !('Notification' in window)) {
    browserNotifStatus.value = 'Browser Anda tidak mendukung notifikasi desktop.'
    return
  }
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    const top = urgentReminder.value
    new Notification('Pengingat Bayar MyPajak ⏰', {
      body: top
        ? `${top.title} — ${formatRupiah(top.amount)} (${getDueLabel(top.dueDate)})`
        : 'Notifikasi pengingat bayar sudah aktif!'
    })
    browserNotifStatus.value = 'Notifikasi browser aktif! Peringatan dikirim.'
  } else {
    browserNotifStatus.value = 'Izin notifikasi ditolak di browser Anda.'
  }
}

const sendReminderToWa = (rem: PaymentReminder) => {
  const phone = rem.whatsapp || '6281234567890'
  const text = [
    `⏰ *PENGINGAT PEMBAYARAN — MYPAJAK*`,
    '',
    `• *Tagihan:* ${rem.title}`,
    `• *Kategori:* ${rem.category}`,
    `• *Nominal:* ${formatRupiah(rem.amount)}`,
    `• *Jatuh Tempo:* ${rem.dueDate} (${getDueLabel(rem.dueDate)})`,
    rem.note ? `• *Catatan:* ${rem.note}` : '',
    '',
    'Jangan lupa melakukan pembayaran tepat waktu melalui menu Bayar di MyPajak!'
  ]
    .filter(Boolean)
    .join('\n')
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}

// State pencarian, filter, urutkan & favorit
const searchQuery = ref('')
const selectedCategory = ref<string>('Semua')
const verifiedOnly = ref(false)
const openOnly = ref(false)
const favoritesOnly = ref(false)
const sortBy = ref<SortOption>('distance')
const favoriteIds = ref<number[]>([])

const isLoading = computed(() => status.value === 'pending')
const merchants = computed<Merchant[]>(() => response.value?.data ?? [])

const sortedAllMerchants = computed<Merchant[]>(() =>
  [...merchants.value].sort((a, b) => a.distanceKm - b.distanceKm)
)

const featuredMerchant = computed<Merchant | null>(() => {
  const verifiedOpen = sortedAllMerchants.value.find((m) => m.isVerified && m.isOpen)
  return verifiedOpen ?? sortedAllMerchants.value[0] ?? null
})

const verifiedCount = computed(() => merchants.value.filter((m) => m.isVerified).length)
const openCount = computed(() => merchants.value.filter((m) => m.isOpen).length)

const countByCategory = (category: MerchantCategory): number =>
  merchants.value.filter((m) => m.category === category).length

// Cek apakah mitra memiliki setoran pajak terverifikasi (lencana "Patuh Pajak")
const taxCompliantMerchantIds = computed<Set<number>>(() => {
  const ids = new Set<number>()
  for (const t of taxesResponse.value?.data ?? []) {
    if (t.status === 'Terverifikasi (Lunas)' && typeof t.merchantId === 'number') {
      ids.add(t.merchantId)
    }
  }
  return ids
})

const isTaxCompliant = (merchant: Merchant): boolean =>
  taxCompliantMerchantIds.value.has(merchant.id)

const getMinPrice = (merchant: Merchant): number => {
  if (!merchant.services || merchant.services.length === 0) return 0
  return Math.min(...merchant.services.map((s) => s.price))
}

// Filter dan urutkan (default: distanceKm terdekat)
const filteredMerchants = computed<Merchant[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return merchants.value
    .filter((merchant) => {
      if (verifiedOnly.value && !merchant.isVerified) return false
      if (openOnly.value && !merchant.isOpen) return false
      if (favoritesOnly.value && !favoriteIds.value.includes(merchant.id)) return false
      if (selectedCategory.value !== 'Semua' && merchant.category !== selectedCategory.value) {
        return false
      }

      if (!query) return true

      const inName = merchant.name.toLowerCase().includes(query)
      const inDescription = merchant.description.toLowerCase().includes(query)
      const inDistrict = merchant.district.toLowerCase().includes(query)
      const inServices = merchant.services.some((service) =>
        service.name.toLowerCase().includes(query)
      )

      return inName || inDescription || inDistrict || inServices
    })
    .sort((a, b) => {
      if (sortBy.value === 'rating') return b.rating - a.rating
      if (sortBy.value === 'price') return getMinPrice(a) - getMinPrice(b)
      return a.distanceKm - b.distanceKm
    })
})

const hasActiveFilter = computed(
  () =>
    searchQuery.value.trim().length > 0 ||
    selectedCategory.value !== 'Semua' ||
    verifiedOnly.value ||
    openOnly.value ||
    favoritesOnly.value ||
    sortBy.value !== 'distance'
)

const resetFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = 'Semua'
  verifiedOnly.value = false
  openOnly.value = false
  favoritesOnly.value = false
  sortBy.value = 'distance'
}

const scrollToTop = () => {
  activeNav.value = 'dashboard'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const scrollToDirectory = () => {
  activeNav.value = 'direktori'
  const el = document.getElementById('direktori-mitra')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const scrollToMaps = () => {
  activeNav.value = 'maps'
  const el = document.getElementById('peta-lokasi')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const selectCategoryPillar = (category: MerchantCategory) => {
  selectedCategory.value = selectedCategory.value === category ? 'Semua' : category
  scrollToDirectory()
}

// State Peta Lokasi Interaktif (Maps)
const selectedMapMerchantId = ref<number | null>(null)

const activeMapMerchant = computed<Merchant | null>(() => {
  const list = filteredMerchants.value.length > 0 ? filteredMerchants.value : sortedAllMerchants.value
  if (list.length === 0) return null
  if (selectedMapMerchantId.value !== null) {
    const found = list.find((m) => m.id === selectedMapMerchantId.value)
    if (found) return found
  }
  return list[0] ?? null
})

const mapEmbedUrl = computed(() => {
  const target = activeMapMerchant.value
  if (!target) return ''
  return `https://www.google.com/maps?q=${target.latitude},${target.longitude}&z=15&output=embed`
})

const getGoogleMapsDirectionUrl = (merchant: Merchant): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`

const focusMerchantOnMap = (merchant: Merchant) => {
  selectedMapMerchantId.value = merchant.id
  const el = document.getElementById('peta-lokasi')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Favorit tersimpan di localStorage
const FAVORITES_STORAGE_KEY = 'lokalverif_favorite_merchants'

const toggleFavorite = (merchantId: number) => {
  if (favoriteIds.value.includes(merchantId)) {
    favoriteIds.value = favoriteIds.value.filter((id) => id !== merchantId)
  } else {
    favoriteIds.value = [...favoriteIds.value, merchantId]
  }
  if (import.meta.client) {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds.value))
  }
}

const isFavorite = (merchantId: number): boolean => favoriteIds.value.includes(merchantId)

// Format helpers
const formatRupiah = (amount: number | string | null): string => {
  if (amount === null || String(amount).trim() === '') return 'Rp 0'
  const numeric = Number(amount)
  if (!Number.isFinite(numeric) || numeric < 0) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(numeric)
}

const formatDistance = (km: number): string => `${km.toFixed(1).replace('.', ',')} km`

const formatShortDate = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

// 1. Modal Pemesanan Cepat via WhatsApp
const activeMerchant = ref<Merchant | null>(null)
const orderForm = reactive<QuickOrderForm>({
  selectedServiceName: '',
  customerName: '',
  address: '',
  notes: ''
})
const orderErrors = reactive<Record<string, string>>({})

const clearOrderError = (key: string) => {
  if (orderErrors[key]) delete orderErrors[key]
}

const clearAllOrderErrors = () => {
  Object.keys(orderErrors).forEach((key) => delete orderErrors[key])
}

const openOrderModal = (merchant: Merchant) => {
  activeMerchant.value = merchant
  orderForm.selectedServiceName = merchant.services[0]?.name ?? ''
  orderForm.customerName = ''
  orderForm.address = ''
  orderForm.notes = ''
  clearAllOrderErrors()
}

const closeOrderModal = () => {
  activeMerchant.value = null
  clearAllOrderErrors()
}

const selectedServiceObject = computed<MerchantService | undefined>(() => {
  if (!activeMerchant.value) return undefined
  return activeMerchant.value.services.find(
    (service) => service.name === orderForm.selectedServiceName
  )
})

const handleQuickOrderSubmit = () => {
  if (!activeMerchant.value) return

  clearAllOrderErrors()

  if (!orderForm.selectedServiceName) {
    orderErrors.selectedServiceName = 'Silakan pilih layanan atau produk terlebih dahulu.'
  }
  if (!orderForm.customerName.trim()) {
    orderErrors.customerName = 'Nama pemesan wajib diisi.'
  }
  if (!orderForm.address.trim()) {
    orderErrors.address = 'Alamat atau patokan lokasi wajib diisi.'
  }
  if (Object.keys(orderErrors).length > 0) return

  const merchant = activeMerchant.value
  const service = selectedServiceObject.value
  const serviceLabel = service
    ? `${service.name} (${formatRupiah(service.price)})`
    : orderForm.selectedServiceName

  const messageLines = [
    `Halo *${merchant.name}*, saya ingin memesan melalui *MyPajak*:`,
    '',
    `• *Layanan/Produk:* ${serviceLabel}`,
    `• *Nama Pemesan:* ${orderForm.customerName.trim()}`,
    `• *Alamat/Patokan:* ${orderForm.address.trim()}`,
    `• *Catatan:* ${orderForm.notes.trim() || '-'}`,
    '',
    'Mohon konfirmasi ketersediaan dan estimasi waktunya. Terima kasih!'
  ]

  const encodedMessage = encodeURIComponent(messageLines.join('\n'))
  const whatsappUrl = `https://wa.me/${merchant.whatsapp}?text=${encodedMessage}`

  window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  closeOrderModal()
}

// 2. Modal Ulasan & Rating Pelanggan
const reviewMerchantId = ref<number | null>(null)
const reviewForm = reactive({
  reviewerName: '',
  rating: 5,
  comment: ''
})
const reviewError = ref('')
const reviewSuccess = ref('')
const isSubmittingReview = ref(false)

const reviewMerchant = computed<Merchant | null>(() => {
  if (reviewMerchantId.value === null) return null
  return merchants.value.find((m) => m.id === reviewMerchantId.value) ?? null
})

const openReviewModal = (merchant: Merchant) => {
  reviewMerchantId.value = merchant.id
  reviewForm.reviewerName = ''
  reviewForm.rating = 5
  reviewForm.comment = ''
  reviewError.value = ''
  reviewSuccess.value = ''
}

const closeReviewModal = () => {
  reviewMerchantId.value = null
}

const handleReviewSubmit = async () => {
  if (!reviewMerchant.value) return
  reviewError.value = ''
  reviewSuccess.value = ''

  if (reviewForm.reviewerName.trim().length < 2) {
    reviewError.value = 'Nama pengulas minimal 2 karakter.'
    return
  }
  if (reviewForm.comment.trim().length < 5) {
    reviewError.value = 'Tulis ulasan singkat minimal 5 karakter.'
    return
  }

  isSubmittingReview.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>(
      `/api/merchants/${reviewMerchant.value.id}/reviews`,
      {
        method: 'POST',
        body: {
          reviewerName: reviewForm.reviewerName.trim(),
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim()
        }
      }
    )
    await refresh()
    reviewSuccess.value = res.message
    reviewForm.reviewerName = ''
    reviewForm.rating = 5
    reviewForm.comment = ''
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    reviewError.value =
      fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal mengirim ulasan.'
  } finally {
    isSubmittingReview.value = false
  }
}

// 3. Modal Kalkulator & Lapor Pajak UMKM
const isTaxModalOpen = ref(false)
const isSubmittingTax = ref(false)
const taxError = ref('')
const submittedBillingResult = ref<{
  billingCode: string
  taxAmount: number
  merchantName: string
} | null>(null)

const currentMonthPeriod = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

const taxForm = reactive({
  selectedMerchantId: '',
  merchantName: '',
  district: '',
  npwp: '',
  taxType: 'PPh Final UMKM (0,5%)' as TaxType,
  period: currentMonthPeriod.value,
  grossRevenue: 15000000 as number | null,
  flatAmount: 50000 as number | null,
  paymentMethod: 'QRIS' as PaymentMethod
})

const isTaxPercentage = computed(() => taxForm.taxType !== 'Retribusi Daerah')
const estimatedTaxPayable = computed(() => {
  if (isTaxPercentage.value) {
    const rev = Number(taxForm.grossRevenue)
    if (!Number.isFinite(rev) || rev <= 0) return 0
    const rate = taxForm.taxType === 'PPh Final UMKM (0,5%)' ? 0.005 : 0.1
    return Math.round(rev * rate)
  }
  const flat = Number(taxForm.flatAmount)
  return Number.isFinite(flat) && flat > 0 ? Math.round(flat) : 0
})

const openTaxModal = () => {
  const first = merchants.value[0]
  taxForm.selectedMerchantId = first ? String(first.id) : 'manual'
  taxForm.merchantName = first?.name ?? ''
  taxForm.district = first?.district ?? ''
  taxForm.npwp = ''
  taxForm.taxType = 'PPh Final UMKM (0,5%)'
  taxForm.period = currentMonthPeriod.value
  taxForm.grossRevenue = 15000000
  taxForm.flatAmount = 50000
  taxForm.paymentMethod = 'QRIS'
  taxError.value = ''
  submittedBillingResult.value = null
  isTaxModalOpen.value = true
}

const handleTaxMerchantChange = () => {
  if (taxForm.selectedMerchantId === 'manual') {
    taxForm.merchantName = ''
    taxForm.district = ''
    return
  }
  const found = merchants.value.find((m) => String(m.id) === taxForm.selectedMerchantId)
  if (found) {
    taxForm.merchantName = found.name
    taxForm.district = found.district
  }
}

const submitSelfTaxFiling = async () => {
  taxError.value = ''
  if (taxForm.merchantName.trim().length < 3) {
    taxError.value = 'Nama usaha minimal 3 karakter.'
    return
  }
  const cleanNpwp = taxForm.npwp.replace(/[\s.\-]/g, '')
  if (!/^\d{15,16}$/.test(cleanNpwp)) {
    taxError.value = 'NPWP / NIK wajib 15–16 digit angka.'
    return
  }
  if (isTaxPercentage.value && (!taxForm.grossRevenue || Number(taxForm.grossRevenue) < 100000)) {
    taxError.value = 'Omzet bruto bulanan minimal Rp 100.000.'
    return
  }
  if (!isTaxPercentage.value && (!taxForm.flatAmount || Number(taxForm.flatAmount) < 10000)) {
    taxError.value = 'Nominal retribusi minimal Rp 10.000.'
    return
  }

  isSubmittingTax.value = true
  try {
    const merchantId =
      taxForm.selectedMerchantId !== 'manual' ? Number(taxForm.selectedMerchantId) : null
    const res = await $fetch<{
      success: boolean
      data: { billingCode: string; taxAmount: number; merchantName: string }
    }>('/api/taxes', {
      method: 'POST',
      body: {
        merchantId: Number.isFinite(merchantId) ? merchantId : null,
        merchantName: taxForm.merchantName.trim(),
        district: taxForm.district.trim() || 'Area Lokal',
        npwp: cleanNpwp,
        taxType: taxForm.taxType,
        period: taxForm.period,
        grossRevenue: isTaxPercentage.value ? Number(taxForm.grossRevenue) : 0,
        taxAmount: isTaxPercentage.value ? estimatedTaxPayable.value : Number(taxForm.flatAmount),
        paymentMethod: taxForm.paymentMethod,
        status: 'Menunggu Verifikasi'
      }
    })
    await refreshTaxes()
    submittedBillingResult.value = res.data
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    taxError.value =
      fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal mengirim laporan pajak.'
  } finally {
    isSubmittingTax.value = false
  }
}

// Sidebar mobile drawer state
const isMobileSidebarOpen = ref(false)

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (isMobileSidebarOpen.value) isMobileSidebarOpen.value = false
    if (activeMerchant.value) closeOrderModal()
    if (reviewMerchantId.value !== null) closeReviewModal()
    if (isTaxModalOpen.value) isTaxModalOpen.value = false
    if (isReminderModalOpen.value) isReminderModalOpen.value = false
  }
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        favoriteIds.value = parsed.filter((id): id is number => typeof id === 'number')
      }
    }
  } catch {
    favoriteIds.value = []
  }
  window.addEventListener('keydown', handleKeydown)

  if (route.query.open === 'pengingat') {
    openReminderModalForMerchant()
  } else if (route.query.open === 'pajak') {
    openTaxModal()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F2] text-[#1F332B]">
    <!-- Sidebar Navigasi di Samping Kiri (Desktop) + Drawer (Mobile) -->
    <AppSidebar
      active-item="usaha"
      page-title="Beranda"
      :reminder-count="activeReminderCount"
    />

    <div class="flex-1 min-w-0 flex flex-col">
    <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      <!-- Info jika akun pengguna biasa mencoba buka /admin-pajak -->
      <div
        v-if="showAdminAccessNotice"
        role="status"
        class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-center justify-between gap-3"
      >
        <span>Panel <strong>Admin Pajak</strong> khusus akun Admin. Klik <strong>Keluar</strong> lalu masuk dengan akun Admin Pajak.</span>
        <button type="button" @click="showAdminAccessNotice = false" class="text-xs font-semibold hover:underline cursor-pointer shrink-0">
          Tutup
        </button>
      </div>
      <!-- Hero Ringkas Modern + Bilah Pencarian Terpadu -->
      <section class="space-y-4">
        <div class="hero-surface rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-[#164234]/15 space-y-6">
          <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div class="max-w-xl">
              <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/12 border border-white/15 text-[11px] font-medium text-[#D8EDE1]">
                <span class="w-1.5 h-1.5 rounded-full bg-[#F06A47]"></span>
                MyPajak &middot; Direktori Usaha &amp; Pajak Lokal
              </span>
              <h1 class="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight leading-tight mt-3">
                Kelola Usaha &amp; <span class="text-[#FF9E82]">Pajak Harian</span> Lebih Praktis
              </h1>
              <p class="text-sm text-[#D6E7DE] mt-2 leading-relaxed">
                Temukan usaha sekitar, lunasi tagihan lewat QRIS atau VA, dan pantau tenggat pajak dalam satu tempat.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 shrink-0">
              <NuxtLink
                to="/bayar"
                class="px-5 py-2.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs sm:text-sm font-semibold shadow-sm shadow-black/15 transition"
              >
                Bayar Sekarang &rarr;
              </NuxtLink>
              <NuxtLink
                to="/lapor-pajak"
                class="px-4 py-2.5 rounded-full bg-white/14 hover:bg-white/22 border border-white/20 text-white text-xs sm:text-sm font-semibold transition"
              >
                Lapor Pajak 0,5%
              </NuxtLink>
              <NuxtLink
                to="/pengingat"
                class="px-4 py-2.5 rounded-full bg-[#FAF7F2] hover:bg-white text-[#1F513F] text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
              >
                <span>Pengingat</span>
                <span
                  v-if="activeReminderCount > 0"
                  class="px-1.5 py-0.5 rounded-full bg-[#F06A47] text-white text-[10px] font-bold leading-none"
                >
                  {{ activeReminderCount }}
                </span>
              </NuxtLink>
            </div>
          </div>

          <!-- Bilah Pencarian Pill Terintegrasi -->
          <div class="bg-white rounded-2xl lg:rounded-full shadow-md shadow-black/10 p-2.5 lg:px-4 text-[#1F332B]">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
              <div class="lg:col-span-5 flex items-center gap-2.5 px-2.5 lg:border-r border-[#EDE7DC]">
                <svg class="w-4 h-4 text-[#2F614A] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Cari usaha, dimsum, cuci AC, kecamatan..."
                  class="w-full py-1.5 text-sm text-[#1F332B] placeholder:text-[#8E9F97] bg-transparent focus:outline-none"
                />
              </div>

              <div class="lg:col-span-3 px-2.5 lg:border-r border-[#EDE7DC]">
                <select
                  v-model="selectedCategory"
                  aria-label="Filter kategori"
                  class="w-full py-1.5 text-sm font-medium text-[#1F332B] bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="Semua">Semua Kategori</option>
                  <option v-for="category in CATEGORIES" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </div>

              <div class="lg:col-span-2 px-2.5">
                <select
                  v-model="sortBy"
                  aria-label="Urutkan usaha"
                  class="w-full py-1.5 text-sm font-medium text-[#1F332B] bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="distance">Terdekat</option>
                  <option value="rating">Rating Tertinggi</option>
                  <option value="price">Harga Termurah</option>
                </select>
              </div>

              <div class="lg:col-span-2">
                <button
                  type="button"
                  @click="scrollToDirectory()"
                  class="w-full py-2.5 px-4 rounded-full bg-[#2F614A] hover:bg-[#1F513F] text-white text-sm font-semibold transition cursor-pointer"
                >
                  Cari Usaha
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4 Kartu Ringkasan Cepat dengan Ikon Bersih -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            @click="scrollToDirectory()"
            class="card-interactive bg-white rounded-2xl border border-[#EAE4D9] p-4 text-left cursor-pointer flex items-start justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-[#6B7F75]">Usaha Aktif</p>
              <p class="text-2xl font-bold text-[#1F513F] mt-1">{{ merchants.length }}</p>
              <p class="text-[11px] text-[#7D8F87] mt-1">{{ verifiedCount }} terverifikasi &middot; {{ openCount }} buka</p>
            </div>
            <span class="w-9 h-9 rounded-xl bg-[#EBF3EC] text-[#1F513F] flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72" />
              </svg>
            </span>
          </button>

          <NuxtLink
            to="/pengingat"
            class="card-interactive bg-white rounded-2xl border border-[#EAE4D9] p-4 text-left flex items-start justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-[#6B7F75]">Pengingat Aktif</p>
              <p class="text-2xl font-bold text-[#F06A47] mt-1">{{ activeReminderCount }}</p>
              <p class="text-[11px] text-[#7D8F87] mt-1 truncate">{{ formatRupiah(activeReminderTotalAmount) }}</p>
            </div>
            <span class="w-9 h-9 rounded-xl bg-[#FCEAE3] text-[#F06A47] flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </NuxtLink>

          <NuxtLink
            to="/bayar"
            class="card-interactive bg-white rounded-2xl border border-[#EAE4D9] p-4 text-left flex items-start justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-[#6B7F75]">Pembayaran Lunas</p>
              <p class="text-xl sm:text-2xl font-bold text-[#1F513F] mt-1 truncate">{{ formatRupiah(totalPaymentVolume) }}</p>
              <p class="text-[11px] text-[#7D8F87] mt-1">{{ payments.length }} transaksi tercatat</p>
            </div>
            <span class="w-9 h-9 rounded-xl bg-[#EBF3EC] text-[#2F614A] flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </span>
          </NuxtLink>

          <NuxtLink
            to="/lapor-pajak"
            class="card-interactive bg-white rounded-2xl border border-[#EAE4D9] p-4 text-left flex items-start justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-[#6B7F75]">Pajak Terverifikasi</p>
              <p class="text-xl sm:text-2xl font-bold text-[#1F513F] mt-1 truncate">{{ formatRupiah(totalVerifiedTax) }}</p>
              <p class="text-[11px] text-[#2D6A4F] font-semibold mt-1">Lapor pajak &rarr;</p>
            </div>
            <span class="w-9 h-9 rounded-xl bg-[#EBF3EC] text-[#1F513F] flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
          </NuxtLink>
        </div>
      </section>

      <!-- Tagihan & Pengingat Terdekat (Praktis untuk Pemakaian Harian) -->
      <section
        v-if="activeReminders.length > 0"
        class="bg-[#F4EFE5] rounded-2xl border border-[#E7E0D3] p-4 sm:p-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5DEC9]">
          <h2 class="text-sm sm:text-base font-bold text-[#1F513F]">
            Tagihan &amp; Pengingat Terdekat
          </h2>
          <NuxtLink
            to="/pengingat"
            class="text-xs font-semibold text-[#2F614A] hover:underline"
          >
            Kelola Semua ({{ activeReminderCount }}) &rarr;
          </NuxtLink>
        </div>

        <div class="divide-y divide-[#E7E0D3] mt-1">
          <div
            v-for="rem in activeReminders.slice(0, 3)"
            :key="rem.id"
            class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2 py-0.5 rounded-full bg-[#FCEAE3] text-[#D85432] text-[11px] font-semibold">
                  {{ getDueLabel(rem.dueDate) }}
                </span>
                <p class="text-sm font-semibold text-[#1F332B] truncate">{{ rem.title }}</p>
              </div>
              <p class="text-xs text-[#6B7F75] mt-0.5">
                Tenggat {{ rem.dueDate }} &middot; {{ rem.category }}
              </p>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span class="text-sm font-bold text-[#1F513F]">
                {{ formatRupiah(rem.amount) }}
              </span>
              <NuxtLink
                :to="
                  rem.category === 'Pajak UMKM'
                    ? `/bayar?mode=pajak&reminderId=${rem.id}`
                    : `/bayar?merchantId=${rem.merchantId ?? ''}&reminderId=${rem.id}`
                "
                class="px-4 py-1.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold transition"
              >
                Bayar
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Daftar Usaha & Restoran -->
      <section id="direktori-mitra" class="space-y-4 scroll-mt-20">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-[#1F513F]">Daftar Usaha &amp; Restoran</h2>
            <p class="text-xs text-[#6B7F75] mt-0.5">
              Menampilkan {{ filteredMerchants.length }} dari {{ merchants.length }} usaha
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              @click="verifiedOnly = !verifiedOnly"
              :class="[
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer',
                verifiedOnly
                  ? 'bg-[#2F614A] text-white border-[#2F614A]'
                  : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
              ]"
            >
              Terverifikasi
            </button>
            <button
              type="button"
              @click="openOnly = !openOnly"
              :class="[
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer',
                openOnly
                  ? 'bg-[#2F614A] text-white border-[#2F614A]'
                  : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
              ]"
            >
              Sedang Buka
            </button>
            <button
              type="button"
              @click="favoritesOnly = !favoritesOnly"
              :class="[
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer',
                favoritesOnly
                  ? 'bg-[#F06A47] text-white border-[#F06A47]'
                  : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#F06A47]'
              ]"
            >
              Favorit ({{ favoriteIds.length }})
            </button>
            <button
              v-if="hasActiveFilter"
              type="button"
              @click="resetFilters"
              class="px-3 py-1.5 rounded-full text-xs font-semibold text-[#F06A47] hover:bg-[#FFF2EE] transition cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        <!-- Filter Kategori -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            @click="selectedCategory = 'Semua'"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer',
              selectedCategory === 'Semua'
                ? 'bg-[#1F513F] text-white'
                : 'bg-white border border-[#E5DEC9] text-[#566B62] hover:border-[#1F513F]'
            ]"
          >
            Semua ({{ merchants.length }})
          </button>
          <button
            v-for="cat in CATEGORIES"
            :key="cat"
            type="button"
            @click="selectedCategory = selectedCategory === cat ? 'Semua' : cat"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer',
              selectedCategory === cat
                ? 'bg-[#1F513F] text-white'
                : 'bg-white border border-[#E5DEC9] text-[#566B62] hover:border-[#1F513F]'
            ]"
          >
            {{ cat }} ({{ countByCategory(cat) }})
          </button>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="n in 3"
            :key="n"
            class="rounded-2xl border border-[#EAE4D9] overflow-hidden animate-pulse bg-white"
          >
            <div class="h-40 bg-[#EFEAE0]"></div>
            <div class="p-4 space-y-2.5">
              <div class="h-5 bg-[#EFEAE0] rounded w-2/3"></div>
              <div class="h-4 bg-[#F5F1E9] rounded w-1/2"></div>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div
          v-else-if="error"
          class="p-8 bg-white rounded-2xl border border-red-200 text-center"
        >
          <p class="font-semibold text-red-700">Gagal memuat daftar usaha.</p>
          <button
            type="button"
            @click="() => refresh()"
            class="mt-3 px-5 py-2 rounded-full bg-[#F06A47] text-white text-sm font-medium cursor-pointer"
          >
            Muat Ulang
          </button>
        </div>

        <!-- Empty -->
        <div
          v-else-if="filteredMerchants.length === 0"
          class="p-8 bg-white rounded-2xl border border-[#EAE4D9] text-center"
        >
          <p class="font-semibold text-[#1F513F]">Tidak ada usaha yang sesuai pencarian.</p>
          <button
            type="button"
            @click="resetFilters"
            class="mt-3 px-5 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-sm font-semibold cursor-pointer"
          >
            Tampilkan Semua
          </button>
        </div>

        <!-- Grid Kartu Usaha -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <article
            v-for="merchant in filteredMerchants"
            :key="merchant.id"
            class="group card-interactive bg-white rounded-2xl border border-[#EAE4D9] shadow-xs flex flex-col justify-between overflow-hidden"
          >
            <div>
              <!-- Foto Usaha -->
              <div class="p-2.5 pb-0">
                <div class="relative h-44 rounded-xl overflow-hidden bg-[#F2EDE3]">
                  <img
                    :src="getMerchantImage(merchant)"
                    :alt="merchant.name"
                    class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div class="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 via-black/20 to-transparent pointer-events-none"></div>

                  <div class="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                    <span
                      :class="[
                        'px-2.5 py-0.5 rounded-full text-[11px] font-semibold shadow-xs',
                        merchant.isOpen ? 'bg-[#2F614A] text-white' : 'bg-[#1F332B]/85 text-white'
                      ]"
                    >
                      {{ merchant.isOpen ? 'Buka' : 'Tutup' }}
                    </span>
                    <span
                      v-if="isTaxCompliant(merchant)"
                      class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F06A47] text-white shadow-xs"
                    >
                      Patuh Pajak
                    </span>
                    <span
                      v-else-if="merchant.isVerified"
                      class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 text-[#1F513F] shadow-xs"
                    >
                      Terverifikasi
                    </span>
                  </div>

                  <div class="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-white/95 font-medium">
                    <span class="truncate pr-2">{{ merchant.category }}</span>
                    <span class="px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-xs shrink-0">
                      {{ formatDistance(merchant.distanceKm) }}
                    </span>
                  </div>

                  <button
                    type="button"
                    @click="toggleFavorite(merchant.id)"
                    :aria-label="isFavorite(merchant.id) ? 'Hapus favorit' : 'Tambah favorit'"
                    class="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-xs transition cursor-pointer"
                  >
                    <svg
                      :class="[
                        'w-4 h-4 transition',
                        isFavorite(merchant.id)
                          ? 'text-[#F06A47] fill-[#F06A47]'
                          : 'text-[#6B7F75] hover:text-[#F06A47]'
                      ]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Detail Usaha -->
              <div class="p-4 pt-3">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="text-base font-bold text-[#1F513F] truncate group-hover:text-[#F06A47] transition-colors">
                    {{ merchant.name }}
                  </h3>
                  <button
                    type="button"
                    @click="openReviewModal(merchant)"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EAE4D9] text-[11px] font-semibold text-[#1F513F] hover:border-[#F06A47] shrink-0 cursor-pointer"
                  >
                    <span class="text-[#F59E0B]">★</span>
                    <span>{{ merchant.reviewCount > 0 ? merchant.rating.toFixed(1) : 'Baru' }}</span>
                  </button>
                </div>
                <p class="text-xs text-[#6B7F75] mt-0.5 truncate">
                  {{ merchant.district }} &middot; {{ merchant.openingHours }}
                </p>

                <!-- Daftar Harga -->
                <div class="mt-3 pt-3 border-t border-[#F0EBE1] space-y-1.5 text-xs">
                  <div
                    v-for="(service, idx) in merchant.services.slice(0, 3)"
                    :key="idx"
                    class="flex items-center justify-between gap-2 text-[#445B51]"
                  >
                    <span class="truncate">{{ service.name }}</span>
                    <span class="font-semibold text-[#1F513F] shrink-0">
                      {{ formatRupiah(service.price) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Aksi Cepat -->
            <div class="px-4 pb-4 pt-2 space-y-2.5">
              <div class="flex items-center justify-between gap-2 text-xs text-[#52675E]">
                <button
                  type="button"
                  @click="openReviewModal(merchant)"
                  class="font-medium text-[#52675E] hover:text-[#1F513F] cursor-pointer"
                >
                  {{ merchant.reviewCount > 0 ? `${merchant.reviewCount} ulasan` : 'Beri ulasan pertama' }}
                </button>
                <div class="flex items-center gap-3 font-medium">
                  <NuxtLink :to="`/peta?merchantId=${merchant.id}`" class="hover:text-[#1F513F]">
                    Peta
                  </NuxtLink>
                  <NuxtLink :to="`/pengingat?merchantId=${merchant.id}`" class="hover:text-[#F06A47]">
                    Ingatkan
                  </NuxtLink>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  @click="openOrderModal(merchant)"
                  class="py-2 rounded-full border border-[#D8D0C2] bg-white hover:border-[#2F614A] hover:bg-[#FAF7F2] text-[#1F513F] text-xs font-semibold transition cursor-pointer"
                >
                  WhatsApp
                </button>
                <NuxtLink
                  :to="`/bayar?merchantId=${merchant.id}`"
                  class="py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-center text-xs font-semibold shadow-xs shadow-[#F06A47]/25 transition"
                >
                  Bayar
                </NuxtLink>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <!-- Footer Satu Baris Ringkas -->
    <footer class="bg-[#164234] text-[#CBE0D6] mt-8">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <p><strong class="text-white">MyPajak</strong> &middot; Direktori UMKM &amp; Layanan Pajak Lokal</p>
        <div class="flex flex-wrap items-center gap-4">
          <NuxtLink to="/pengingat" class="hover:text-white transition">Pengingat</NuxtLink>
          <NuxtLink to="/peta" class="hover:text-white transition">Peta</NuxtLink>
          <NuxtLink to="/bayar" class="hover:text-white transition">Bayar</NuxtLink>
          <NuxtLink to="/lapor-pajak" class="hover:text-white transition">Lapor Pajak</NuxtLink>
          <NuxtLink to="/register-merchant" class="hover:text-white transition">Tambah Usaha</NuxtLink>
          <NuxtLink v-if="isAdminUser" to="/admin-pajak" class="hover:text-white transition">Admin Pajak</NuxtLink>
        </div>
      </div>
    </footer>
    </div>

    <!-- MODAL 1: Pemesanan Cepat via WhatsApp -->
    <div
      v-if="activeMerchant"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-order-title"
      @click.self="closeOrderModal"
    >
      <div class="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#D4E4F0] overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 bg-[#1F513F] text-white flex items-start justify-between gap-3">
          <div>
            <p class="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[#7DD3FC]">
              PEMESANAN CEPAT VIA WHATSAPP
            </p>
            <h3 id="quick-order-title" class="font-display text-lg font-extrabold leading-snug mt-0.5">
              {{ activeMerchant.name }}
            </h3>
            <p class="text-xs text-sky-100/90 mt-0.5">
              {{ activeMerchant.category }} &middot; {{ activeMerchant.district }}
            </p>
          </div>
          <button type="button" @click="closeOrderModal" class="p-1.5 rounded-lg text-sky-100 hover:bg-white/15 cursor-pointer">
            ✕
          </button>
        </div>

        <form novalidate @submit.prevent="handleQuickOrderSubmit" class="p-6 space-y-4 overflow-y-auto">
          <div v-if="!activeMerchant.isOpen" class="p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-xs text-[#92400E]">
            Mitra ini sedang berstatus <strong>Tutup</strong>. Anda tetap dapat mengirim pesan untuk penjadwalan pesanan.
          </div>

          <div>
            <label for="order-service" class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1.5">
              Pilih Layanan / Produk <span class="text-red-500">*</span>
            </label>
            <select
              id="order-service"
              v-model="orderForm.selectedServiceName"
              @change="clearOrderError('selectedServiceName')"
              class="w-full px-3.5 py-2.5 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            >
              <option v-for="(service, idx) in activeMerchant.services" :key="idx" :value="service.name">
                {{ service.name }} — {{ formatRupiah(service.price) }}
              </option>
            </select>
            <p v-if="orderErrors.selectedServiceName" class="text-xs text-red-600 mt-1">
              {{ orderErrors.selectedServiceName }}
            </p>
          </div>

          <div>
            <label for="order-name" class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1.5">
              Nama Pemesan <span class="text-red-500">*</span>
            </label>
            <input
              id="order-name"
              v-model="orderForm.customerName"
              type="text"
              placeholder="Contoh: Budi Santoso"
              @input="clearOrderError('customerName')"
              class="w-full px-3.5 py-2.5 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            />
            <p v-if="orderErrors.customerName" class="text-xs text-red-600 mt-1">
              {{ orderErrors.customerName }}
            </p>
          </div>

          <div>
            <label for="order-address" class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1.5">
              Alamat / Patokan Lokasi <span class="text-red-500">*</span>
            </label>
            <textarea
              id="order-address"
              v-model="orderForm.address"
              rows="2"
              placeholder="Contoh: Jl. Melati No. 12, depan Masjid Al-Ikhlas"
              @input="clearOrderError('address')"
              class="w-full px-3.5 py-2.5 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            ></textarea>
            <p v-if="orderErrors.address" class="text-xs text-red-600 mt-1">
              {{ orderErrors.address }}
            </p>
          </div>

          <div>
            <label for="order-notes" class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1.5">
              Catatan Tambahan <span class="font-normal text-[#7A96AA]">(Opsional)</span>
            </label>
            <textarea
              id="order-notes"
              v-model="orderForm.notes"
              rows="2"
              placeholder="Contoh: Mohon datang jam 14.00 / tidak pedas"
              class="w-full px-3.5 py-2.5 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            ></textarea>
          </div>

          <div class="pt-3 flex items-center justify-end gap-2.5 border-t border-[#EFEAE0]">
            <button type="button" @click="closeOrderModal" class="px-4 py-2 text-xs font-semibold text-[#52675E] hover:bg-[#FAF7F2] rounded-full cursor-pointer">
              Batal
            </button>
            <button type="submit" class="px-5 py-2 bg-[#2F614A] hover:bg-[#1F513F] text-white text-xs font-semibold rounded-full shadow-xs cursor-pointer">
              Lanjut ke WhatsApp &rarr;
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: Ulasan & Rating Pelanggan -->
    <div
      v-if="reviewMerchant"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="closeReviewModal"
    >
      <div class="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#D4E4F0] overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 bg-[#1F513F] text-white flex items-start justify-between gap-3">
          <div>
            <p class="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[#7DD3FC]">
              ULASAN PELANGGAN
            </p>
            <h3 class="font-display text-lg font-extrabold">{{ reviewMerchant.name }}</h3>
            <p class="text-xs text-sky-100 mt-0.5">
              ★ {{ reviewMerchant.rating.toFixed(1) }} ({{ reviewMerchant.reviewCount }} ulasan)
            </p>
          </div>
          <button type="button" @click="closeReviewModal" class="p-1.5 text-sky-100 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto">
          <form @submit.prevent="handleReviewSubmit" class="p-4 rounded-lg bg-[#F2F9FD] border border-[#CDE6F5] space-y-3">
            <p class="text-xs font-extrabold uppercase tracking-wider text-[#1F513F]">
              Tulis Pengalaman Anda
            </p>

            <div class="flex items-center gap-1.5">
              <span class="text-xs text-[#527187] mr-1">Rating:</span>
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                @click="reviewForm.rating = star"
                class="text-xl leading-none cursor-pointer transition hover:scale-110"
                :class="star <= reviewForm.rating ? 'text-[#F59E0B]' : 'text-gray-300'"
              >
                ★
              </button>
              <span class="text-xs font-bold text-[#1F513F] ml-1">{{ reviewForm.rating }}/5</span>
            </div>

            <input
              v-model="reviewForm.reviewerName"
              type="text"
              placeholder="Nama Anda"
              class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            />
            <textarea
              v-model="reviewForm.comment"
              rows="2"
              placeholder="Ceritakan kualitas layanan atau produk mitra ini..."
              class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            ></textarea>

            <p v-if="reviewError" class="text-xs text-red-600">{{ reviewError }}</p>
            <p v-if="reviewSuccess" class="text-xs text-[#1F513F] font-bold">{{ reviewSuccess }}</p>

            <button
              type="submit"
              :disabled="isSubmittingReview"
              class="px-5 py-2 bg-[#2F614A] hover:bg-[#1F513F] disabled:opacity-50 text-white text-xs font-semibold rounded-full transition cursor-pointer"
            >
              {{ isSubmittingReview ? 'Mengirim...' : 'Kirim Ulasan' }}
            </button>
          </form>

          <div class="space-y-3">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A96AA]">
              ULASAN TERBARU
            </p>
            <p v-if="!reviewMerchant.reviews || reviewMerchant.reviews.length === 0" class="text-xs text-[#527187] py-4 text-center">
              Belum ada ulasan tertulis. Jadilah yang pertama mengulas!
            </p>
            <div
              v-for="rev in reviewMerchant.reviews"
              :key="rev.id"
              class="p-3.5 rounded-lg border border-[#E2EDF5] bg-[#FAFDFF]"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-bold text-[#1F513F]">{{ rev.reviewerName }}</p>
                <span class="text-xs font-semibold text-[#F59E0B]">{{ '★'.repeat(rev.rating) }}</span>
              </div>
              <p class="text-xs text-[#3F5D73] mt-1 leading-relaxed">{{ rev.comment }}</p>
              <p class="text-[10px] text-[#7A96AA] mt-1">{{ formatShortDate(rev.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 3: Kalkulator & Lapor Pajak UMKM -->
    <div
      v-if="isTaxModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="isTaxModalOpen = false"
    >
      <div class="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#D4E4F0] overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 bg-[#1F513F] text-white flex items-center justify-between">
          <div>
            <p class="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[#7DD3FC]">
              PP NO. 55 TAHUN 2022
            </p>
            <h3 class="font-display text-lg font-extrabold">Kalkulator &amp; Lapor Pajak UMKM</h3>
          </div>
          <button type="button" @click="isTaxModalOpen = false" class="p-1.5 text-sky-100 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <div v-if="submittedBillingResult" class="p-6 space-y-4 text-center">
          <div class="w-12 h-12 rounded-full bg-[#EAF6FC] text-[#1F513F] flex items-center justify-center mx-auto text-xl font-bold">
            ✓
          </div>
          <div>
            <h4 class="font-display text-lg font-extrabold text-[#1F513F]">Laporan Pajak Terkirim!</h4>
            <p class="text-xs text-[#527187] mt-1">
              Setoran untuk <strong>{{ submittedBillingResult.merchantName }}</strong> kini menunggu verifikasi Admin Pajak.
            </p>
          </div>
          <div class="p-4 rounded-lg bg-[#F2F9FD] border border-[#CDE6F5] space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-wider text-[#527187]">Kode Billing</p>
            <p class="font-mono font-bold text-lg text-[#1F513F]">
              {{ submittedBillingResult.billingCode }}
            </p>
            <p class="text-xs font-bold text-[#5DB3E5]">
              Total: {{ formatRupiah(submittedBillingResult.taxAmount) }}
            </p>
          </div>
          <div class="flex items-center justify-center gap-2 pt-2">
            <NuxtLink
              to="/admin-pajak"
              @click="isTaxModalOpen = false"
              class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1F513F] bg-[#EAF6FC] hover:bg-[#D8EFFB] rounded-md"
            >
              Cek di Admin Pajak
            </NuxtLink>
            <button
              type="button"
              @click="isTaxModalOpen = false"
              class="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#1F513F] hover:bg-[#2F6FA9] rounded-md cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>

        <form v-else novalidate @submit.prevent="submitSelfTaxFiling" class="p-6 space-y-3.5 overflow-y-auto">
          <p v-if="taxError" class="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
            {{ taxError }}
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Pilih Mitra Usaha</label>
              <select
                v-model="taxForm.selectedMerchantId"
                @change="handleTaxMerchantChange"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              >
                <option v-for="m in merchants" :key="m.id" :value="String(m.id)">{{ m.name }}</option>
                <option value="manual">+ Input Manual</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Nama Usaha *</label>
              <input
                v-model="taxForm.merchantName"
                type="text"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">NPWP / NIK (15–16 digit) *</label>
              <input
                v-model="taxForm.npwp"
                type="text"
                inputmode="numeric"
                placeholder="3273011508920004"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Masa Pajak *</label>
              <input
                v-model="taxForm.period"
                type="month"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Jenis Pajak</label>
              <select
                v-model="taxForm.taxType"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              >
                <option v-for="t in TAX_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <div v-if="isTaxPercentage">
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Omzet Bruto (Rp)</label>
              <input
                v-model.number="taxForm.grossRevenue"
                type="number"
                min="100000"
                step="50000"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
            </div>
            <div v-else>
              <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Nominal Retribusi (Rp)</label>
              <input
                v-model.number="taxForm.flatAmount"
                type="number"
                min="10000"
                step="5000"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-[#35556D] mb-1">Metode Pembayaran</label>
            <select
              v-model="taxForm.paymentMethod"
              class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
            >
              <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>

          <div class="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7E0D3] flex items-center justify-between">
            <span class="text-xs font-bold text-[#1F513F]">Estimasi Pajak Terutang</span>
            <span class="text-lg font-bold text-[#F06A47]">
              {{ formatRupiah(estimatedTaxPayable) }}
            </span>
          </div>

          <div class="pt-2 border-t border-[#EFEAE0] flex justify-end gap-2">
            <button type="button" @click="isTaxModalOpen = false" class="px-4 py-2 text-xs font-semibold text-[#52675E] hover:bg-[#FAF7F2] rounded-full cursor-pointer">
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSubmittingTax"
              class="px-5 py-2 text-xs font-semibold text-white bg-[#F06A47] hover:bg-[#DC5736] disabled:opacity-50 rounded-full cursor-pointer"
            >
              {{ isSubmittingTax ? 'Mengirim...' : 'Kirim & Buat Billing' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 4: Pusat Pengingat Bayar (Ingat untuk Bayar) -->
    <div
      v-if="isReminderModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164234]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      @click.self="isReminderModalOpen = false"
    >
      <div class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#EAE4D9] overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 hero-surface text-white flex items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold tracking-wider uppercase text-[#FDE68A]">
              Pengingat Pembayaran
            </p>
            <h3 class="text-lg font-bold">
              Pusat Pengingat Tagihan &amp; Pajak ({{ activeReminderCount }} Aktif)
            </h3>
          </div>
          <button type="button" @click="isReminderModalOpen = false" class="p-1.5 text-white/80 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto">
          <!-- Aktifkan Notifikasi Browser -->
          <div class="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7E0D3] flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-[#445B51]">
              <p class="font-semibold text-[#1F513F]">Notifikasi Pengingat Otomatis</p>
              <p v-if="browserNotifStatus" class="text-[#2F614A] font-semibold mt-0.5">
                {{ browserNotifStatus }}
              </p>
              <p v-else class="mt-0.5">
                Aktifkan notifikasi browser agar langsung diingatkan saat tagihan mendekati jatuh tempo.
              </p>
            </div>
            <button
              type="button"
              @click="triggerBrowserNotification"
              class="px-4 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              Aktifkan Notifikasi
            </button>
          </div>

          <!-- Form Tambah Pengingat Baru -->
          <form @submit.prevent="submitNewReminder" class="p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9] space-y-3">
            <p class="text-xs font-bold text-[#1F513F]">
              + Tambah Pengingat Bayar Baru
            </p>

            <p v-if="reminderError" class="text-xs text-red-600 font-semibold">{{ reminderError }}</p>
            <p v-if="reminderNotice" class="text-xs text-emerald-700 font-semibold">{{ reminderNotice }}</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                v-model="reminderForm.title"
                type="text"
                placeholder="Judul tagihan (mis. Bayar Pajak PB1)"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
              <select
                v-model="reminderForm.category"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              >
                <option value="Pajak UMKM">Pajak UMKM</option>
                <option value="Tagihan Jasa">Tagihan Jasa</option>
                <option value="Langganan Katering">Langganan Katering</option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                v-model.number="reminderForm.amount"
                type="number"
                min="1000"
                step="5000"
                placeholder="Nominal (Rp)"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
              <input
                v-model="reminderForm.dueDate"
                type="date"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
              <input
                v-model="reminderForm.whatsapp"
                type="tel"
                placeholder="No. WA (628...)"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-md bg-white focus:ring-2 focus:ring-[#5DB3E5] focus:outline-none"
              />
            </div>

            <div class="flex items-center justify-end">
              <button
                type="submit"
                :disabled="isSavingReminder"
                class="px-4 py-2 rounded-md bg-[#1F513F] hover:bg-[#2F6FA9] disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                {{ isSavingReminder ? 'Menyimpan...' : 'Simpan Pengingat' }}
              </button>
            </div>
          </form>

          <!-- Daftar Pengingat -->
          <div class="space-y-2.5">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A96AA]">
              DAFTAR PENGINGAT BAYAR ({{ reminders.length }})
            </p>
            <div
              v-for="rem in reminders"
              :key="rem.id"
              :class="[
                'p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                rem.status === 'Selesai'
                  ? 'bg-gray-50 border-gray-200 opacity-75'
                  : 'bg-white border-[#D4E4F0]'
              ]"
            >
              <div class="space-y-0.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase',
                      rem.status === 'Selesai'
                        ? 'bg-emerald-100 text-emerald-800'
                        : getDaysUntil(rem.dueDate) <= 2
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#F59E0B] text-white'
                    ]"
                  >
                    {{ rem.status === 'Selesai' ? 'Sudah Dibayar' : getDueLabel(rem.dueDate) }}
                  </span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EAF6FC] text-[#1F513F]">
                    {{ rem.category }}
                  </span>
                </div>
                <p class="font-bold text-sm text-[#1F513F]" :class="{ 'line-through': rem.status === 'Selesai' }">
                  {{ rem.title }}
                </p>
                <p class="text-xs text-[#527187]">
                  <strong class="text-[#1F513F]">{{ formatRupiah(rem.amount) }}</strong>
                  &middot; Jatuh tempo {{ rem.dueDate }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <NuxtLink
                  v-if="rem.status === 'Aktif'"
                  :to="
                    rem.category === 'Pajak UMKM'
                      ? `/bayar?mode=pajak&reminderId=${rem.id}`
                      : `/bayar?merchantId=${rem.merchantId ?? ''}&reminderId=${rem.id}`
                  "
                  @click="isReminderModalOpen = false"
                  class="px-2.5 py-1.5 rounded bg-[#1F513F] hover:bg-[#2F6FA9] text-white text-[11px] font-bold"
                >
                  Bayar
                </NuxtLink>
                <button
                  v-if="rem.status === 'Aktif'"
                  type="button"
                  @click="sendReminderToWa(rem)"
                  class="px-2.5 py-1.5 rounded bg-[#5DB3E5] text-white text-[11px] font-bold cursor-pointer"
                >
                  WA
                </button>
                <button
                  type="button"
                  @click="toggleReminderDone(rem)"
                  class="px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer"
                >
                  {{ rem.status === 'Aktif' ? '✓ Selesai' : 'Aktifkan' }}
                </button>
                <button
                  type="button"
                  @click="removeReminder(rem.id)"
                  class="px-2 py-1.5 rounded text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
