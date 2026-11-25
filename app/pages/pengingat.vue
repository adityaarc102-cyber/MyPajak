<script setup lang="ts">
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

interface MerchantOption {
  id: number
  name: string
  category: string
  whatsapp: string
  services: Array<{ name: string; price: number }>
}

interface MerchantsApiResponse {
  success: boolean
  data: MerchantOption[]
}

useHead({
  title: 'Pengingat Bayar — MyPajak'
})

const route = useRoute()

const [
  { data: remindersResponse, refresh: refreshReminders },
  { data: merchantsResponse }
] = await Promise.all([
  useFetch<RemindersApiResponse>('/api/reminders', { key: 'reminders-list' }),
  useFetch<MerchantsApiResponse>('/api/merchants', { key: 'merchants-list' })
])

const reminders = computed<PaymentReminder[]>(() => remindersResponse.value?.data ?? [])
const merchants = computed<MerchantOption[]>(() => merchantsResponse.value?.data ?? [])
const activeCount = computed(() => remindersResponse.value?.activeCount ?? 0)
const activeTotalAmount = computed(() => remindersResponse.value?.activeTotalAmount ?? 0)

const filterTab = ref<'Aktif' | 'Selesai' | 'Semua'>('Aktif')
const isSaving = ref(false)
const formError = ref('')
const formNotice = ref('')
const browserNotifStatus = ref('')

const form = reactive({
  selectedMerchantId: '' as string,
  title: '',
  category: 'Pajak UMKM' as 'Pajak UMKM' | 'Tagihan Jasa' | 'Langganan Katering',
  amount: 150000 as number | null,
  dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  whatsapp: '',
  note: ''
})

// Prefill jika dibuka dari kartu usaha (?merchantId=...)
const prefillFromQuery = () => {
  const qId = typeof route.query.merchantId === 'string' ? route.query.merchantId : ''
  if (!qId) return
  const found = merchants.value.find((m) => String(m.id) === qId)
  if (found) {
    form.selectedMerchantId = String(found.id)
    form.title = `Bayar Layanan — ${found.name}`
    form.category = found.category === 'Kuliner & Katering' ? 'Langganan Katering' : 'Tagihan Jasa'
    form.amount = found.services[0]?.price ?? 50000
    form.whatsapp = found.whatsapp
  }
}

prefillFromQuery()

const handleMerchantPick = () => {
  if (!form.selectedMerchantId) return
  const found = merchants.value.find((m) => String(m.id) === form.selectedMerchantId)
  if (!found) return
  form.title = `Tagihan — ${found.name}`
  form.category = found.category === 'Kuliner & Katering' ? 'Langganan Katering' : 'Tagihan Jasa'
  form.amount = found.services[0]?.price ?? 50000
  form.whatsapp = found.whatsapp
}

const filteredReminders = computed<PaymentReminder[]>(() => {
  if (filterTab.value === 'Semua') return reminders.value
  return reminders.value.filter((r) => r.status === filterTab.value)
})

const formatRupiah = (amount: number | string | null): string => {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric) || numeric < 0) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(numeric)
}

const getDaysUntil = (dateStr: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

const getDueLabel = (dateStr: string): string => {
  const d = getDaysUntil(dateStr)
  if (d < 0) return `Lewat ${Math.abs(d)} hari`
  if (d === 0) return 'Jatuh Tempo Hari Ini'
  return `H-${d} (${d} hari lagi)`
}

const submitReminder = async () => {
  formError.value = ''
  formNotice.value = ''

  if (form.title.trim().length < 3) {
    formError.value = 'Judul pengingat minimal 3 karakter.'
    return
  }
  if (!form.amount || Number(form.amount) <= 0) {
    formError.value = 'Nominal tagihan harus lebih dari Rp 0.'
    return
  }

  isSaving.value = true
  try {
    const pickedMerchant = merchants.value.find((m) => String(m.id) === form.selectedMerchantId)
    const res = await $fetch<{ success: boolean; message: string }>('/api/reminders', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        merchantId: pickedMerchant ? pickedMerchant.id : null,
        merchantName: pickedMerchant ? pickedMerchant.name : form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        whatsapp: form.whatsapp.trim(),
        note: form.note.trim()
      }
    })
    await refreshReminders()
    formNotice.value = res.message
    form.title = ''
    form.note = ''
    form.selectedMerchantId = ''
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    formError.value = fetchErr?.data?.statusMessage || 'Gagal menambah pengingat.'
  } finally {
    isSaving.value = false
  }
}

const toggleDone = async (rem: PaymentReminder) => {
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
    const top = reminders.value.find((r) => r.status === 'Aktif')
    new Notification('Pengingat Bayar MyPajak', {
      body: top
        ? `${top.title} — ${formatRupiah(top.amount)} (${getDueLabel(top.dueDate)})`
        : 'Notifikasi pengingat bayar sudah aktif.'
    })
    browserNotifStatus.value = 'Notifikasi browser aktif dan siap mengingatkan.'
  } else {
    browserNotifStatus.value = 'Izin notifikasi ditolak di browser Anda.'
  }
}

const sendReminderToWa = (rem: PaymentReminder) => {
  const phone = rem.whatsapp || '6281234567890'
  const text = [
    `*PENGINGAT PEMBAYARAN — MYPAJAK*`,
    '',
    `• *Tagihan:* ${rem.title}`,
    `• *Kategori:* ${rem.category}`,
    `• *Nominal:* ${formatRupiah(rem.amount)}`,
    `• *Jatuh Tempo:* ${rem.dueDate} (${getDueLabel(rem.dueDate)})`,
    rem.note ? `• *Catatan:* ${rem.note}` : '',
    '',
    'Silakan selesaikan pembayaran tepat waktu melalui menu Pembayaran di MyPajak.'
  ]
    .filter(Boolean)
    .join('\n')
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F2] text-[#1F332B]">
    <AppSidebar active-item="pengingat" page-title="Pengingat Bayar" :reminder-count="activeCount" />

    <div class="flex-1 min-w-0 flex flex-col">
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <!-- Hero Banner Pengingat -->
        <section class="hero-surface rounded-3xl p-6 sm:p-7 text-white shadow-lg shadow-[#164234]/15">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/14 text-[11px] font-medium text-[#D8EDE1]">
                <span class="w-1.5 h-1.5 rounded-full bg-[#F06A47]"></span>
                Jadwal Tagihan &amp; Pajak
              </span>
              <h1 class="text-2xl sm:text-3xl font-bold mt-2">Pengingat Bayar</h1>
              <p class="text-sm text-[#D6E7DE] mt-1">
                Catat tenggat pajak UMKM, tagihan jasa, atau langganan katering agar tidak terlewat.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3 shrink-0">
              <div class="px-4 py-2.5 rounded-2xl bg-white/12 border border-white/18 text-right">
                <p class="text-[11px] text-[#D8EDE1]">Tagihan Aktif ({{ activeCount }})</p>
                <p class="text-lg font-bold">{{ formatRupiah(activeTotalAmount) }}</p>
              </div>
              <button
                type="button"
                @click="triggerBrowserNotification"
                class="px-4 py-2.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                Aktifkan Notifikasi
              </button>
            </div>
          </div>

          <p
            v-if="browserNotifStatus"
            class="mt-3 pt-3 border-t border-white/15 text-xs text-[#D8EDE1] font-medium"
          >
            Status notifikasi: {{ browserNotifStatus }}
          </p>
        </section>

        <!-- Konten Utama: Form Tambah + Daftar Pengingat -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Kiri 5 Cols: Form Tambah Pengingat Baru -->
          <div class="lg:col-span-5 brochure-sheet rounded-2xl p-6 space-y-4">
            <div class="pb-3 border-b border-[#EFEAE0]">
              <h2 class="text-base font-bold text-[#1F513F]">+ Tambah Pengingat Baru</h2>
              <p class="text-xs text-[#6B7F75] mt-0.5">
                Tersimpan permanen dan otomatis terhubung ke halaman Pembayaran.
              </p>
            </div>

            <p v-if="formError" role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {{ formError }}
            </p>
            <p v-if="formNotice" role="status" class="p-3 rounded-xl bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-xs font-semibold">
              {{ formNotice }}
            </p>

            <form @submit.prevent="submitReminder" class="space-y-3.5">
              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1">Pilih Usaha (Opsional)</label>
                <select
                  v-model="form.selectedMerchantId"
                  @change="handleMerchantPick"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="">-- Input manual / umum --</option>
                  <option v-for="m in merchants" :key="m.id" :value="String(m.id)">
                    {{ m.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1">Judul Pengingat *</label>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="Contoh: Bayar Pajak PB1 Bulan Ini"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1">Kategori</label>
                  <select
                    v-model="form.category"
                    class="w-full px-3 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  >
                    <option value="Pajak UMKM">Pajak UMKM</option>
                    <option value="Tagihan Jasa">Tagihan Jasa</option>
                    <option value="Langganan Katering">Langganan Katering</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1">Nominal (Rp) *</label>
                  <input
                    v-model.number="form.amount"
                    type="number"
                    min="1000"
                    step="5000"
                    class="w-full px-3 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1">Tenggat Tanggal *</label>
                  <input
                    v-model="form.dueDate"
                    type="date"
                    class="w-full px-3 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-[#52675E] mb-1">No. WhatsApp</label>
                  <input
                    v-model="form.whatsapp"
                    type="tel"
                    placeholder="6281234567890"
                    class="w-full px-3 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#52675E] mb-1">Catatan (Opsional)</label>
                <textarea
                  v-model="form.note"
                  rows="2"
                  placeholder="Catatan tambahan atau nomor kode billing..."
                  class="w-full px-3.5 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:border-[#0F766E] focus:outline-none"
                ></textarea>
              </div>

              <button
                type="submit"
                :disabled="isSaving"
                class="w-full py-3 rounded-full bg-[#F06A47] hover:bg-[#DC5736] disabled:opacity-60 text-white text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                {{ isSaving ? 'Menyimpan...' : 'Simpan Pengingat' }}
              </button>
            </form>
          </div>

          <!-- Kanan 7 Cols: Daftar Pengingat -->
          <div class="lg:col-span-7 brochure-sheet rounded-2xl p-6 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFEAE0]">
              <div>
                <h2 class="text-base font-bold text-[#1F513F]">
                  Daftar Pengingat ({{ filteredReminders.length }})
                </h2>
                <p class="text-xs text-[#6B7F75] mt-0.5">
                  Klik Bayar untuk melunasi dengan tenggat waktu otomatis tersinkronisasi.
                </p>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  v-for="tab in (['Aktif', 'Selesai', 'Semua'] as const)"
                  :key="tab"
                  type="button"
                  @click="filterTab = tab"
                  :class="[
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer',
                    filterTab === tab
                      ? 'bg-[#0F766E] text-white border-[#0F766E]'
                      : 'bg-white text-[#52675E] border-[#DFD8CA] hover:border-[#0F766E]'
                  ]"
                >
                  {{ tab }}
                </button>
              </div>
            </div>

            <div
              v-if="filteredReminders.length === 0"
              class="p-8 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] text-center text-sm text-[#6B7F75]"
            >
              Belum ada pengingat pada kategori <strong>{{ filterTab }}</strong>.
            </div>

            <div v-else class="space-y-3">
              <article
                v-for="rem in filteredReminders"
                :key="rem.id"
                :class="[
                  'card-interactive p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                  rem.status === 'Selesai'
                    ? 'bg-[#FAF7F2] border-[#EAE4D9] opacity-75'
                    : 'bg-white border-[#EAE4D9]'
                ]"
              >
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      :class="[
                        'px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                        rem.status === 'Selesai'
                          ? 'bg-[#EBF3EC] text-[#1F513F]'
                          : getDaysUntil(rem.dueDate) <= 2
                            ? 'bg-rose-600 text-white'
                            : 'bg-[#FCEAE3] text-[#D85432]'
                      ]"
                    >
                      {{ rem.status === 'Selesai' ? 'Selesai' : getDueLabel(rem.dueDate) }}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4EFE5] text-[#1F513F]">
                      {{ rem.category }}
                    </span>
                  </div>

                  <h3
                    class="text-sm font-bold text-[#1F513F] truncate"
                    :class="{ 'line-through': rem.status === 'Selesai' }"
                  >
                    {{ rem.title }}
                  </h3>
                  <p class="text-xs text-[#6B7F75]">
                    <strong class="text-[#1F332B]">{{ formatRupiah(rem.amount) }}</strong>
                    &middot; Tenggat {{ rem.dueDate }}
                  </p>
                  <p v-if="rem.note" class="text-xs text-[#7D8F87]">{{ rem.note }}</p>
                </div>

                <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                  <NuxtLink
                    v-if="rem.status === 'Aktif'"
                    :to="
                      rem.category === 'Pajak UMKM'
                        ? `/bayar?mode=pajak&reminderId=${rem.id}`
                        : `/bayar?merchantId=${rem.merchantId ?? ''}&reminderId=${rem.id}`
                    "
                    class="px-3.5 py-1.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold"
                  >
                    Bayar
                  </NuxtLink>
                  <button
                    v-if="rem.status === 'Aktif'"
                    type="button"
                    @click="sendReminderToWa(rem)"
                    class="px-3 py-1.5 rounded-full border border-[#D8D0C2] bg-white hover:border-[#0F766E] text-[#1F513F] text-xs font-semibold cursor-pointer"
                  >
                    WA
                  </button>
                  <button
                    type="button"
                    @click="toggleDone(rem)"
                    class="px-3 py-1.5 rounded-full bg-[#EBF3EC] text-[#1F513F] text-xs font-semibold cursor-pointer"
                  >
                    {{ rem.status === 'Aktif' ? '✓ Selesai' : 'Aktifkan' }}
                  </button>
                  <button
                    type="button"
                    @click="removeReminder(rem.id)"
                    class="px-2.5 py-1.5 rounded-full text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
