<script setup lang="ts">
type MerchantCategory =
  | 'Jasa Rumah Tangga'
  | 'Kuliner & Katering'
  | 'Percetakan & ATK'
  | 'Otomotif'

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
  services: Array<{ name: string; price: number }>
}

interface MerchantsApiResponse {
  success: boolean
  data: Merchant[]
}

useHead({
  title: 'Peta Lokasi Usaha — MyPajak'
})

const route = useRoute()

const CATEGORIES: MerchantCategory[] = [
  'Kuliner & Katering',
  'Jasa Rumah Tangga',
  'Percetakan & ATK',
  'Otomotif'
]

const CATEGORY_IMAGES: Record<MerchantCategory, string> = {
  'Jasa Rumah Tangga': '/images/cat-rumah-tangga.jpg',
  'Kuliner & Katering': '/images/cat-kuliner.jpg',
  'Percetakan & ATK': '/images/cat-percetakan.jpg',
  Otomotif: '/images/cat-otomotif.jpg'
}

const KULINER_IMAGES = [
  '/images/kuliner-dimsum.jpg',
  '/images/kuliner-sunda.jpg',
  '/images/kuliner-padang.jpg',
  '/images/kuliner-warung.jpg',
  '/images/cat-kuliner.jpg'
]

const getMerchantImage = (merchant: Merchant): string => {
  if (merchant.imageUrl) return merchant.imageUrl
  if (merchant.category !== 'Kuliner & Katering') {
    return CATEGORY_IMAGES[merchant.category] ?? '/images/cat-kuliner.jpg'
  }
  const text = `${merchant.name} ${merchant.description} ${merchant.services.map((s) => s.name).join(' ')}`.toLowerCase()
  if (/dimsum|siomay|hakau|gyoza|bakpao|pangsit/.test(text)) return '/images/kuliner-dimsum.jpg'
  if (/sunda|liwet|gurame|karedok|bancakan/.test(text)) return '/images/kuliner-sunda.jpg'
  if (/padang|rendang|minang|gulai|kapau/.test(text)) return '/images/kuliner-padang.jpg'
  if (/tumpeng|katering|nasi kotak/.test(text)) return '/images/cat-kuliner.jpg'
  if (/bakso|mie\s*ayam|mi\s*ayam|soto|geprek|warung|kafe|cafe|kopi|ayam|sate|nasi/.test(text)) {
    return '/images/kuliner-warung.jpg'
  }
  return KULINER_IMAGES[Math.abs(merchant.id) % KULINER_IMAGES.length] ?? '/images/kuliner-warung.jpg'
}

const { data: merchantsRes } = await useFetch<MerchantsApiResponse>('/api/merchants', {
  key: 'merchants-list'
})

const searchQuery = ref('')
const selectedCategory = ref<string>('Semua')

const merchants = computed<Merchant[]>(() =>
  [...(merchantsRes.value?.data ?? [])].sort((a, b) => a.distanceKm - b.distanceKm)
)

const filteredMerchants = computed<Merchant[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return merchants.value.filter((m) => {
    if (selectedCategory.value !== 'Semua' && m.category !== selectedCategory.value) return false
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      m.district.toLowerCase().includes(q) ||
      m.address.toLowerCase().includes(q)
    )
  })
})

const initialMerchantId =
  typeof route.query.merchantId === 'string' && Number(route.query.merchantId) > 0
    ? Number(route.query.merchantId)
    : null

const selectedMerchantId = ref<number | null>(initialMerchantId)

const activeMerchant = computed<Merchant | null>(() => {
  const pool = filteredMerchants.value.length > 0 ? filteredMerchants.value : merchants.value
  if (pool.length === 0) return null
  if (selectedMerchantId.value !== null) {
    const found = pool.find((m) => m.id === selectedMerchantId.value)
    if (found) return found
  }
  return pool[0] ?? null
})

const mapEmbedUrl = computed(() => {
  const target = activeMerchant.value
  if (!target) return ''
  return `https://www.google.com/maps?q=${target.latitude},${target.longitude}&z=15&output=embed`
})

const getGoogleMapsDirectionUrl = (merchant: Merchant): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`

const formatDistance = (km: number): string => `${km.toFixed(1).replace('.', ',')} km`

const openWhatsappChat = (merchant: Merchant) => {
  const msg = encodeURIComponent(`Halo *${merchant.name}*, saya menemukan lokasi usaha Anda di *MyPajak*.`)
  window.open(`https://wa.me/${merchant.whatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F2] text-[#1F332B]">
    <AppSidebar active-item="peta" page-title="Peta Lokasi" />

    <div class="flex-1 min-w-0 flex flex-col">
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <!-- Header & Pencarian Peta -->
        <section class="hero-surface rounded-3xl p-6 sm:p-7 text-white shadow-lg shadow-[#164234]/15 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/14 text-[11px] font-medium text-[#D8EDE1]">
                <span class="w-1.5 h-1.5 rounded-full bg-[#F06A47]"></span>
                Pemetaan UMKM Lokal
              </span>
              <h1 class="text-2xl sm:text-3xl font-bold mt-2">Peta Lokasi Usaha</h1>
              <p class="text-sm text-[#D6E7DE] mt-1">
                Pilih usaha di sebelah kanan untuk melihat titik lokasi dan petunjuk arah langsung ke Google Maps.
              </p>
            </div>
            <span class="px-3.5 py-1.5 rounded-full bg-white/14 border border-white/20 text-xs font-semibold shrink-0">
              {{ filteredMerchants.length }} lokasi ditemukan
            </span>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div class="flex-1 bg-white rounded-full px-4 py-2 flex items-center gap-2 text-[#1F332B]">
              <svg class="w-4 h-4 text-[#0F766E] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Cari nama restoran, jalan, atau kecamatan..."
                class="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                @click="selectedCategory = 'Semua'"
                :class="[
                  'px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer',
                  selectedCategory === 'Semua'
                    ? 'bg-[#F06A47] text-white'
                    : 'bg-white/14 text-white hover:bg-white/22'
                ]"
              >
                Semua
              </button>
              <button
                v-for="cat in CATEGORIES"
                :key="cat"
                type="button"
                @click="selectedCategory = selectedCategory === cat ? 'Semua' : cat"
                :class="[
                  'px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer',
                  selectedCategory === cat
                    ? 'bg-[#F06A47] text-white'
                    : 'bg-white/14 text-white hover:bg-white/22'
                ]"
              >
                {{ cat }}
              </button>
            </div>
          </div>
        </section>

        <!-- Split Interactive Map & List -->
        <section
          v-if="activeMerchant"
          class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <!-- Kiri 7 Cols: Peta Besar + Detail Usaha Terpilih -->
          <div class="lg:col-span-7 brochure-sheet rounded-2xl overflow-hidden">
            <div class="h-[360px] sm:h-[440px] bg-[#F4EFE5]">
              <iframe
                :key="`${activeMerchant.id}-${activeMerchant.latitude}`"
                :src="mapEmbedUrl"
                :title="`Peta ${activeMerchant.name}`"
                class="w-full h-full border-0"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>

            <div class="p-5 space-y-4">
              <div class="flex items-start gap-3.5">
                <img
                  :src="getMerchantImage(activeMerchant)"
                  :alt="activeMerchant.name"
                  class="w-16 h-16 rounded-xl object-cover shrink-0 bg-[#F4EFE5]"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5 mb-1">
                    <span
                      :class="[
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        activeMerchant.isOpen ? 'bg-[#2F614A] text-white' : 'bg-slate-600 text-white'
                      ]"
                    >
                      {{ activeMerchant.isOpen ? 'Buka' : 'Tutup' }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4EFE5] text-[#1F513F]">
                      {{ activeMerchant.category }}
                    </span>
                    <span class="text-xs font-semibold text-[#F06A47]">
                      {{ formatDistance(activeMerchant.distanceKm) }}
                    </span>
                  </div>
                  <h2 class="text-base font-bold text-[#1F513F] truncate">{{ activeMerchant.name }}</h2>
                  <p class="text-xs text-[#6B7F75] mt-0.5">
                    {{ activeMerchant.address }} &middot; {{ activeMerchant.openingHours }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-[#EFEAE0]">
                <a
                  :href="getGoogleMapsDirectionUrl(activeMerchant)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="px-4 py-2 rounded-full bg-[#0F766E] hover:bg-[#0C5D57] text-white text-xs font-semibold transition"
                >
                  Buka Rute Google Maps &rarr;
                </a>
                <NuxtLink
                  :to="`/bayar?merchantId=${activeMerchant.id}`"
                  class="px-4 py-2 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold transition"
                >
                  Bayar di Usaha Ini
                </NuxtLink>
                <button
                  type="button"
                  @click="openWhatsappChat(activeMerchant)"
                  class="px-4 py-2 rounded-full border border-[#D8D0C2] bg-white hover:border-[#0F766E] text-[#1F513F] text-xs font-semibold transition cursor-pointer"
                >
                  Chat WhatsApp
                </button>
              </div>
            </div>
          </div>

          <!-- Kanan 5 Cols: Daftar Pilihan Lokasi -->
          <div class="lg:col-span-5 brochure-sheet rounded-2xl p-4 space-y-3">
            <p class="px-1 text-xs font-bold text-[#1F513F]">
              Daftar Lokasi ({{ filteredMerchants.length }})
            </p>
            <div class="max-h-[540px] overflow-y-auto space-y-2 pr-1">
              <button
                v-for="m in filteredMerchants"
                :key="m.id"
                type="button"
                @click="selectedMerchantId = m.id"
                :class="[
                  'w-full text-left p-3 rounded-2xl border flex items-center gap-3 transition cursor-pointer',
                  activeMerchant.id === m.id
                    ? 'bg-[#EBF3EC] border-[#0F766E]'
                    : 'bg-white border-[#EAE4D9] hover:border-[#0F766E]'
                ]"
              >
                <img
                  :src="getMerchantImage(m)"
                  :alt="m.name"
                  class="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#F4EFE5]"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-bold text-[#1F513F] truncate">{{ m.name }}</p>
                    <span class="text-xs font-semibold text-[#6B7F75] shrink-0">
                      {{ formatDistance(m.distanceKm) }}
                    </span>
                  </div>
                  <p class="text-xs text-[#6B7F75] truncate mt-0.5">{{ m.district }} &middot; {{ m.address }}</p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
