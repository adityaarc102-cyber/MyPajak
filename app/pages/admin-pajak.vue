<script setup lang="ts">
definePageMeta({
  middleware: 'auth-admin'
})

type TaxType =
  | 'PPh Final UMKM (0,5%)'
  | 'Pajak Daerah / Restoran (PB1 10%)'
  | 'Retribusi Daerah'

type TaxStatus =
  | 'Menunggu Verifikasi'
  | 'Terverifikasi (Lunas)'
  | 'Ditolak'

type PaymentMethod =
  | 'QRIS'
  | 'Virtual Account BCA'
  | 'Virtual Account BRI'
  | 'Virtual Account Mandiri'
  | 'Transfer Bank'

type AdminTab = 'overview' | 'compliance' | 'taxes' | 'archive' | 'maps' | 'merchants'

interface MerchantOption {
  id: number
  name: string
  category: string
  district: string
  address: string
  latitude: number
  longitude: number
  openingHours: string
  nextTaxDueDate: string
  estimatedNextTax: number
  whatsapp: string
  isVerified: boolean
  isOpen: boolean
  rating: number
  reviewCount: number
}

interface MerchantsApiResponse {
  success: boolean
  total: number
  data: MerchantOption[]
}

interface TaxRecord {
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

interface MonthlyBudgetItem {
  period: string
  label: string
  targetAmount: number
  collectedAmount: number
  pendingAmount: number
  transactionCount: number
  achievementPercent: number
}

interface TaxesApiResponse {
  success: boolean
  total: number
  summary: {
    totalCollected: number
    pendingAmount: number
    totalCount: number
    archivedCount: number
    verifiedCount: number
    pendingCount: number
    rejectedCount: number
    currentMonthCollected: number
    currentMonthTarget: number
    currentMonthLabel: string
  }
  monthlyBudget: MonthlyBudgetItem[]
  data: TaxRecord[]
}

interface AuthMeResponse {
  authenticated: boolean
  user: {
    name: string
    email: string
    role: string
    nip?: string
    position?: string
    department?: string
  } | null
}

interface TaxSettings {
  monthlyTargetAmount: number
  latePenaltyPercentPerMonth: number
  taxOfficeName: string
  updatedAt: string
}

interface TaxAuditEntry {
  id: number
  action: string
  targetName: string
  detail: string
  actor: string
  createdAt: string
}

interface TaxSettingsApiResponse {
  success: boolean
  data: TaxSettings
}

interface TaxAuditApiResponse {
  success: boolean
  total: number
  data: TaxAuditEntry[]
}

useHead({
  title: 'Admin Pajak UMKM — MyPajak'
})

const TAX_TYPES: TaxType[] = [
  'PPh Final UMKM (0,5%)',
  'Pajak Daerah / Restoran (PB1 10%)',
  'Retribusi Daerah'
]

const TAX_STATUSES: TaxStatus[] = [
  'Menunggu Verifikasi',
  'Terverifikasi (Lunas)',
  'Ditolak'
]

const PAYMENT_METHODS: PaymentMethod[] = [
  'QRIS',
  'Virtual Account BCA',
  'Virtual Account BRI',
  'Virtual Account Mandiri',
  'Transfer Bank'
]

const [
  { data: taxesRes, status: taxesStatus, refresh: refreshTaxes },
  { data: merchantsRes, refresh: refreshMerchants },
  { data: authRes },
  { data: settingsRes, refresh: refreshSettings },
  { data: auditRes, refresh: refreshAudit }
] = await Promise.all([
  useFetch<TaxesApiResponse>('/api/taxes', { key: 'admin-taxes-list' }),
  useFetch<MerchantsApiResponse>('/api/merchants', { key: 'merchants-list' }),
  useFetch<AuthMeResponse>('/api/auth/me'),
  useFetch<TaxSettingsApiResponse>('/api/taxes/settings', { key: 'tax-settings' }),
  useFetch<TaxAuditApiResponse>('/api/taxes/audit', { key: 'tax-audit-logs' })
])

const taxSettings = computed<TaxSettings>(
  () =>
    settingsRes.value?.data ?? {
      monthlyTargetAmount: 4000000,
      latePenaltyPercentPerMonth: 2,
      taxOfficeName: 'Unit Pelayanan Pajak Daerah — MyPajak',
      updatedAt: ''
    }
)
const auditLogs = computed<TaxAuditEntry[]>(() => auditRes.value?.data ?? [])

// 1. Kepatuhan Wajib Pajak Bulan Berjalan
const activePeriodYm = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

const complianceSummary = computed(() => {
  const paidIds = new Set<number>()
  for (const r of allRecords.value) {
    if (r.merchantId && r.status === 'Terverifikasi (Lunas)' && r.period === activePeriodYm.value) {
      paidIds.add(r.merchantId)
    }
  }
  const compliant = merchants.value.filter((m) => paidIds.has(m.id))
  const nonCompliant = merchants.value.filter((m) => !paidIds.has(m.id))
  const ratio = merchants.value.length > 0 ? Math.round((compliant.length / merchants.value.length) * 100) : 0
  return { compliant, nonCompliant, ratio }
})

// 2. Rekap Penerimaan per Jenis Pajak & per Kecamatan
const revenueByTaxType = computed(() => {
  const map = new Map<string, { amount: number; count: number }>()
  for (const t of TAX_TYPES) map.set(t, { amount: 0, count: 0 })
  for (const r of allRecords.value) {
    if (r.status === 'Terverifikasi (Lunas)') {
      const cur = map.get(r.taxType) ?? { amount: 0, count: 0 }
      cur.amount += r.taxAmount
      cur.count += 1
      map.set(r.taxType, cur)
    }
  }
  const total = Math.max(1, summary.value.totalCollected)
  return Array.from(map.entries()).map(([type, stat]) => ({
    type,
    amount: stat.amount,
    count: stat.count,
    percent: Math.round((stat.amount / total) * 100)
  }))
})

const revenueByDistrict = computed(() => {
  const map = new Map<string, { amount: number; count: number }>()
  for (const r of allRecords.value) {
    if (r.status === 'Terverifikasi (Lunas)') {
      const key = r.district || 'Area Lokal'
      const cur = map.get(key) ?? { amount: 0, count: 0 }
      cur.amount += r.taxAmount
      cur.count += 1
      map.set(key, cur)
    }
  }
  return Array.from(map.entries())
    .map(([district, stat]) => ({ district, amount: stat.amount, count: stat.count }))
    .sort((a, b) => b.amount - a.amount)
})

// 3. Cek Validasi Cepat NTPN / Kode Billing
const ntpnLookupInput = ref('')
const ntpnLookupResult = computed<TaxRecord | null>(() => {
  const q = ntpnLookupInput.value.trim().toLowerCase()
  if (q.length < 4) return null
  return (
    allRecords.value.find(
      (r) => r.billingCode.toLowerCase() === q || (r.ntpn ?? '').toLowerCase() === q
    ) ?? null
  )
})

// 4. Form Pengaturan Target Anggaran & Tarif Denda
const settingsForm = reactive({
  monthlyTargetAmount: taxSettings.value.monthlyTargetAmount,
  latePenaltyPercentPerMonth: taxSettings.value.latePenaltyPercentPerMonth,
  taxOfficeName: taxSettings.value.taxOfficeName
})
const isSavingSettings = ref(false)

watch(taxSettings, (val) => {
  settingsForm.monthlyTargetAmount = val.monthlyTargetAmount
  settingsForm.latePenaltyPercentPerMonth = val.latePenaltyPercentPerMonth
  settingsForm.taxOfficeName = val.taxOfficeName
})

const saveTaxSettings = async () => {
  actionError.value = ''
  actionNotice.value = ''
  isSavingSettings.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>('/api/taxes/settings', {
      method: 'PATCH',
      body: {
        monthlyTargetAmount: Number(settingsForm.monthlyTargetAmount),
        latePenaltyPercentPerMonth: Number(settingsForm.latePenaltyPercentPerMonth),
        taxOfficeName: settingsForm.taxOfficeName
      }
    })
    await Promise.all([refreshSettings(), refreshTaxes(), refreshAudit()])
    actionNotice.value = res.message
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    actionError.value = fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal menyimpan pengaturan.'
  } finally {
    isSavingSettings.value = false
  }
}

// 5. Modal STP (Surat Tagihan Pajak) & Kalkulator Denda Keterlambatan
const isStpModalOpen = ref(false)
const stpForm = reactive({
  stpNumber: '',
  merchantId: '' as string,
  merchantName: '',
  district: '',
  whatsapp: '',
  taxType: 'Pajak Daerah / Restoran (PB1 10%)' as TaxType,
  period: activePeriodYm.value,
  principalAmount: 500000,
  monthsLate: 1,
  note: 'Mohon segera melunasi pokok pajak beserta sanksi administrasi dalam waktu 7 hari kerja.'
})

const stpPenaltyAmount = computed(() => {
  const rate = taxSettings.value.latePenaltyPercentPerMonth / 100
  return Math.round(Math.max(0, Number(stpForm.principalAmount) || 0) * rate * Math.max(0, Number(stpForm.monthsLate) || 0))
})

const stpTotalAmount = computed(
  () => Math.max(0, Number(stpForm.principalAmount) || 0) + stpPenaltyAmount.value
)

const openStpModal = (merchant?: MerchantOption) => {
  const rand = Math.floor(1000 + Math.random() * 9000)
  stpForm.stpNumber = `STP/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${rand}`
  if (merchant) {
    stpForm.merchantId = String(merchant.id)
    stpForm.merchantName = merchant.name
    stpForm.district = merchant.district
    stpForm.whatsapp = merchant.whatsapp
    stpForm.taxType =
      merchant.category === 'Kuliner & Katering'
        ? 'Pajak Daerah / Restoran (PB1 10%)'
        : 'PPh Final UMKM (0,5%)'
    stpForm.principalAmount = merchant.estimatedNextTax || 150000
  } else {
    const first = complianceSummary.value.nonCompliant[0] ?? merchants.value[0]
    stpForm.merchantId = first ? String(first.id) : ''
    stpForm.merchantName = first?.name ?? ''
    stpForm.district = first?.district ?? ''
    stpForm.whatsapp = first?.whatsapp ?? ''
    stpForm.principalAmount = first?.estimatedNextTax ?? 250000
  }
  stpForm.monthsLate = 1
  stpForm.period = activePeriodYm.value
  isStpModalOpen.value = true
}

const handleStpMerchantChange = () => {
  const found = merchants.value.find((m) => String(m.id) === stpForm.merchantId)
  if (found) {
    stpForm.merchantName = found.name
    stpForm.district = found.district
    stpForm.whatsapp = found.whatsapp
    stpForm.principalAmount = found.estimatedNextTax || 150000
  }
}

const sendStpViaWhatsapp = async () => {
  if (!stpForm.whatsapp) {
    actionError.value = 'Nomor WhatsApp wajib pajak belum tersedia.'
    return
  }
  const msg = [
    `*SURAT TAGIHAN PAJAK (STP)*`,
    `No: ${stpForm.stpNumber}`,
    `${taxSettings.value.taxOfficeName}`,
    '',
    `Kepada Yth. *${stpForm.merchantName}* (${stpForm.district})`,
    `• Jenis Pajak: ${stpForm.taxType}`,
    `• Masa Pajak: ${formatPeriod(stpForm.period)}`,
    `• Pokok Pajak: ${formatRupiah(stpForm.principalAmount)}`,
    `• Denda Keterlambatan (${stpForm.monthsLate} bln × ${taxSettings.value.latePenaltyPercentPerMonth}%): ${formatRupiah(stpPenaltyAmount.value)}`,
    `• *Total Tagihan: ${formatRupiah(stpTotalAmount.value)}*`,
    '',
    stpForm.note
  ].join('\n')

  try {
    await $fetch('/api/taxes/audit', {
      method: 'POST',
      body: {
        action: 'Penerbitan STP / Teguran',
        targetName: stpForm.merchantName,
        detail: `${stpForm.stpNumber} · Pokok ${formatRupiah(stpForm.principalAmount)} + Denda ${formatRupiah(stpPenaltyAmount.value)} = ${formatRupiah(stpTotalAmount.value)}`,
        actor: adminUser.value.email
      }
    })
    await refreshAudit()
  } catch {
    // Abaikan jika log gagal
  }

  window.open(`https://wa.me/${stpForm.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  actionNotice.value = `STP ${stpForm.stpNumber} untuk ${stpForm.merchantName} telah dicatat dan dibuka di WhatsApp.`
  isStpModalOpen.value = false
}

const printStpDocument = async () => {
  try {
    await $fetch('/api/taxes/audit', {
      method: 'POST',
      body: {
        action: 'Cetak STP / Teguran',
        targetName: stpForm.merchantName,
        detail: `${stpForm.stpNumber} · Total tagihan ${formatRupiah(stpTotalAmount.value)}`,
        actor: adminUser.value.email
      }
    })
    await refreshAudit()
  } catch {
    // Abaikan
  }
  window.print()
}

const formatAuditTime = (iso: string): string => {
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

const activeTab = ref<AdminTab>('overview')
const busyRecordId = ref<number | null>(null)
const busyMerchantId = ref<number | null>(null)
const actionNotice = ref('')
const actionError = ref('')

const adminUser = computed(() =>
  authRes.value?.user ?? {
    name: 'Admin Pajak',
    email: 'admin@mypajak.id',
    role: 'admin_pajak',
    nip: '',
    position: 'Admin Pajak',
    department: ''
  }
)
const allRecords = computed<TaxRecord[]>(() => taxesRes.value?.data ?? [])
const activeRecords = computed<TaxRecord[]>(() => allRecords.value.filter((r) => !r.isArchived))
const archivedRecords = computed<TaxRecord[]>(() => allRecords.value.filter((r) => r.isArchived))
const monthlyBudget = computed<MonthlyBudgetItem[]>(() => taxesRes.value?.monthlyBudget ?? [])
const merchants = computed<MerchantOption[]>(() => merchantsRes.value?.data ?? [])
const isLoading = computed(() => taxesStatus.value === 'pending')

const summary = computed(
  () =>
    taxesRes.value?.summary ?? {
      totalCollected: 0,
      pendingAmount: 0,
      totalCount: 0,
      archivedCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      currentMonthCollected: 0,
      currentMonthTarget: 4000000,
      currentMonthLabel: '-'
    }
)

const merchantById = computed<Map<number, MerchantOption>>(() => {
  const map = new Map<number, MerchantOption>()
  for (const m of merchants.value) {
    map.set(m.id, m)
  }
  return map
})

// Rumah Makan (Kuliner & Katering) yang selanjutnya akan membayar pajak — urut jatuh tempo terdekat
const upcomingRestaurants = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return merchants.value
    .filter((m) => m.category === 'Kuliner & Katering')
    .map((m) => {
      const due = new Date(`${m.nextTaxDueDate}T00:00:00`)
      const diffMs = due.getTime() - today.getTime()
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return {
        ...m,
        daysLeft
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
})

// Filter Setoran Aktif
const searchQuery = ref('')
const filterStatus = ref<string>('Semua')
const filterTaxType = ref<string>('Semua')

const filteredActiveRecords = computed<TaxRecord[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return activeRecords.value.filter((item) => {
    if (filterStatus.value !== 'Semua' && item.status !== filterStatus.value) return false
    if (filterTaxType.value !== 'Semua' && item.taxType !== filterTaxType.value) return false
    if (!q) return true
    return (
      item.merchantName.toLowerCase().includes(q) ||
      item.district.toLowerCase().includes(q) ||
      item.npwp.toLowerCase().includes(q) ||
      item.billingCode.toLowerCase().includes(q) ||
      (item.ntpn ?? '').toLowerCase().includes(q)
    )
  })
})

// Filter Arsip
const archiveSearch = ref('')
const archivePeriod = ref('Semua')

const archivePeriods = computed<string[]>(() => {
  const set = new Set(archivedRecords.value.map((r) => r.period))
  return Array.from(set).sort().reverse()
})

const filteredArchivedRecords = computed<TaxRecord[]>(() => {
  const q = archiveSearch.value.trim().toLowerCase()
  return archivedRecords.value.filter((item) => {
    if (archivePeriod.value !== 'Semua' && item.period !== archivePeriod.value) return false
    if (!q) return true
    return (
      item.merchantName.toLowerCase().includes(q) ||
      item.npwp.toLowerCase().includes(q) ||
      item.billingCode.toLowerCase().includes(q) ||
      (item.ntpn ?? '').toLowerCase().includes(q)
    )
  })
})

// State Maps Lokasi Wajib Pajak
const selectedMapMerchantId = ref<number | null>(null)

const activeMapMerchant = computed<MerchantOption | null>(() => {
  if (merchants.value.length === 0) return null
  if (selectedMapMerchantId.value !== null) {
    const found = merchants.value.find((m) => m.id === selectedMapMerchantId.value)
    if (found) return found
  }
  return upcomingRestaurants.value[0] ?? merchants.value[0] ?? null
})

const mapEmbedUrl = computed(() => {
  const m = activeMapMerchant.value
  if (!m) return ''
  return `https://www.google.com/maps?q=${m.latitude},${m.longitude}&z=15&output=embed`
})

const getGoogleMapsDirectionUrl = (m: MerchantOption): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`

const openMerchantInMapsTab = (merchant: MerchantOption) => {
  selectedMapMerchantId.value = merchant.id
  activeTab.value = 'maps'
}

const hasVerifiedTax = (merchantId: number): boolean =>
  allRecords.value.some((r) => r.merchantId === merchantId && r.status === 'Terverifikasi (Lunas)')

// Format Helpers
const formatRupiah = (amount: number | string | null): string => {
  if (amount === null || String(amount).trim() === '') return 'Rp 0'
  const num = Number(amount)
  if (!Number.isFinite(num) || num < 0) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num)
}

const formatPeriod = (period: string): string => {
  if (!/^\d{4}-\d{2}$/.test(period)) return period
  const [y, m] = period.split('-')
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(
    new Date(Number(y), Number(m) - 1, 1)
  )
}

const formatFullDate = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d)
}

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '-'
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

const getDueBadgeText = (daysLeft: number): string => {
  if (daysLeft < 0) return `Terlambat ${Math.abs(daysLeft)} hari`
  if (daysLeft === 0) return 'Jatuh Tempo Hari Ini'
  return `H-${daysLeft} (${daysLeft} hari lagi)`
}

// Logout Admin
const handleLogout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login?loggedOut=1', { replace: true })
}

// Aksi Verifikasi Setoran
const approveRecord = async (record: TaxRecord) => {
  actionNotice.value = ''
  actionError.value = ''
  busyRecordId.value = record.id

  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/taxes/${record.id}`, {
      method: 'PATCH',
      body: {
        status: 'Terverifikasi (Lunas)',
        adminNote: 'Terverifikasi lunas oleh Admin Pajak.'
      }
    })
    await Promise.all([refreshTaxes(), refreshAudit()])
    actionNotice.value = res.message
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    actionError.value = fetchErr?.data?.statusMessage || 'Gagal memverifikasi setoran.'
  } finally {
    busyRecordId.value = null
  }
}

// Aksi Arsipkan / Pulihkan dari Arsip
const toggleArchiveRecord = async (record: TaxRecord, archive: boolean) => {
  actionNotice.value = ''
  actionError.value = ''
  busyRecordId.value = record.id

  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/taxes/${record.id}`, {
      method: 'PATCH',
      body: { isArchived: archive }
    })
    await Promise.all([refreshTaxes(), refreshAudit()])
    actionNotice.value = res.message
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    actionError.value = fetchErr?.data?.statusMessage || 'Gagal memperbarui status arsip.'
  } finally {
    busyRecordId.value = null
  }
}

// Toggle Verifikasi & Buka/Tutup Mitra UMKM
const toggleMerchantStatus = async (
  merchant: MerchantOption,
  updates: { isVerified?: boolean; isOpen?: boolean }
) => {
  actionNotice.value = ''
  actionError.value = ''
  busyMerchantId.value = merchant.id

  try {
    const res = await $fetch<{ success: boolean; message: string }>(
      `/api/merchants/${merchant.id}`,
      { method: 'PATCH', body: updates }
    )
    await refreshMerchants()
    actionNotice.value = res.message
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    actionError.value = fetchErr?.data?.statusMessage || 'Gagal memperbarui status mitra.'
  } finally {
    busyMerchantId.value = null
  }
}

// WhatsApp Pengingat Pajak
const openTaxReminderWa = (record: TaxRecord) => {
  const linked = record.merchantId ? merchantById.value.get(record.merchantId) : undefined
  if (!linked?.whatsapp) {
    actionError.value = `Nomor WhatsApp untuk "${record.merchantName}" belum tersedia.`
    return
  }

  const lines = [
    `Halo *${record.merchantName}*,`,
    '',
    `Kami dari *Admin Pajak MyPajak* mengingatkan status setoran pajak Anda:`,
    `• *Kode Billing:* ${record.billingCode}`,
    `• *Jenis Pajak:* ${record.taxType}`,
    `• *Masa Pajak:* ${formatPeriod(record.period)}`,
    `• *Nominal:* ${formatRupiah(record.taxAmount)}`,
    `• *Status:* ${record.status}`,
    '',
    'Mohon segera menyelesaikan pembayaran/konfirmasi. Terima kasih!'
  ]
  window.open(`https://wa.me/${linked.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer')
}

const openUpcomingRestaurantReminderWa = (restaurant: MerchantOption & { daysLeft?: number }) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${restaurant.nextTaxDueDate}T00:00:00`)
  const computedDaysLeft =
    typeof restaurant.daysLeft === 'number'
      ? restaurant.daysLeft
      : Number.isNaN(due.getTime())
        ? 0
        : Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const lines = [
    `Halo *${restaurant.name}*,`,
    '',
    `Pengingat dari *Admin Pajak MyPajak* terkait jadwal pembayaran pajak berikutnya:`,
    `• *Jatuh Tempo:* ${formatFullDate(restaurant.nextTaxDueDate)} (${getDueBadgeText(computedDaysLeft)})`,
    `• *Estimasi PB1 / Pajak:* ${formatRupiah(restaurant.estimatedNextTax)}`,
    `• *Alamat Terdaftar:* ${restaurant.address}`,
    '',
    'Mohon mempersiapkan laporan omzet dan pembayaran tepat waktu. Terima kasih!'
  ]
  window.open(`https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer')
}

// Modal Tolak Setoran
const rejectTarget = ref<TaxRecord | null>(null)
const rejectReason = ref('')
const rejectError = ref('')
const isRejecting = ref(false)

const openRejectModal = (record: TaxRecord) => {
  rejectTarget.value = record
  rejectReason.value = record.adminNote || ''
  rejectError.value = ''
}

const submitReject = async () => {
  if (!rejectTarget.value) return
  if (rejectReason.value.trim().length < 5) {
    rejectError.value = 'Alasan penolakan minimal 5 karakter.'
    return
  }
  isRejecting.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>(
      `/api/taxes/${rejectTarget.value.id}`,
      {
        method: 'PATCH',
        body: { status: 'Ditolak', adminNote: rejectReason.value.trim() }
      }
    )
    await Promise.all([refreshTaxes(), refreshAudit()])
    actionNotice.value = res.message
    rejectTarget.value = null
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    rejectError.value = fetchErr?.data?.statusMessage || 'Gagal menolak setoran.'
  } finally {
    isRejecting.value = false
  }
}

// Modal Input Setoran Baru (bisa dipicu langsung dari daftar Rumah Makan berikutnya!)
const isCreateModalOpen = ref(false)
const isCreating = ref(false)
const createErrors = reactive<Record<string, string>>({})

const currentPeriod = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

const createForm = reactive({
  selectedMerchant: 'manual',
  merchantName: '',
  district: '',
  npwp: '',
  taxType: 'Pajak Daerah / Restoran (PB1 10%)' as TaxType,
  period: currentPeriod.value,
  grossRevenue: 18500000 as number | null,
  flatAmount: 50000 as number | null,
  paymentMethod: 'QRIS' as PaymentMethod,
  status: 'Terverifikasi (Lunas)' as TaxStatus,
  adminNote: ''
})

const isCreatePercentageTax = computed(() => createForm.taxType !== 'Retribusi Daerah')
const createTaxRate = computed(() =>
  createForm.taxType === 'PPh Final UMKM (0,5%)'
    ? 0.5
    : createForm.taxType === 'Pajak Daerah / Restoran (PB1 10%)'
      ? 10
      : 0
)

const calculatedCreateAmount = computed(() => {
  if (isCreatePercentageTax.value) {
    const rev = Number(createForm.grossRevenue)
    if (!Number.isFinite(rev) || rev <= 0) return 0
    return Math.round(rev * (createTaxRate.value / 100))
  }
  const flat = Number(createForm.flatAmount)
  return Number.isFinite(flat) && flat > 0 ? Math.round(flat) : 0
})

const openCreateModal = (prefillMerchant?: MerchantOption) => {
  Object.keys(createErrors).forEach((k) => delete createErrors[k])
  const target = prefillMerchant ?? merchants.value[0]
  createForm.selectedMerchant = target ? String(target.id) : 'manual'
  createForm.merchantName = target?.name ?? ''
  createForm.district = target?.district ?? ''
  createForm.npwp = ''
  createForm.taxType =
    target?.category === 'Kuliner & Katering'
      ? 'Pajak Daerah / Restoran (PB1 10%)'
      : 'PPh Final UMKM (0,5%)'
  createForm.period = currentPeriod.value
  createForm.grossRevenue =
    target?.category === 'Kuliner & Katering' && target.estimatedNextTax > 0
      ? target.estimatedNextTax * 10
      : 15000000
  createForm.flatAmount = 50000
  createForm.paymentMethod = 'QRIS'
  createForm.status = 'Terverifikasi (Lunas)'
  createForm.adminNote = ''
  isCreateModalOpen.value = true
}

const handleMerchantPick = () => {
  if (createForm.selectedMerchant === 'manual') {
    createForm.merchantName = ''
    createForm.district = ''
    return
  }
  const found = merchants.value.find((m) => String(m.id) === createForm.selectedMerchant)
  if (found) {
    createForm.merchantName = found.name
    createForm.district = found.district
    if (found.category === 'Kuliner & Katering') {
      createForm.taxType = 'Pajak Daerah / Restoran (PB1 10%)'
    }
  }
}

const submitCreateTax = async () => {
  Object.keys(createErrors).forEach((k) => delete createErrors[k])
  if (!createForm.merchantName.trim() || createForm.merchantName.trim().length < 3) {
    createErrors.merchantName = 'Nama usaha minimal 3 karakter.'
  }
  const cleanedNpwp = createForm.npwp.replace(/[\s.\-]/g, '')
  if (!/^\d{15,16}$/.test(cleanedNpwp)) {
    createErrors.npwp = 'NPWP / NIK wajib 15–16 digit angka.'
  }
  if (!/^\d{4}-\d{2}$/.test(createForm.period)) {
    createErrors.period = 'Pilih masa pajak yang valid.'
  }
  if (isCreatePercentageTax.value && (!createForm.grossRevenue || Number(createForm.grossRevenue) < 100000)) {
    createErrors.grossRevenue = 'Omzet bruto minimal Rp 100.000.'
  }
  if (!isCreatePercentageTax.value && (!createForm.flatAmount || Number(createForm.flatAmount) < 10000)) {
    createErrors.flatAmount = 'Nominal retribusi minimal Rp 10.000.'
  }
  if (Object.keys(createErrors).length > 0) return

  isCreating.value = true
  try {
    const merchantId =
      createForm.selectedMerchant !== 'manual' ? Number(createForm.selectedMerchant) : null
    const res = await $fetch<{ success: boolean; message: string }>('/api/taxes', {
      method: 'POST',
      body: {
        merchantId: Number.isFinite(merchantId) ? merchantId : null,
        merchantName: createForm.merchantName.trim(),
        district: createForm.district.trim() || 'Area Lokal',
        npwp: cleanedNpwp,
        taxType: createForm.taxType,
        period: createForm.period,
        grossRevenue: isCreatePercentageTax.value ? Number(createForm.grossRevenue) : 0,
        taxAmount: isCreatePercentageTax.value
          ? calculatedCreateAmount.value
          : Number(createForm.flatAmount),
        paymentMethod: createForm.paymentMethod,
        status: createForm.status,
        adminNote: createForm.adminNote.trim()
      }
    })
    await Promise.all([refreshTaxes(), refreshAudit()])
    actionNotice.value = res.message
    isCreateModalOpen.value = false
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    createErrors.submit = fetchErr?.data?.statusMessage || 'Gagal mencatat setoran.'
  } finally {
    isCreating.value = false
  }
}

// Modal Bukti & Hapus
const activeDetail = ref<TaxRecord | null>(null)
const deleteTarget = ref<TaxRecord | null>(null)
const isDeleting = ref(false)

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>(
      `/api/taxes/${deleteTarget.value.id}`,
      { method: 'DELETE' }
    )
    await Promise.all([refreshTaxes(), refreshAudit()])
    actionNotice.value = res.message
    deleteTarget.value = null
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    actionError.value = fetchErr?.data?.statusMessage || 'Gagal menghapus data pajak.'
  } finally {
    isDeleting.value = false
  }
}

// Export CSV
const exportCsv = (rowsData: TaxRecord[], filenamePrefix: string) => {
  if (!import.meta.client || rowsData.length === 0) return
  const headers = [
    'ID',
    'Kode Billing',
    'NTPN',
    'Nama Usaha',
    'Kecamatan',
    'NPWP',
    'Jenis Pajak',
    'Masa Pajak',
    'Omzet Bruto',
    'Nominal Pajak',
    'Metode Bayar',
    'Status',
    'Diarsipkan'
  ]
  const esc = (v: string | number | boolean | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rowsData.map((r) =>
    [
      r.id,
      r.billingCode,
      r.ntpn ?? '-',
      r.merchantName,
      r.district,
      r.npwp,
      r.taxType,
      r.period,
      r.grossRevenue,
      r.taxAmount,
      r.paymentMethod,
      r.status,
      r.isArchived ? 'Ya' : 'Tidak'
    ]
      .map(esc)
      .join(',')
  )
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8;'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${currentPeriod.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const printDetail = () => window.print()
</script>

<template>
  <div class="min-h-screen bg-[#FAF7F2] text-[#213B32] flex flex-col lg:flex-row">
    <AppSidebar active-item="admin" page-title="Admin Pajak" />

    <div class="flex-1 min-w-0 flex flex-col">
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      <!-- Bar Judul & Aksi Cepat Admin Pajak -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-bold text-[#1F513F]">Panel Admin Pajak</h1>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-[11px] font-semibold">
              {{ adminUser.position || 'Admin Pajak' }}<span v-if="adminUser.nip" class="font-mono"> · NIP {{ adminUser.nip }}</span>
            </span>
          </div>
          <p class="text-xs text-[#6B7F75] mt-0.5">
            Petugas aktif: {{ adminUser.name }} ({{ adminUser.email }})
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <NuxtLink
            to="/verifikasi-admin"
            class="nav-instant px-3.5 py-2 rounded-full border border-[#CFE4D4] bg-[#EBF3EC] hover:border-[#0F766E] text-[#1F513F] text-xs sm:text-sm font-semibold"
          >
            Biodata &amp; Akun Admin
          </NuxtLink>
          <button
            type="button"
            @click="openStpModal()"
            class="px-4 py-2 rounded-full border border-[#D8D0C2] bg-white hover:border-[#2F614A] text-[#1F513F] text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Buat STP / Denda
          </button>
          <button
            type="button"
            @click="openCreateModal()"
            class="px-4 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            + Input Setoran
          </button>
        </div>
      </div>
      <!-- Ringkasan Anggaran & Status -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-interactive p-5 bg-white rounded-2xl border border-[#EAE4D9]">
          <p class="text-xs font-medium text-[#6B7F75]">Total Pajak Terkumpul</p>
          <p class="text-2xl font-bold text-[#1F513F] mt-1">
            {{ formatRupiah(summary.totalCollected) }}
          </p>
          <p class="text-xs text-[#7D8F87] mt-1">
            {{ summary.verifiedCount }} setoran lunas
          </p>
        </div>

        <div class="card-interactive p-5 bg-white rounded-2xl border border-[#EAE4D9]">
          <p class="text-xs font-medium text-[#6B7F75]">Anggaran {{ summary.currentMonthLabel }}</p>
          <p class="text-2xl font-bold text-[#2F614A] mt-1">
            {{ formatRupiah(summary.currentMonthCollected) }}
          </p>
          <p class="text-xs text-[#7D8F87] mt-1">
            Target {{ formatRupiah(summary.currentMonthTarget) }}
          </p>
        </div>

        <div class="card-interactive p-5 bg-white rounded-2xl border border-[#EAE4D9]">
          <p class="text-xs font-medium text-[#6B7F75]">Menunggu Verifikasi</p>
          <p class="text-2xl font-bold text-[#F06A47] mt-1">
            {{ summary.pendingCount }} setoran
          </p>
          <p class="text-xs text-[#7D8F87] mt-1">
            Potensi {{ formatRupiah(summary.pendingAmount) }}
          </p>
        </div>

        <div class="card-interactive p-5 bg-white rounded-2xl border border-[#EAE4D9]">
          <p class="text-xs font-medium text-[#6B7F75]">Arsip &amp; Jadwal Rumah Makan</p>
          <p class="text-2xl font-bold text-[#1F513F] mt-1">
            {{ summary.archivedCount }} arsip
          </p>
          <p class="text-xs text-[#7D8F87] mt-1">
            {{ upcomingRestaurants.length }} rumah makan terjadwal
          </p>
        </div>
      </section>

      <!-- Feedback Banners -->
      <div
        v-if="actionNotice"
        role="status"
        class="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3"
      >
        <span>{{ actionNotice }}</span>
        <button type="button" @click="actionNotice = ''" class="text-xs font-bold hover:underline cursor-pointer">
          Tutup
        </button>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3"
      >
        <span>{{ actionError }}</span>
        <button type="button" @click="actionError = ''" class="text-xs font-bold hover:underline cursor-pointer">
          Tutup
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          @click="activeTab = 'overview'"
          :class="[
            'px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer',
            activeTab === 'overview'
              ? 'bg-[#2F614A] text-white border-[#2F614A]'
              : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
          ]"
        >
          Anggaran &amp; Jadwal Rumah Makan
        </button>
        <button
          type="button"
          @click="activeTab = 'compliance'"
          :class="[
            'px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer',
            activeTab === 'compliance'
              ? 'bg-[#2F614A] text-white border-[#2F614A]'
              : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
          ]"
        >
          Kepatuhan, Rekap &amp; Audit ({{ complianceSummary.nonCompliant.length }} Belum Setor)
        </button>
        <button
          type="button"
          @click="activeTab = 'taxes'"
          :class="[
            'px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer',
            activeTab === 'taxes'
              ? 'bg-[#2F614A] text-white border-[#2F614A]'
              : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
          ]"
        >
          Setoran Aktif ({{ activeRecords.length }})
        </button>
        <button
          type="button"
          @click="activeTab = 'archive'"
          :class="[
            'px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer',
            activeTab === 'archive'
              ? 'bg-[#2F614A] text-white border-[#2F614A]'
              : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
          ]"
        >
          Arsip Pajak ({{ archivedRecords.length }})
        </button>
        <button
          type="button"
          @click="activeTab = 'maps'"
          :class="[
            'px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer',
            activeTab === 'maps'
              ? 'bg-[#2F614A] text-white border-[#2F614A]'
              : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
          ]"
        >
          Peta Lokasi
        </button>
        <button
          type="button"
          @click="activeTab = 'merchants'"
          :class="[
            'px-4 py-2 rounded-full text-xs font-semibold border transition cursor-pointer',
            activeTab === 'merchants'
              ? 'bg-[#2F614A] text-white border-[#2F614A]'
              : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#2F614A]'
          ]"
        >
          Verifikasi Mitra ({{ merchants.length }})
        </button>
      </div>

      <!-- TAB 1: ANGGARAN PER BULAN & RUMAH MAKAN PEMBAYAR PAJAK BERIKUTNYA -->
      <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left 7 Cols: Anggaran Pajak yang Didapat per Bulan -->
        <section class="lg:col-span-7 brochure-sheet rounded-2xl p-6 space-y-5">
          <div class="pb-4 border-b border-[#EFEAE0] flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-[#2F614A]">
                Realisasi Penerimaan Daerah
              </p>
              <h2 class="text-lg font-bold text-[#1F513F] mt-0.5">
                Anggaran Pajak Didapat per Bulan
              </h2>
            </div>
            <span class="px-3 py-1 rounded-full bg-[#EBF3EC] text-[#1F513F] text-xs font-semibold">
              Target {{ formatRupiah(taxSettings.monthlyTargetAmount) }}/bln
            </span>
          </div>

          <div class="space-y-3.5">
            <div
              v-for="item in monthlyBudget"
              :key="item.period"
              class="p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9]"
            >
              <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <p class="text-sm font-bold text-[#1F513F]">{{ item.label }}</p>
                  <p class="text-xs text-[#6B7F75]">
                    {{ item.transactionCount }} transaksi
                    <span v-if="item.pendingAmount > 0" class="text-[#D97706] font-semibold">
                      &middot; Pending {{ formatRupiah(item.pendingAmount) }}
                    </span>
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-base font-bold text-[#1F513F]">
                    {{ formatRupiah(item.collectedAmount) }}
                  </p>
                  <p class="text-xs font-semibold text-[#2F614A]">
                    {{ item.achievementPercent }}% dari target
                  </p>
                </div>
              </div>

              <div class="w-full h-2.5 rounded-full bg-[#E7E0D3] overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-[#1F513F] to-[#4A8B6B] transition-all duration-500"
                  :style="{ width: `${Math.max(4, item.achievementPercent)}%` }"
                ></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Right 5 Cols: Rumah Makan yang Selanjutnya Akan Membayar Pajak -->
        <section class="lg:col-span-5 brochure-sheet rounded-2xl p-6 space-y-4">
          <div class="pb-4 border-b border-[#EFEAE0] flex items-center justify-between gap-2">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-[#F06A47]">
                Jadwal Jatuh Tempo Terdekat
              </p>
              <h2 class="text-lg font-bold text-[#1F513F] mt-0.5">
                Rumah Makan Pembayar Pajak Berikutnya
              </h2>
            </div>
          </div>

          <div class="space-y-3">
            <article
              v-for="(rm, index) in upcomingRestaurants"
              :key="rm.id"
              class="p-4 rounded-xl border transition"
              :class="
                index === 0
                  ? 'bg-[#FFF7F3] border-[#F6C8B8]'
                  : 'bg-[#FAF7F2] border-[#EAE4D9]'
              "
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <span
                    :class="[
                      'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold mb-1.5',
                      rm.daysLeft <= 3
                        ? 'bg-rose-600 text-white'
                        : rm.daysLeft <= 7
                          ? 'bg-[#F06A47] text-white'
                          : 'bg-[#EBF3EC] text-[#1F513F]'
                    ]"
                  >
                    {{ getDueBadgeText(rm.daysLeft) }}
                  </span>
                  <h3 class="text-sm font-bold text-[#1F513F] leading-snug">
                    {{ rm.name }}
                  </h3>
                  <p class="text-xs text-[#6B7F75] mt-0.5">
                    {{ rm.district }} &middot; Jatuh tempo {{ formatFullDate(rm.nextTaxDueDate) }}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-[10px] font-semibold uppercase text-[#7D8F87]">Estimasi PB1</p>
                  <p class="text-sm font-bold text-[#1F513F]">
                    {{ formatRupiah(rm.estimatedNextTax) }}
                  </p>
                </div>
              </div>

              <p class="text-xs text-[#6B7F75] mt-2 truncate">{{ rm.address }}</p>

              <div class="mt-3 pt-2.5 border-t border-black/5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  @click="openCreateModal(rm)"
                  class="px-3 py-1.5 rounded-full bg-[#2F614A] hover:bg-[#1F513F] text-white text-[11px] font-semibold cursor-pointer"
                >
                  Catat Setoran
                </button>
                <button
                  type="button"
                  @click="openStpModal(rm)"
                  class="px-3 py-1.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-[11px] font-semibold cursor-pointer"
                >
                  Buat STP
                </button>
                <button
                  type="button"
                  @click="openUpcomingRestaurantReminderWa(rm)"
                  class="px-3 py-1.5 rounded-full border border-[#D8D0C2] bg-white hover:border-[#2F614A] text-[#1F513F] text-[11px] font-semibold cursor-pointer"
                >
                  WA
                </button>
                <button
                  type="button"
                  @click="openMerchantInMapsTab(rm)"
                  class="px-3 py-1.5 rounded-full border border-[#D8D0C2] bg-white hover:border-[#2F614A] text-[#52675E] text-[11px] font-semibold cursor-pointer"
                >
                  Maps
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- TAB 1B: KEPATUHAN WAJIB PAJAK, REKAP WILAYAH, CEK NTPN, PENGATURAN & LOG AUDIT -->
      <div v-else-if="activeTab === 'compliance'" class="space-y-6">
        <!-- Baris 1: Kepatuhan Bulan Ini + Cek Validasi NTPN/Billing -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Kiri 7 Cols: Wajib Pajak Belum Setor Bulan Ini -->
          <section class="lg:col-span-7 bg-white rounded-2xl border border-[#EAE4D9] p-6 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE0]">
              <div>
                <h2 class="text-base font-bold text-[#1F513F]">
                  Kepatuhan Wajib Pajak ({{ formatPeriod(activePeriodYm) }})
                </h2>
                <p class="text-xs text-[#6B7F75] mt-0.5">
                  {{ complianceSummary.compliant.length }} dari {{ merchants.length }} usaha sudah lunas bulan ini ({{ complianceSummary.ratio }}%).
                </p>
              </div>
              <span class="px-3 py-1 rounded-full bg-[#EBF3EC] text-[#1F513F] text-xs font-semibold">
                Rasio Kepatuhan {{ complianceSummary.ratio }}%
              </span>
            </div>

            <div class="w-full h-2.5 rounded-full bg-[#EFEAE0] overflow-hidden">
              <div
                class="h-full rounded-full bg-[#2F614A] transition-all duration-500"
                :style="{ width: `${Math.max(4, complianceSummary.ratio)}%` }"
              ></div>
            </div>

            <div class="space-y-2.5 pt-1">
              <p class="text-xs font-semibold text-[#52675E]">
                Daftar Belum Setor Bulan Ini ({{ complianceSummary.nonCompliant.length }} Usaha):
              </p>

              <div
                v-if="complianceSummary.nonCompliant.length === 0"
                class="p-4 rounded-xl bg-[#EBF3EC] text-[#1F513F] text-sm font-medium text-center"
              >
                Seluruh wajib pajak telah melunasi setoran bulan ini.
              </div>

              <div
                v-for="m in complianceSummary.nonCompliant"
                :key="m.id"
                class="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-[#1F513F] truncate">{{ m.name }}</p>
                  <p class="text-xs text-[#6B7F75]">
                    {{ m.district }} &middot; {{ m.category }} &middot; Est. {{ formatRupiah(m.estimatedNextTax) }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    @click="openStpModal(m)"
                    class="px-3 py-1.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold cursor-pointer"
                  >
                    Terbitkan STP
                  </button>
                  <button
                    type="button"
                    @click="openCreateModal(m)"
                    class="px-3 py-1.5 rounded-full bg-[#2F614A] hover:bg-[#1F513F] text-white text-xs font-semibold cursor-pointer"
                  >
                    Catat Setor
                  </button>
                  <button
                    type="button"
                    @click="openUpcomingRestaurantReminderWa(m)"
                    class="px-3 py-1.5 rounded-full border border-[#D8D0C2] bg-white hover:border-[#2F614A] text-[#1F513F] text-xs font-semibold cursor-pointer"
                  >
                    WA
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Kanan 5 Cols: Cek Instan NTPN & Pengaturan Target/Denda -->
          <div class="lg:col-span-5 space-y-6">
            <!-- Cek Validasi NTPN / Billing -->
            <section class="bg-white rounded-2xl border border-[#EAE4D9] p-5 space-y-3">
              <div>
                <h2 class="text-base font-bold text-[#1F513F]">Cek Validasi NTPN / Kode Billing</h2>
                <p class="text-xs text-[#6B7F75] mt-0.5">
                  Masukkan Kode Billing atau 16 karakter NTPN untuk verifikasi keabsahan bukti bayar.
                </p>
              </div>
              <input
                v-model="ntpnLookupInput"
                type="text"
                placeholder="Contoh: G5J7K9L2M4N6P8R3 atau 026112388201944"
                class="w-full px-3.5 py-2.5 text-sm font-mono border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#2F614A] focus:outline-none"
              />

              <div
                v-if="ntpnLookupResult"
                class="p-3.5 rounded-xl bg-[#EBF3EC] border border-[#CFE4D4] text-xs space-y-1.5"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-[#1F513F]">Data Terdaftar &amp; Sah</span>
                  <span class="px-2 py-0.5 rounded-full bg-[#2F614A] text-white text-[10px] font-semibold">
                    {{ ntpnLookupResult.status }}
                  </span>
                </div>
                <p class="text-[#354E43]"><strong>{{ ntpnLookupResult.merchantName }}</strong> ({{ ntpnLookupResult.district }})</p>
                <p class="text-[#52675E]">
                  {{ ntpnLookupResult.taxType }} &middot; {{ formatPeriod(ntpnLookupResult.period) }} &middot;
                  <strong>{{ formatRupiah(ntpnLookupResult.taxAmount) }}</strong>
                </p>
                <button
                  type="button"
                  @click="activeDetail = ntpnLookupResult"
                  class="mt-1 text-xs font-semibold text-[#F06A47] hover:underline cursor-pointer"
                >
                  Lihat Bukti Setoran &rarr;
                </button>
              </div>
              <p
                v-else-if="ntpnLookupInput.trim().length >= 4"
                class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
              >
                Kode Billing atau NTPN tidak ditemukan di sistem.
              </p>
            </section>

            <!-- Pengaturan Target Anggaran & Tarif Denda -->
            <section class="bg-white rounded-2xl border border-[#EAE4D9] p-5 space-y-3">
              <div>
                <h2 class="text-base font-bold text-[#1F513F]">Pengaturan Target &amp; Sanksi Denda</h2>
                <p class="text-xs text-[#6B7F75] mt-0.5">
                  Target anggaran bulanan dan tarif denda STP tersimpan permanen.
                </p>
              </div>
              <form @submit.prevent="saveTaxSettings" class="space-y-3">
                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1">Target Penerimaan / Bulan (Rp)</label>
                  <input
                    v-model.number="settingsForm.monthlyTargetAmount"
                    type="number"
                    min="100000"
                    step="100000"
                    class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-white"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-[#52675E] mb-1">Denda Telat (% / bln)</label>
                    <input
                      v-model.number="settingsForm.latePenaltyPercentPerMonth"
                      type="number"
                      min="0"
                      max="25"
                      step="0.5"
                      class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-[#52675E] mb-1">Nama Unit Pajak</label>
                    <input
                      v-model="settingsForm.taxOfficeName"
                      type="text"
                      class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  :disabled="isSavingSettings"
                  class="w-full py-2.5 rounded-full bg-[#2F614A] hover:bg-[#1F513F] disabled:opacity-60 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {{ isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Pajak' }}
                </button>
              </form>
            </section>
          </div>
        </div>

        <!-- Baris 2: Rekapitulasi per Jenis Pajak & per Kecamatan -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section class="bg-white rounded-2xl border border-[#EAE4D9] p-5 space-y-4">
            <h2 class="text-base font-bold text-[#1F513F]">Rekap Penerimaan per Jenis Pajak</h2>
            <div class="space-y-3">
              <div v-for="row in revenueByTaxType" :key="row.type" class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-[#1F332B]">{{ row.type }} ({{ row.count }})</span>
                  <span class="font-bold text-[#1F513F]">{{ formatRupiah(row.amount) }} ({{ row.percent }}%)</span>
                </div>
                <div class="w-full h-2 rounded-full bg-[#EFEAE0] overflow-hidden">
                  <div class="h-full rounded-full bg-[#2F614A]" :style="{ width: `${Math.max(2, row.percent)}%` }"></div>
                </div>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-2xl border border-[#EAE4D9] p-5 space-y-4">
            <h2 class="text-base font-bold text-[#1F513F]">Rekap Penerimaan per Kecamatan</h2>
            <div class="divide-y divide-[#EFEAE0] text-sm">
              <div
                v-for="row in revenueByDistrict"
                :key="row.district"
                class="py-2.5 flex items-center justify-between gap-2"
              >
                <div>
                  <p class="font-semibold text-[#1F332B]">{{ row.district }}</p>
                  <p class="text-xs text-[#6B7F75]">{{ row.count }} setoran terverifikasi</p>
                </div>
                <span class="font-bold text-[#1F513F]">{{ formatRupiah(row.amount) }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- Baris 3: Log Audit Aktivitas Petugas Pajak -->
        <section class="bg-white rounded-2xl border border-[#EAE4D9] p-5 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFEAE0]">
            <div>
              <h2 class="text-base font-bold text-[#1F513F]">Log Audit Aktivitas Petugas Pajak</h2>
              <p class="text-xs text-[#6B7F75] mt-0.5">
                Setiap verifikasi, penolakan, arsip, STP, dan perubahan target tercatat otomatis.
              </p>
            </div>
            <span class="text-xs text-[#6B7F75]">{{ auditLogs.length }} catatan</span>
          </div>

          <div class="divide-y divide-[#EFEAE0] max-h-[340px] overflow-y-auto">
            <div
              v-for="log in auditLogs"
              :key="log.id"
              class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full bg-[#EBF3EC] text-[#1F513F] font-semibold">
                    {{ log.action }}
                  </span>
                  <span class="font-bold text-[#1F332B]">{{ log.targetName }}</span>
                </div>
                <p class="text-[#5E7269] mt-1">{{ log.detail }}</p>
              </div>
              <div class="sm:text-right shrink-0 text-[#7D8F87]">
                <p>{{ formatAuditTime(log.createdAt) }}</p>
                <p>{{ log.actor }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- TAB 2: SETORAN PAJAK AKTIF -->
      <section v-else-if="activeTab === 'taxes'" class="brochure-sheet rounded-xl overflow-hidden">
        <div class="p-5 border-b border-[#DCE9F2] space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-display text-lg font-extrabold text-[#1F513F]">
                Setoran Pajak Aktif (Belum Diarsipkan)
              </h2>
              <p class="text-xs text-[#527187]">
                Verifikasi pembayaran, terbitkan NTPN, atau arsipkan transaksi yang sudah selesai.
              </p>
            </div>
            <button
              type="button"
              @click="exportCsv(filteredActiveRecords, 'setoran-pajak-aktif')"
              :disabled="filteredActiveRecords.length === 0"
              class="px-3.5 py-2 rounded-md text-xs font-bold uppercase tracking-wider text-[#1F513F] bg-[#EBF3EC] hover:bg-[#D8EFFB] disabled:opacity-50 cursor-pointer"
            >
              Export CSV
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari UMKM, NPWP, Kode Billing, atau NTPN..."
              class="md:col-span-6 px-3.5 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#2F614A] focus:outline-none"
            />
            <select
              v-model="filterStatus"
              class="md:col-span-3 px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#2F614A] focus:outline-none"
            >
              <option value="Semua">Semua Status</option>
              <option v-for="st in TAX_STATUSES" :key="st" :value="st">{{ st }}</option>
            </select>
            <select
              v-model="filterTaxType"
              class="md:col-span-3 px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#2F614A] focus:outline-none"
            >
              <option value="Semua">Semua Jenis Pajak</option>
              <option v-for="t in TAX_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div v-if="isLoading" class="p-8 text-center text-sm text-[#527187]">Memuat data...</div>
        <div v-else-if="filteredActiveRecords.length === 0" class="p-10 text-center text-sm text-[#527187]">
          Tidak ada setoran aktif yang cocok.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[940px]">
            <thead>
              <tr class="bg-[#2F614A] text-white text-[11px] font-extrabold uppercase tracking-wider">
                <th class="py-3 px-4">Wajib Pajak</th>
                <th class="py-3 px-4">Jenis &amp; Masa</th>
                <th class="py-3 px-4">Billing &amp; NTPN</th>
                <th class="py-3 px-4 text-right">Nominal</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E4EFF7] text-xs sm:text-sm">
              <tr v-for="record in filteredActiveRecords" :key="record.id" class="bg-white odd:bg-[#FAFDFF] hover:bg-[#F0F8FC]">
                <td class="py-3.5 px-4 align-top">
                  <p class="font-bold text-[#1F513F]">{{ record.merchantName }}</p>
                  <p class="text-[11px] text-[#527187]">{{ record.district }} &middot; NPWP {{ record.npwp }}</p>
                </td>
                <td class="py-3.5 px-4 align-top">
                  <p class="font-semibold text-[#183952]">{{ record.taxType }}</p>
                  <p class="text-[11px] font-bold text-[#2F614A]">{{ formatPeriod(record.period) }}</p>
                </td>
                <td class="py-3.5 px-4 align-top font-mono text-xs">
                  <p class="font-bold text-[#1F513F]">{{ record.billingCode }}</p>
                  <p class="text-[11px]" :class="record.ntpn ? 'text-emerald-700 font-bold' : 'text-gray-400'">
                    NTPN: {{ record.ntpn || 'Belum terbit' }}
                  </p>
                </td>
                <td class="py-3.5 px-4 align-top text-right font-display font-extrabold text-[#1F513F]">
                  {{ formatRupiah(record.taxAmount) }}
                </td>
                <td class="py-3.5 px-4 align-top max-w-[200px]">
                  <span
                    :class="[
                      'inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase',
                      record.status === 'Terverifikasi (Lunas)'
                        ? 'bg-emerald-100 text-emerald-800'
                        : record.status === 'Menunggu Verifikasi'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-700'
                    ]"
                  >
                    {{ record.status }}
                  </span>
                  <p v-if="record.adminNote" class="text-[11px] text-[#527187] mt-1">{{ record.adminNote }}</p>
                </td>
                <td class="py-3.5 px-4 align-top text-right">
                  <div class="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      v-if="record.status !== 'Terverifikasi (Lunas)'"
                      type="button"
                      :disabled="busyRecordId === record.id"
                      @click="approveRecord(record)"
                      class="px-2.5 py-1.5 rounded bg-[#1F513F] hover:bg-[#164234] text-white text-[11px] font-bold cursor-pointer"
                    >
                      Verifikasi
                    </button>
                    <button
                      v-if="record.status !== 'Ditolak'"
                      type="button"
                      @click="openRejectModal(record)"
                      class="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold cursor-pointer"
                    >
                      Tolak
                    </button>
                    <button
                      v-if="record.status !== 'Terverifikasi (Lunas)'"
                      type="button"
                      @click="openTaxReminderWa(record)"
                      class="px-2.5 py-1.5 rounded bg-[#EBF3EC] hover:bg-[#D8EFFB] text-[#1F513F] text-[11px] font-bold cursor-pointer"
                    >
                      WA
                    </button>
                    <button
                      type="button"
                      :disabled="busyRecordId === record.id"
                      @click="toggleArchiveRecord(record, true)"
                      class="px-2.5 py-1.5 rounded border border-[#1F513F] text-[#1F513F] hover:bg-[#EBF3EC] text-[11px] font-bold cursor-pointer"
                    >
                      Arsipkan
                    </button>
                    <button
                      type="button"
                      @click="activeDetail = record"
                      class="px-2.5 py-1.5 rounded bg-[#2F614A] text-white text-[11px] font-bold cursor-pointer"
                    >
                      Bukti
                    </button>
                    <button
                      type="button"
                      @click="deleteTarget = record"
                      class="px-2.5 py-1.5 rounded text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- TAB 3: ARSIP PAJAK -->
      <section v-else-if="activeTab === 'archive'" class="brochure-sheet rounded-xl overflow-hidden">
        <div class="p-5 border-b border-[#DCE9F2] space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#2F614A]">
                DOKUMEN TERARSIP
              </p>
              <h2 class="font-display text-lg font-extrabold text-[#1F513F]">
                Arsip Setoran Pajak UMKM ({{ archivedRecords.length }})
              </h2>
            </div>
            <button
              type="button"
              @click="exportCsv(filteredArchivedRecords, 'arsip-pajak-umkm')"
              :disabled="filteredArchivedRecords.length === 0"
              class="px-3.5 py-2 rounded-md text-xs font-bold uppercase tracking-wider bg-[#1F513F] hover:bg-[#164234] disabled:opacity-50 text-white cursor-pointer"
            >
              Export CSV Arsip
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              v-model="archiveSearch"
              type="text"
              placeholder="Cari arsip berdasarkan nama usaha, NPWP, Billing, atau NTPN..."
              class="md:col-span-8 px-3.5 py-2 text-sm border border-[#CBDCE8] rounded-lg focus:ring-2 focus:ring-[#2F614A] focus:outline-none"
            />
            <select
              v-model="archivePeriod"
              class="md:col-span-4 px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white focus:ring-2 focus:ring-[#2F614A] focus:outline-none"
            >
              <option value="Semua">Semua Periode Arsip</option>
              <option v-for="p in archivePeriods" :key="p" :value="p">{{ formatPeriod(p) }}</option>
            </select>
          </div>
        </div>

        <div v-if="filteredArchivedRecords.length === 0" class="p-10 text-center text-sm text-[#527187]">
          Belum ada dokumen di arsip yang sesuai filter.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr class="bg-[#1F513F] text-white text-[11px] font-extrabold uppercase tracking-wider">
                <th class="py-3 px-4">Wajib Pajak</th>
                <th class="py-3 px-4">Masa &amp; Jenis</th>
                <th class="py-3 px-4">Billing &amp; NTPN</th>
                <th class="py-3 px-4 text-right">Nominal</th>
                <th class="py-3 px-4">Diarsipkan Pada</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E4EFF7] text-xs sm:text-sm">
              <tr v-for="rec in filteredArchivedRecords" :key="rec.id" class="bg-white odd:bg-[#FAFDFF]">
                <td class="py-3.5 px-4">
                  <p class="font-bold text-[#1F513F]">{{ rec.merchantName }}</p>
                  <p class="text-[11px] text-[#527187]">NPWP: {{ rec.npwp }}</p>
                </td>
                <td class="py-3.5 px-4">
                  <p class="font-semibold text-[#183952]">{{ formatPeriod(rec.period) }}</p>
                  <p class="text-[11px] text-[#527187]">{{ rec.taxType }}</p>
                </td>
                <td class="py-3.5 px-4 font-mono text-xs">
                  <p class="font-bold text-[#1F513F]">{{ rec.billingCode }}</p>
                  <p class="text-[11px] text-emerald-700 font-bold">{{ rec.ntpn || '-' }}</p>
                </td>
                <td class="py-3.5 px-4 text-right font-display font-extrabold text-[#1F513F]">
                  {{ formatRupiah(rec.taxAmount) }}
                </td>
                <td class="py-3.5 px-4 text-xs text-[#527187]">
                  {{ formatDateTime(rec.archivedAt) }}
                </td>
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      @click="activeDetail = rec"
                      class="px-2.5 py-1.5 rounded bg-[#EBF3EC] text-[#1F513F] text-[11px] font-bold cursor-pointer"
                    >
                      Bukti
                    </button>
                    <button
                      type="button"
                      :disabled="busyRecordId === rec.id"
                      @click="toggleArchiveRecord(rec, false)"
                      class="px-2.5 py-1.5 rounded bg-[#2F614A] hover:bg-[#149AC7] text-white text-[11px] font-bold cursor-pointer"
                    >
                      Pulihkan
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- TAB 4: MAPS LOKASI WAJIB PAJAK & RUMAH MAKAN -->
      <section v-else-if="activeTab === 'maps'" class="brochure-sheet rounded-xl overflow-hidden">
        <div class="p-5 border-b border-[#DCE9F2]">
          <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#2F614A]">
            PEMETAAN LAPANGAN PETUGAS PAJAK
          </p>
          <h2 class="font-display text-xl font-extrabold text-[#1F513F]">
            Maps Lokasi Rumah Makan &amp; Wajib Pajak UMKM
          </h2>
        </div>

        <div v-if="activeMapMerchant" class="grid grid-cols-1 lg:grid-cols-12">
          <div class="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-[#DCE9F2]">
            <div class="h-[380px] bg-[#E6F1F8]">
              <iframe
                :key="`${activeMapMerchant.id}-${activeMapMerchant.latitude}`"
                :src="mapEmbedUrl"
                :title="`Maps ${activeMapMerchant.name}`"
                class="w-full h-full border-0"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
            <div class="p-5 bg-[#F4F9FC] flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="font-display text-base font-extrabold text-[#1F513F]">
                  {{ activeMapMerchant.name }}
                </p>
                <p class="text-xs text-[#527187] mt-0.5">{{ activeMapMerchant.address }}</p>
                <p class="text-xs font-semibold text-[#2F614A] mt-1">
                  Jatuh tempo pajak berikutnya: {{ formatFullDate(activeMapMerchant.nextTaxDueDate) }}
                  ({{ formatRupiah(activeMapMerchant.estimatedNextTax) }})
                </p>
              </div>
              <a
                :href="getGoogleMapsDirectionUrl(activeMapMerchant)"
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-2.5 rounded-md bg-[#1F513F] hover:bg-[#164234] text-white text-xs font-extrabold uppercase tracking-wider transition"
              >
                Buka Rute Google Maps &rarr;
              </a>
            </div>
          </div>

          <div class="lg:col-span-5 p-4 max-h-[500px] overflow-y-auto space-y-2.5 bg-white">
            <button
              v-for="m in merchants"
              :key="m.id"
              type="button"
              @click="selectedMapMerchantId = m.id"
              :class="[
                'w-full text-left p-3.5 rounded-lg border transition cursor-pointer',
                activeMapMerchant.id === m.id
                  ? 'bg-[#EBF3EC] border-[#1F513F]'
                  : 'bg-[#FAFDFF] border-[#E2EDF5] hover:border-[#2F614A]'
              ]"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-bold text-sm text-[#1F513F]">{{ m.name }}</p>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2F614A] text-white">
                  {{ m.category === 'Kuliner & Katering' ? 'Rumah Makan' : m.category }}
                </span>
              </div>
              <p class="text-xs text-[#527187] mt-1">{{ m.address }}</p>
              <p class="text-[11px] font-semibold text-[#D97706] mt-1">
                Jadwal Pajak: {{ formatFullDate(m.nextTaxDueDate) }} &middot; {{ formatRupiah(m.estimatedNextTax) }}
              </p>
            </button>
          </div>
        </div>
      </section>

      <!-- TAB 5: VERIFIKASI MITRA UMKM -->
      <section v-else class="brochure-sheet rounded-xl overflow-hidden">
        <div class="p-5 border-b border-[#DCE9F2] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-extrabold text-[#1F513F]">
              Verifikasi &amp; Status Mitra UMKM
            </h2>
            <p class="text-xs text-[#527187]">
              Verifikasi usaha agar tampil dengan lencana resmi di direktori utama.
            </p>
          </div>
          <NuxtLink
            to="/register-merchant"
            class="px-4 py-2 rounded-md text-xs font-extrabold uppercase tracking-wider bg-[#1F513F] text-white"
          >
            + Tambah Mitra
          </NuxtLink>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr class="bg-[#2F614A] text-white text-[11px] font-extrabold uppercase tracking-wider">
                <th class="py-3 px-4">Nama Usaha &amp; Area</th>
                <th class="py-3 px-4">Rating</th>
                <th class="py-3 px-4">Status Verifikasi</th>
                <th class="py-3 px-4">Kepatuhan Pajak</th>
                <th class="py-3 px-4 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E4EFF7] text-xs sm:text-sm">
              <tr v-for="m in merchants" :key="m.id" class="bg-white odd:bg-[#FAFDFF]">
                <td class="py-3.5 px-4">
                  <p class="font-bold text-[#1F513F]">{{ m.name }}</p>
                  <p class="text-[11px] text-[#527187]">{{ m.category }} &middot; {{ m.district }}</p>
                </td>
                <td class="py-3.5 px-4 text-xs">
                  <strong>★ {{ m.rating.toFixed(1) }}</strong> ({{ m.reviewCount }})
                </td>
                <td class="py-3.5 px-4">
                  <span
                    :class="[
                      'px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase',
                      m.isVerified ? 'bg-[#EBF3EC] text-[#1F513F]' : 'bg-amber-100 text-amber-800'
                    ]"
                  >
                    {{ m.isVerified ? 'Terverifikasi' : 'Menunggu Verif' }}
                  </span>
                </td>
                <td class="py-3.5 px-4">
                  <span
                    :class="[
                      'px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase',
                      hasVerifiedTax(m.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    ]"
                  >
                    {{ hasVerifiedTax(m.id) ? '★ Patuh Pajak' : 'Belum Lunas' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      :disabled="busyMerchantId === m.id"
                      @click="toggleMerchantStatus(m, { isVerified: !m.isVerified })"
                      class="px-3 py-1.5 rounded text-[11px] font-bold cursor-pointer"
                      :class="m.isVerified ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-[#1F513F] text-white'"
                    >
                      {{ m.isVerified ? 'Cabut Verif' : 'Verifikasi' }}
                    </button>
                    <button
                      type="button"
                      :disabled="busyMerchantId === m.id"
                      @click="toggleMerchantStatus(m, { isOpen: !m.isOpen })"
                      class="px-3 py-1.5 rounded bg-[#EBF3EC] text-[#1F513F] text-[11px] font-bold cursor-pointer"
                    >
                      {{ m.isOpen ? 'Set Tutup' : 'Set Buka' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
    </div>

    <!-- MODAL 1: Input Setoran Baru -->
    <div
      v-if="isCreateModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="isCreateModalOpen = false"
    >
      <div class="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#D4E4F0] overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 bg-[#1F513F] text-white flex items-center justify-between">
          <div>
            <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7DD3FC]">
              PANEL ADMIN PAJAK
            </p>
            <h2 class="font-display text-lg font-extrabold">Input Setoran Pajak UMKM</h2>
          </div>
          <button type="button" @click="isCreateModalOpen = false" class="p-1.5 cursor-pointer">✕</button>
        </div>

        <form novalidate @submit.prevent="submitCreateTax" class="p-6 space-y-4 overflow-y-auto">
          <p v-if="createErrors.submit" class="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
            {{ createErrors.submit }}
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Pilih Mitra</label>
              <select
                v-model="createForm.selectedMerchant"
                @change="handleMerchantPick"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white"
              >
                <option v-for="m in merchants" :key="m.id" :value="String(m.id)">{{ m.name }}</option>
                <option value="manual">+ Input Manual</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Nama Usaha *</label>
              <input
                v-model="createForm.merchantName"
                type="text"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg"
              />
              <p v-if="createErrors.merchantName" class="text-xs text-red-600 mt-1">{{ createErrors.merchantName }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">NPWP / NIK (15–16 digit) *</label>
              <input
                v-model="createForm.npwp"
                type="text"
                inputmode="numeric"
                placeholder="3273011508920004"
                class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg"
              />
              <p v-if="createErrors.npwp" class="text-xs text-red-600 mt-1">{{ createErrors.npwp }}</p>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Masa Pajak *</label>
              <input v-model="createForm.period" type="month" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Jenis Pajak</label>
              <select v-model="createForm.taxType" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white">
                <option v-for="t in TAX_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div v-if="isCreatePercentageTax">
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Omzet Bruto (Rp)</label>
              <input v-model.number="createForm.grossRevenue" type="number" min="100000" step="50000" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg" />
              <p v-if="createErrors.grossRevenue" class="text-xs text-red-600 mt-1">{{ createErrors.grossRevenue }}</p>
            </div>
            <div v-else>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Nominal Retribusi (Rp)</label>
              <input v-model.number="createForm.flatAmount" type="number" min="10000" step="5000" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Metode Bayar</label>
              <select v-model="createForm.paymentMethod" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white">
                <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-[#35556D] mb-1">Status Awal</label>
              <select v-model="createForm.status" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg bg-white">
                <option value="Terverifikasi (Lunas)">Terverifikasi (Lunas)</option>
                <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              </select>
            </div>
          </div>

          <div class="p-3.5 rounded-lg bg-[#FAF7F2] border border-[#CDE6F5] flex items-center justify-between">
            <span class="text-xs font-extrabold uppercase text-[#1F513F]">Estimasi Pajak</span>
            <span class="font-display text-lg font-black text-[#1F513F]">{{ formatRupiah(calculatedCreateAmount) }}</span>
          </div>

          <div class="pt-2 border-t border-[#E6F0F7] flex justify-end gap-2">
            <button type="button" @click="isCreateModalOpen = false" class="px-4 py-2 text-xs font-bold uppercase text-[#527187] rounded-md cursor-pointer">
              Batal
            </button>
            <button type="submit" :disabled="isCreating" class="px-5 py-2 text-xs font-extrabold uppercase bg-[#1F513F] text-white rounded-md cursor-pointer">
              {{ isCreating ? 'Menyimpan...' : 'Simpan Setoran' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: Tolak Setoran -->
    <div
      v-if="rejectTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="rejectTarget = null"
    >
      <div class="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        <div class="px-5 py-4 bg-[#F59E0B] text-white font-display font-extrabold flex justify-between">
          <span>Tolak Setoran Pajak</span>
          <button type="button" @click="rejectTarget = null" class="cursor-pointer">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-[#35556D]">
            Alasan penolakan untuk <strong>{{ rejectTarget.merchantName }}</strong>:
          </p>
          <textarea v-model="rejectReason" rows="3" class="w-full px-3 py-2 text-sm border border-[#CBDCE8] rounded-lg"></textarea>
          <p v-if="rejectError" class="text-xs text-red-600">{{ rejectError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" @click="rejectTarget = null" class="px-4 py-2 text-xs font-bold text-[#527187] cursor-pointer">Batal</button>
            <button type="button" :disabled="isRejecting" @click="submitReject" class="px-4 py-2 text-xs font-extrabold uppercase bg-[#F59E0B] text-white rounded-md cursor-pointer">
              {{ isRejecting ? 'Memproses...' : 'Tolak Setoran' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 3: Bukti NTPN -->
    <div
      v-if="activeDetail"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="activeDetail = null"
    >
      <div class="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        <div class="px-6 py-5 bg-[#1F513F] text-white text-center relative">
          <button type="button" @click="activeDetail = null" class="absolute top-4 right-4 cursor-pointer">✕</button>
          <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7DD3FC]">BUKTI SETORAN PAJAK</p>
          <p class="font-display text-2xl font-black mt-1">{{ formatRupiah(activeDetail.taxAmount) }}</p>
          <p class="text-xs text-sky-100 mt-0.5">{{ activeDetail.status }}</p>
        </div>
        <div class="p-6 space-y-2.5 text-xs">
          <div class="p-3 rounded-lg bg-[#FAF7F2] border border-[#CDE6F5] space-y-1.5 font-mono">
            <div class="flex justify-between"><span class="text-[#527187]">Kode Billing</span><strong>{{ activeDetail.billingCode }}</strong></div>
            <div class="flex justify-between"><span class="text-[#527187]">NTPN</span><strong class="text-emerald-700">{{ activeDetail.ntpn || 'Belum terbit' }}</strong></div>
          </div>
          <div class="flex justify-between"><span>Wajib Pajak</span><strong>{{ activeDetail.merchantName }}</strong></div>
          <div class="flex justify-between"><span>NPWP / NIK</span><strong class="font-mono">{{ activeDetail.npwp }}</strong></div>
          <div class="flex justify-between"><span>Jenis &amp; Masa</span><strong>{{ activeDetail.taxType }} ({{ formatPeriod(activeDetail.period) }})</strong></div>
          <div class="flex justify-between"><span>Metode Bayar</span><strong>{{ activeDetail.paymentMethod }}</strong></div>
          <div class="pt-4 border-t border-[#E6F0F7] flex justify-end gap-2">
            <button type="button" @click="printDetail" class="px-4 py-2 text-xs font-bold uppercase text-[#1F513F] bg-[#EBF3EC] rounded-md cursor-pointer">Cetak / PDF</button>
            <button type="button" @click="activeDetail = null" class="px-4 py-2 text-xs font-bold uppercase text-white bg-[#1F513F] rounded-md cursor-pointer">Tutup</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 4: Hapus Setoran -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#072B44]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="!isDeleting && (deleteTarget = null)"
    >
      <div class="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        <div class="px-5 py-4 bg-rose-600 text-white font-display font-extrabold">Hapus Data Pajak</div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-[#35556D]">
            Hapus data pajak <strong>{{ deleteTarget.merchantName }}</strong> ({{ deleteTarget.billingCode }})?
          </p>
          <div class="flex justify-end gap-2">
            <button type="button" :disabled="isDeleting" @click="deleteTarget = null" class="px-4 py-2 text-xs font-bold text-[#527187] cursor-pointer">Batal</button>
            <button type="button" :disabled="isDeleting" @click="confirmDelete" class="px-4 py-2 text-xs font-extrabold uppercase bg-rose-600 text-white rounded-md cursor-pointer">
              {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 5: Surat Tagihan Pajak (STP) & Kalkulator Denda Keterlambatan -->
    <div
      v-if="isStpModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164234]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      @click.self="isStpModalOpen = false"
    >
      <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#EAE4D9] overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 bg-[#1F513F] text-white flex items-center justify-between">
          <div>
            <p class="text-xs text-[#B6D9C6]">{{ stpForm.stpNumber }}</p>
            <h2 class="text-base font-bold">Surat Tagihan Pajak (STP) &amp; Denda</h2>
          </div>
          <button type="button" @click="isStpModalOpen = false" class="p-1.5 cursor-pointer">✕</button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-[#52675E] mb-1">Pilih Wajib Pajak</label>
              <select
                v-model="stpForm.merchantId"
                @change="handleStpMerchantChange"
                class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-white"
              >
                <option v-for="m in merchants" :key="m.id" :value="String(m.id)">{{ m.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#52675E] mb-1">Masa Pajak</label>
              <input v-model="stpForm.period" type="month" class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-[#52675E] mb-1">Pokok Pajak (Rp)</label>
              <input
                v-model.number="stpForm.principalAmount"
                type="number"
                min="0"
                step="10000"
                class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#52675E] mb-1">
                Lama Terlambat (Bulan &middot; {{ taxSettings.latePenaltyPercentPerMonth }}%/bln)
              </label>
              <input
                v-model.number="stpForm.monthsLate"
                type="number"
                min="0"
                max="24"
                class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-[#52675E] mb-1">Catatan Teguran</label>
            <textarea
              v-model="stpForm.note"
              rows="2"
              class="w-full px-3 py-2 text-sm border border-[#DFD8CA] rounded-xl"
            ></textarea>
          </div>

          <!-- Rincian Perhitungan STP -->
          <div class="p-4 rounded-xl bg-[#FAF7F2] border border-[#E7E0D3] space-y-1.5 text-xs">
            <div class="flex justify-between text-[#52675E]">
              <span>Pokok Pajak</span>
              <strong class="text-[#1F332B]">{{ formatRupiah(stpForm.principalAmount) }}</strong>
            </div>
            <div class="flex justify-between text-[#52675E]">
              <span>Denda Keterlambatan ({{ stpForm.monthsLate }} bln × {{ taxSettings.latePenaltyPercentPerMonth }}%)</span>
              <strong class="text-[#D97706]">{{ formatRupiah(stpPenaltyAmount) }}</strong>
            </div>
            <div class="flex justify-between pt-2 border-t border-[#E5DEC9] text-sm">
              <span class="font-bold text-[#1F513F]">Total Tagihan STP</span>
              <strong class="text-[#F06A47]">{{ formatRupiah(stpTotalAmount) }}</strong>
            </div>
          </div>

          <div class="pt-2 border-t border-[#EFEAE0] flex flex-wrap justify-end gap-2">
            <button
              type="button"
              @click="isStpModalOpen = false"
              class="px-4 py-2 text-xs font-semibold text-[#52675E] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              @click="printStpDocument"
              class="px-4 py-2 rounded-full border border-[#2F614A] text-[#1F513F] hover:bg-[#EBF3EC] text-xs font-semibold cursor-pointer"
            >
              Cetak / PDF STP
            </button>
            <button
              type="button"
              @click="sendStpViaWhatsapp"
              class="px-5 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold cursor-pointer"
            >
              Kirim STP via WA
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
