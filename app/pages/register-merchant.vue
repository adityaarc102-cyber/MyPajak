<script setup lang="ts">
type MerchantCategory =
  | 'Jasa Rumah Tangga'
  | 'Kuliner & Katering'
  | 'Percetakan & ATK'
  | 'Otomotif'

interface ServiceInput {
  name: string
  price: number | null
}

interface RegisterMerchantForm {
  name: string
  category: MerchantCategory
  district: string
  whatsapp: string
  description: string
  services: ServiceInput[]
}

interface RegisterMerchantResponse {
  success: boolean
  message: string
  data: {
    id: number
    name: string
  }
}

useHead({
  title: 'Daftarkan Usaha Anda — MyPajak'
})

const CATEGORIES: MerchantCategory[] = [
  'Jasa Rumah Tangga',
  'Kuliner & Katering',
  'Percetakan & ATK',
  'Otomotif'
]

const createEmptyService = (): ServiceInput => ({
  name: '',
  price: null
})

const form = reactive<RegisterMerchantForm>({
  name: '',
  category: 'Jasa Rumah Tangga',
  district: '',
  whatsapp: '',
  description: '',
  services: [createEmptyService()]
})

const errors = reactive<Record<string, string>>({})
const isSubmitting = ref(false)
const submitSuccessMessage = ref('')

const clearError = (key: string) => {
  if (errors[key]) {
    delete errors[key]
  }
}

const clearServiceErrors = () => {
  Object.keys(errors).forEach((key) => {
    if (key.startsWith('service_name_') || key.startsWith('service_price_') || key === 'services') {
      delete errors[key]
    }
  })
}

const clearAllErrors = () => {
  Object.keys(errors).forEach((key) => delete errors[key])
}

const formatRupiah = (amount: number | string | null): string => {
  if (amount === null || String(amount).trim() === '') return ''
  const numeric = Number(amount)
  if (!Number.isFinite(numeric) || numeric < 0) return ''
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(numeric)
}

const addService = () => {
  form.services.push(createEmptyService())
  clearError('services')
}

const removeService = (index: number) => {
  if (form.services.length > 1) {
    form.services.splice(index, 1)
    clearServiceErrors()
  }
}

const validateForm = (): boolean => {
  clearAllErrors()

  if (!form.name || form.name.trim().length < 3) {
    errors.name = 'Nama usaha wajib diisi minimal 3 karakter.'
  }

  if (!form.category || !CATEGORIES.includes(form.category)) {
    errors.category = 'Pilih kategori usaha yang valid.'
  }

  if (!form.district || form.district.trim().length < 2) {
    errors.district = 'Kecamatan atau area layanan wajib diisi.'
  }

  const normalizedWa = form.whatsapp.replace(/[\s\-()+]/g, '')
  if (!/^628\d{7,13}$/.test(normalizedWa)) {
    errors.whatsapp = 'Gunakan format 628 diikuti 7-13 digit angka (contoh: 6281234567890).'
  }

  if (!form.description || form.description.trim().length < 15) {
    errors.description = 'Deskripsi singkat usaha minimal 15 karakter.'
  }

  if (form.services.length === 0) {
    errors.services = 'Minimal 1 layanan atau produk harus ditambahkan.'
  } else {
    form.services.forEach((service, idx) => {
      if (!service.name || !service.name.trim()) {
        errors[`service_name_${idx}`] = 'Nama layanan/produk tidak boleh kosong.'
      }

      const isEmptyPrice =
        service.price === null || String(service.price).trim() === ''
      const parsedPrice = Number(service.price)
      if (isEmptyPrice || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
        errors[`service_price_${idx}`] = 'Masukkan harga valid (minimal Rp 0).'
      }
    })
  }

  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  submitSuccessMessage.value = ''

  if (!validateForm()) return

  isSubmitting.value = true
  clearError('submit')

  try {
    const response = await $fetch<RegisterMerchantResponse>('/api/merchants', {
      method: 'POST',
      body: form
    })

    submitSuccessMessage.value =
      response.message || 'Pendaftaran berhasil! Mengarahkan kembali ke direktori...'

    await refreshNuxtData('merchants-list')
    await navigateTo('/')
  } catch (err: unknown) {
    const fetchError = err as {
      data?: { statusMessage?: string; message?: string }
      statusMessage?: string
      message?: string
    }
    errors.submit =
      fetchError?.data?.statusMessage ||
      fetchError?.data?.message ||
      fetchError?.statusMessage ||
      'Gagal mendaftarkan usaha. Silakan periksa kembali data Anda.'
  } finally {
    isSubmitting.value = false
  }
}

const handleLogout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login?loggedOut=1', { replace: true })
}
</script>

<template>
  <div class="min-h-screen text-[#1F332B] flex flex-col lg:flex-row">
    <AppSidebar active-item="tambah" page-title="Tambah Usaha" />

    <!-- Form Container -->
    <div class="flex-1 min-w-0 flex flex-col">
    <main class="max-w-3xl w-full mx-auto px-4 sm:px-6 py-7 flex-1">
      <div class="bg-white rounded-3xl border border-[#EAE4D9] shadow-lg shadow-[#164234]/8 overflow-hidden">
        <div class="hero-surface px-6 sm:px-8 py-6 text-white">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/14 text-[11px] font-medium text-[#D8EDE1]">
            <span class="w-1.5 h-1.5 rounded-full bg-[#F06A47]"></span>
            Pendaftaran Mitra UMKM
          </span>
          <h1 class="text-2xl font-bold mt-2">Tambah Usaha Baru</h1>
          <p class="text-xs sm:text-sm text-[#D6E7DE] mt-1">
            Isi informasi usaha dan daftar layanan atau menu agar tersimpan permanen dan langsung tampil di beranda.
          </p>
        </div>

        <div class="p-6 sm:p-8">
          <div
            v-if="submitSuccessMessage"
            role="status"
            class="mb-5 p-3.5 rounded-xl bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-sm font-medium"
          >
            {{ submitSuccessMessage }}
          </div>

          <div
            v-if="errors.submit"
            role="alert"
            class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium"
          >
            {{ errors.submit }}
          </div>

          <form novalidate @submit.prevent="handleSubmit" class="space-y-5">
            <div>
              <label for="merchant-name" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                Nama Usaha <span class="text-rose-500">*</span>
              </label>
              <input
                id="merchant-name"
                v-model="form.name"
                type="text"
                placeholder="Contoh: Dimsum Nyooi"
                :aria-invalid="Boolean(errors.name)"
                @input="clearError('name')"
                :class="[
                  'w-full px-3.5 py-2.5 text-sm border rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:outline-none transition',
                  errors.name
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                ]"
              />
              <p v-if="errors.name" class="text-xs text-rose-600 mt-1">{{ errors.name }}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="merchant-category" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Kategori <span class="text-rose-500">*</span>
                </label>
                <select
                  id="merchant-category"
                  v-model="form.category"
                  :aria-invalid="Boolean(errors.category)"
                  @change="clearError('category')"
                  :class="[
                    'w-full px-3.5 py-2.5 text-sm border rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:outline-none transition',
                    errors.category
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                  ]"
                >
                  <option v-for="category in CATEGORIES" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
                <p v-if="errors.category" class="text-xs text-rose-600 mt-1">{{ errors.category }}</p>
              </div>

              <div>
                <label for="merchant-district" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Kecamatan / Area <span class="text-rose-500">*</span>
                </label>
                <input
                  id="merchant-district"
                  v-model="form.district"
                  type="text"
                  placeholder="Contoh: Kec. Sukajadi"
                  :aria-invalid="Boolean(errors.district)"
                  @input="clearError('district')"
                  :class="[
                    'w-full px-3.5 py-2.5 text-sm border rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:outline-none transition',
                    errors.district
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                  ]"
                />
                <p v-if="errors.district" class="text-xs text-rose-600 mt-1">{{ errors.district }}</p>
              </div>
            </div>

            <div>
              <label for="merchant-whatsapp" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                Nomor WhatsApp <span class="text-rose-500">*</span>
              </label>
              <input
                id="merchant-whatsapp"
                v-model="form.whatsapp"
                type="tel"
                inputmode="numeric"
                placeholder="6281234567890"
                :aria-invalid="Boolean(errors.whatsapp)"
                @input="clearError('whatsapp')"
                :class="[
                  'w-full px-3.5 py-2.5 text-sm border rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:outline-none transition',
                  errors.whatsapp
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                ]"
              />
              <p v-if="errors.whatsapp" class="text-xs text-rose-600 mt-1">{{ errors.whatsapp }}</p>
              <p v-else class="text-xs text-[#6B7F75] mt-1">Gunakan awalan 628 tanpa spasi atau tanda +.</p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="merchant-description" class="block text-xs font-semibold text-[#445B51]">
                  Deskripsi Singkat <span class="text-rose-500">*</span>
                </label>
                <span class="text-xs text-[#7D8F87]">
                  {{ form.description.trim().length }} / min. 15 karakter
                </span>
              </div>
              <textarea
                id="merchant-description"
                v-model="form.description"
                rows="3"
                placeholder="Jelaskan layanan, menu andalan, atau jam buka usaha Anda..."
                :aria-invalid="Boolean(errors.description)"
                @input="clearError('description')"
                :class="[
                  'w-full px-3.5 py-2.5 text-sm border rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:outline-none transition',
                  errors.description
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                ]"
              ></textarea>
              <p v-if="errors.description" class="text-xs text-rose-600 mt-1">
                {{ errors.description }}
              </p>
            </div>

            <!-- Daftar Layanan / Menu -->
            <div class="pt-5 border-t border-[#EFEAE0]">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 class="text-sm font-bold text-[#1F513F]">
                    Daftar Layanan / Menu <span class="text-rose-500">*</span>
                  </h2>
                  <p class="text-xs text-[#6B7F75] mt-0.5">Minimal 1 layanan beserta harga.</p>
                </div>
                <button
                  type="button"
                  @click="addService"
                  class="text-xs font-semibold px-3.5 py-1.5 bg-[#EBF3EC] text-[#1F513F] rounded-full hover:bg-[#DCECE0] transition cursor-pointer"
                >
                  + Tambah Layanan
                </button>
              </div>

              <p v-if="errors.services" class="text-xs text-rose-600 mb-3">{{ errors.services }}</p>

              <div class="space-y-3">
                <div
                  v-for="(service, index) in form.services"
                  :key="index"
                  class="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE4D9]"
                >
                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div class="sm:col-span-6">
                      <label
                        :for="`service-name-${index}`"
                        class="block text-xs font-semibold text-[#52675E] mb-1"
                      >
                        Nama Layanan / Menu <span class="text-rose-500">*</span>
                      </label>
                      <input
                        :id="`service-name-${index}`"
                        v-model="service.name"
                        type="text"
                        placeholder="Contoh: Dimsum Ayam (isi 6)"
                        :aria-invalid="Boolean(errors[`service_name_${index}`])"
                        @input="clearError(`service_name_${index}`)"
                        :class="[
                          'w-full px-3 py-2 text-sm border rounded-xl bg-white focus:ring-2 focus:outline-none transition',
                          errors[`service_name_${index}`]
                            ? 'border-rose-400 focus:ring-rose-200'
                            : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                        ]"
                      />
                      <p v-if="errors[`service_name_${index}`]" class="text-xs text-rose-600 mt-1">
                        {{ errors[`service_name_${index}`] }}
                      </p>
                    </div>

                    <div class="sm:col-span-4">
                      <label
                        :for="`service-price-${index}`"
                        class="block text-xs font-semibold text-[#52675E] mb-1"
                      >
                        Harga (Rp) <span class="text-rose-500">*</span>
                      </label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#7D8F87]">
                          Rp
                        </span>
                        <input
                          :id="`service-price-${index}`"
                          v-model.number="service.price"
                          type="number"
                          min="0"
                          step="500"
                          placeholder="25000"
                          :aria-invalid="Boolean(errors[`service_price_${index}`])"
                          @input="clearError(`service_price_${index}`)"
                          :class="[
                            'w-full pl-9 pr-3 py-2 text-sm border rounded-xl bg-white focus:ring-2 focus:outline-none transition',
                            errors[`service_price_${index}`]
                              ? 'border-rose-400 focus:ring-rose-200'
                              : 'border-[#DFD8CA] focus:border-[#2F614A] focus:ring-[#2F614A]/20'
                          ]"
                        />
                      </div>
                      <p v-if="errors[`service_price_${index}`]" class="text-xs text-rose-600 mt-1">
                        {{ errors[`service_price_${index}`] }}
                      </p>
                      <p
                        v-else-if="formatRupiah(service.price)"
                        class="text-xs text-[#2F614A] font-medium mt-1"
                      >
                        {{ formatRupiah(service.price) }}
                      </p>
                    </div>

                    <div class="sm:col-span-2 flex sm:pt-6 justify-end">
                      <button
                        v-if="form.services.length > 1"
                        type="button"
                        @click="removeService(index)"
                        class="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-[#EFEAE0]">
              <NuxtLink
                to="/"
                class="w-full sm:w-auto text-center px-5 py-2.5 text-sm font-medium text-[#52675E] hover:bg-[#FAF7F2] rounded-full transition"
              >
                Batal
              </NuxtLink>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#F06A47] hover:bg-[#DC5736] disabled:opacity-60 text-white text-sm font-semibold rounded-full shadow-sm shadow-[#F06A47]/25 transition cursor-pointer"
              >
                <span>{{ isSubmitting ? 'Menyimpan...' : 'Simpan Usaha' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
    </div>
  </div>
</template>
