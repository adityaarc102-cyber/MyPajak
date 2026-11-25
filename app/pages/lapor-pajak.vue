<script setup lang="ts">
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

interface MerchantOption {
  id: number
  name: string
  category: string
  district: string
}

interface TaxRecordItem {
  id: number
  billingCode: string
  ntpn: string | null
  merchantName: string
  district: string
  taxType: TaxType
  period: string
  taxAmount: number
  status: string
}

useHead({
  title: 'Lapor Pajak UMKM — MyPajak'
})

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

const [
  { data: merchantsRes },
  { data: taxesRes, refresh: refreshTaxes }
] = await Promise.all([
  useFetch<{ success: boolean; data: MerchantOption[] }>('/api/merchants', { key: 'merchants-list' }),
  useFetch<{ success: boolean; data: TaxRecordItem[] }>('/api/taxes', { key: 'admin-taxes-list' })
])

const merchants = computed<MerchantOption[]>(() => merchantsRes.value?.data ?? [])
const taxRecords = computed<TaxRecordItem[]>(() => taxesRes.value?.data ?? [])

const totalVerifiedTax = computed(() =>
  taxRecords.value
    .filter((t) => t.status === 'Terverifikasi (Lunas)')
    .reduce((sum, t) => sum + (Number(t.taxAmount) || 0), 0)
)
const pendingTaxCount = computed(() =>
  taxRecords.value.filter((t) => t.status !== 'Terverifikasi (Lunas)').length
)

const currentMonthPeriod = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

const firstMerchant = merchants.value[0]
const form = reactive({
  selectedMerchantId: firstMerchant ? String(firstMerchant.id) : 'manual',
  merchantName: firstMerchant?.name ?? '',
  district: firstMerchant?.district ?? '',
  npwp: '',
  taxType: 'PPh Final UMKM (0,5%)' as TaxType,
  period: currentMonthPeriod.value,
  grossRevenue: 15000000 as number | null,
  flatAmount: 50000 as number | null,
  paymentMethod: 'QRIS' as PaymentMethod
})

const isSubmitting = ref(false)
const formError = ref('')
const submittedResult = ref<{
  billingCode: string
  taxAmount: number
  merchantName: string
} | null>(null)

const isPercentageTax = computed(() => form.taxType !== 'Retribusi Daerah')
const estimatedTax = computed(() => {
  if (isPercentageTax.value) {
    const rev = Number(form.grossRevenue)
    if (!Number.isFinite(rev) || rev <= 0) return 0
    const rate = form.taxType === 'PPh Final UMKM (0,5%)' ? 0.005 : 0.1
    return Math.round(rev * rate)
  }
  const flat = Number(form.flatAmount)
  return Number.isFinite(flat) && flat > 0 ? Math.round(flat) : 0
})

const handleMerchantChange = () => {
  if (form.selectedMerchantId === 'manual') {
    form.merchantName = ''
    form.district = ''
    return
  }
  const found = merchants.value.find((m) => String(m.id) === form.selectedMerchantId)
  if (found) {
    form.merchantName = found.name
    form.district = found.district
    if (found.category === 'Kuliner & Katering') {
      form.taxType = 'Pajak Daerah / Restoran (PB1 10%)'
    } else {
      form.taxType = 'PPh Final UMKM (0,5%)'
    }
  }
}

const formatRupiah = (amount: number | string | null): string => {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric) || numeric < 0) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(numeric)
}

const submitTaxReport = async () => {
  formError.value = ''
  if (form.merchantName.trim().length < 3) {
    formError.value = 'Nama usaha minimal 3 karakter.'
    return
  }
  const cleanNpwp = form.npwp.replace(/[\s.\-]/g, '')
  if (!/^\d{15,16}$/.test(cleanNpwp)) {
    formError.value = 'NPWP / NIK wajib 15–16 digit angka.'
    return
  }
  if (isPercentageTax.value && (!form.grossRevenue || Number(form.grossRevenue) < 100000)) {
    formError.value = 'Omzet bruto minimal Rp 100.000.'
    return
  }
  if (!isPercentageTax.value && (!form.flatAmount || Number(form.flatAmount) < 10000)) {
    formError.value = 'Nominal retribusi minimal Rp 10.000.'
    return
  }

  isSubmitting.value = true
  try {
    const merchantId =
      form.selectedMerchantId !== 'manual' ? Number(form.selectedMerchantId) : null
    const res = await $fetch<{
      success: boolean
      data: { billingCode: string; taxAmount: number; merchantName: string }
    }>('/api/taxes', {
      method: 'POST',
      body: {
        merchantId: Number.isFinite(merchantId) ? merchantId : null,
        merchantName: form.merchantName.trim(),
        district: form.district.trim() || 'Area Lokal',
        npwp: cleanNpwp,
        taxType: form.taxType,
        period: form.period,
        grossRevenue: isPercentageTax.value ? Number(form.grossRevenue) : 0,
        taxAmount: isPercentageTax.value ? estimatedTax.value : Number(form.flatAmount),
        paymentMethod: form.paymentMethod,
        status: 'Menunggu Verifikasi'
      }
    })
    await refreshTaxes()
    submittedResult.value = res.data
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    formError.value = fetchErr?.data?.statusMessage || 'Gagal mengirim laporan pajak.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F2] text-[#1F332B]">
    <AppSidebar active-item="pajak" page-title="Lapor Pajak" />

    <div class="flex-1 min-w-0 flex flex-col">
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <!-- Hero Banner Lapor Pajak -->
        <section class="hero-surface rounded-3xl p-6 sm:p-7 text-white shadow-lg shadow-[#164234]/15">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/14 text-[11px] font-medium text-[#D8EDE1]">
                <span class="w-1.5 h-1.5 rounded-full bg-[#F06A47]"></span>
                PP No. 55 Tahun 2022 &middot; PB1 Daerah
              </span>
              <h1 class="text-2xl sm:text-3xl font-bold mt-2">Kalkulator &amp; Lapor Pajak UMKM</h1>
              <p class="text-sm text-[#D6E7DE] mt-1">
                Hitung estimasi pajak bulanan secara otomatis, buat Kode Billing resmi, lalu lunasi lewat menu Pembayaran.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 shrink-0">
              <div class="px-4 py-2.5 rounded-2xl bg-white/12 border border-white/18 text-right">
                <p class="text-[11px] text-[#D8EDE1]">Pajak Lunas Terverifikasi</p>
                <p class="text-lg font-bold">{{ formatRupiah(totalVerifiedTax) }}</p>
              </div>
              <NuxtLink
                to="/bayar?mode=pajak"
                class="px-4 py-2.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs sm:text-sm font-semibold transition"
              >
                Bayar Tagihan ({{ pendingTaxCount }})
              </NuxtLink>
            </div>
          </div>
        </section>

        <!-- Form Pelaporan + Riwayat -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Kiri 7 Cols: Kalkulator & Form -->
          <div class="lg:col-span-7 brochure-sheet rounded-2xl p-6 sm:p-7 space-y-5">
            <div class="pb-3 border-b border-[#EFEAE0]">
              <h2 class="text-lg font-bold text-[#1F513F]">Buat Laporan &amp; Kode Billing Pajak</h2>
              <p class="text-xs text-[#6B7F75] mt-0.5">
                Nominal pajak dihitung otomatis sesuai tarif jenis pajak yang dipilih.
              </p>
            </div>

            <!-- Kartu Hasil Berhasil -->
            <div
              v-if="submittedResult"
              class="p-5 rounded-2xl bg-[#EBF3EC] border border-[#CFE4D4] space-y-3"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold text-[#1F513F]">Kode Billing Berhasil Dibuat</span>
                <button
                  type="button"
                  @click="submittedResult = null"
                  class="text-xs font-semibold text-[#52675E] hover:underline cursor-pointer"
                >
                  Buat Lagi
                </button>
              </div>
              <p class="text-xs text-[#445B51]">
                Wajib Pajak: <strong>{{ submittedResult.merchantName }}</strong>
              </p>
              <div class="p-3.5 rounded-xl bg-white border border-[#CFE4D4] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-[11px] text-[#6B7F75]">Kode Billing</p>
                  <p class="font-mono font-bold text-base text-[#1F513F]">{{ submittedResult.billingCode }}</p>
                </div>
                <p class="text-base font-bold text-[#F06A47]">{{ formatRupiah(submittedResult.taxAmount) }}</p>
              </div>
              <div class="flex flex-wrap gap-2 pt-1">
                <NuxtLink
                  to="/bayar?mode=pajak"
                  class="px-4 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold"
                >
                  Bayar Tagihan Sekarang &rarr;
                </NuxtLink>
              </div>
            </div>

            <form novalidate @submit.prevent="submitTaxReport" class="space-y-4">
              <p v-if="formError" role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {{ formError }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Pilih Mitra Usaha</label>
                  <select
                    v-model="form.selectedMerchantId"
                    @change="handleMerchantChange"
                    class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  >
                    <option v-for="m in merchants" :key="m.id" :value="String(m.id)">{{ m.name }}</option>
                    <option value="manual">+ Input Manual</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Nama Usaha *</label>
                  <input
                    v-model="form.merchantName"
                    type="text"
                    placeholder="Nama usaha wajib pajak"
                    class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">NPWP / NIK (15–16 digit) *</label>
                  <input
                    v-model="form.npwp"
                    type="text"
                    inputmode="numeric"
                    placeholder="3273011508920004"
                    class="w-full px-3.5 py-2.5 text-sm font-mono border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Masa Pajak *</label>
                  <input
                    v-model="form.period"
                    type="month"
                    class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Jenis Pajak</label>
                  <select
                    v-model="form.taxType"
                    class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  >
                    <option v-for="t in TAX_TYPES" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>

                <div v-if="isPercentageTax">
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Omzet Bruto Bulanan (Rp)</label>
                  <input
                    v-model.number="form.grossRevenue"
                    type="number"
                    min="100000"
                    step="100000"
                    class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div v-else>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Nominal Retribusi (Rp)</label>
                  <input
                    v-model.number="form.flatAmount"
                    type="number"
                    min="10000"
                    step="5000"
                    class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1.5">Metode Pembayaran</label>
                <select
                  v-model="form.paymentMethod"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                >
                  <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>

              <!-- Kotak Estimasi Pajak -->
              <div class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7E0D3] flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-bold text-[#1F513F]">Estimasi Pajak Terutang</p>
                  <p class="text-[11px] text-[#6B7F75]">{{ form.taxType }}</p>
                </div>
                <span class="text-2xl font-bold text-[#F06A47]">
                  {{ formatRupiah(estimatedTax) }}
                </span>
              </div>

              <button
                type="submit"
                :disabled="isSubmitting"
                class="w-full py-3 rounded-full bg-[#F06A47] hover:bg-[#DC5736] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                {{ isSubmitting ? 'Membuat Kode Billing...' : 'Kirim Laporan & Buat Kode Billing' }}
              </button>
            </form>
          </div>

          <!-- Kanan 5 Cols: Panduan Tarif + Riwayat Laporan Terbaru -->
          <div class="lg:col-span-5 space-y-5">
            <div class="brochure-sheet rounded-2xl p-5 space-y-3">
              <h2 class="text-base font-bold text-[#1F513F]">Panduan Singkat Tarif</h2>
              <div class="space-y-2 text-xs text-[#52675E]">
                <div class="p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9]">
                  <p class="font-bold text-[#1F513F]">PPh Final UMKM (0,5%)</p>
                  <p class="mt-0.5">0,5% dari omzet bruto bulanan untuk pelaku usaha sesuai PP No. 55 Tahun 2022.</p>
                </div>
                <div class="p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9]">
                  <p class="font-bold text-[#1F513F]">Pajak Restoran / PB1 (10%)</p>
                  <p class="mt-0.5">10% dari penjualan makanan/minuman untuk rumah makan, kafe, dan katering.</p>
                </div>
                <div class="p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9]">
                  <p class="font-bold text-[#1F513F]">Retribusi Daerah</p>
                  <p class="mt-0.5">Nominal tetap sesuai ketetapan layanan kebersihan, parkir, atau pasar daerah.</p>
                </div>
              </div>
            </div>

            <div class="brochure-sheet rounded-2xl p-5 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-base font-bold text-[#1F513F]">Laporan Pajak Terbaru</h2>
                <span class="text-xs text-[#6B7F75]">{{ taxRecords.length }} data</span>
              </div>

              <div class="divide-y divide-[#EFEAE0] max-h-[300px] overflow-y-auto">
                <div
                  v-for="item in taxRecords.slice(0, 6)"
                  :key="item.id"
                  class="py-3 flex items-start justify-between gap-3 text-xs"
                >
                  <div class="min-w-0">
                    <p class="font-bold text-[#1F513F] truncate">{{ item.merchantName }}</p>
                    <p class="text-[#6B7F75] font-mono mt-0.5">{{ item.billingCode }} &middot; {{ item.period }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="font-bold text-[#1F332B]">{{ formatRupiah(item.taxAmount) }}</p>
                    <span
                      :class="[
                        'inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        item.status === 'Terverifikasi (Lunas)'
                          ? 'bg-[#EBF3EC] text-[#1F513F]'
                          : 'bg-[#FCEAE3] text-[#D85432]'
                      ]"
                    >
                      {{ item.status === 'Terverifikasi (Lunas)' ? 'Lunas' : item.status }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
