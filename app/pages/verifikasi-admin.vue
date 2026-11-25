<script setup lang="ts">
useHead({
  title: 'Akun & Biodata Admin Pajak — MyPajak'
})

interface AdminAccountPublic {
  id: string
  fullName: string
  nip: string
  position: string
  department: string
  phone: string
  address: string
  email: string
  profileCompleted: boolean
  createdAt: string
  updatedAt: string
}

interface SessionUser {
  id: string
  name: string
  email: string
  role: 'admin_pajak'
  nip: string
  position: string
  department: string
  phone: string
  address: string
  profileCompleted: boolean
  adminVerified: boolean
}

const route = useRoute()
const fetchWithCookies = useRequestFetch()
const { playLoginToHomeTransition } = useLoginTransition()

const { data: authData, refresh: refreshLocalAuth } = await useAsyncData('admin-account-auth', () =>
  fetchWithCookies<{ authenticated: boolean; user: SessionUser | null }>('/api/auth/me', {
    headers: { 'cache-control': 'no-cache' }
  })
)

const isLoggedIn = computed(() => authData.value?.authenticated === true && authData.value?.user?.role === 'admin_pajak')
const currentUser = computed(() => authData.value?.user ?? null)

const { data: profileData, refresh: refreshProfiles } = await useAsyncData('admin-profiles-list', async () => {
  if (!isLoggedIn.value) {
    return { current: null as AdminAccountPublic | null, accounts: [] as AdminAccountPublic[] }
  }
  try {
    return await fetchWithCookies<{
      success: boolean
      current: AdminAccountPublic | null
      accounts: AdminAccountPublic[]
    }>('/api/auth/admin-profile', {
      headers: { 'cache-control': 'no-cache' }
    })
  } catch {
    return { current: null as AdminAccountPublic | null, accounts: [] as AdminAccountPublic[] }
  }
})

// Mode: 'register' (buat akun admin baru) atau 'biodata' (lengkapi/edit biodata akun admin aktif)
const activeTab = ref<'register' | 'biodata'>(
  route.query.mode === 'register' || !isLoggedIn.value ? 'register' : 'biodata'
)

const isSetupPrompt = computed(() => route.query.setup === '1' && isLoggedIn.value && !currentUser.value?.profileCompleted)
const registeredAccounts = computed(() => profileData.value?.accounts ?? [])

const positionPresets = [
  'Verifikator Pajak Daerah',
  'Kepala Seksi Pendataan & Penetapan',
  'Auditor Penerimaan Pajak',
  'Koordinator Lapangan UMKM',
  'Administrator Sistem Pajak'
]

const registerForm = reactive({
  fullName: '',
  nip: '',
  position: positionPresets[0]!,
  department: 'Unit Pelayanan Pajak Daerah — MyPajak',
  phone: '',
  address: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const biodataForm = reactive({
  fullName: profileData.value?.current?.fullName || currentUser.value?.name || '',
  nip: profileData.value?.current?.nip || currentUser.value?.nip || '',
  position: profileData.value?.current?.position || currentUser.value?.position || positionPresets[0]!,
  department:
    profileData.value?.current?.department ||
    currentUser.value?.department ||
    'Unit Pelayanan Pajak Daerah — MyPajak',
  phone: profileData.value?.current?.phone || currentUser.value?.phone || '',
  address: profileData.value?.current?.address || currentUser.value?.address || '',
  newPassword: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const isSubmitting = ref(false)
const isEnteringPanel = ref(false)
const successName = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const switchTab = (tab: 'register' | 'biodata') => {
  if (tab === 'biodata' && !isLoggedIn.value) return
  activeTab.value = tab
  errorMessage.value = ''
  successMessage.value = ''
}

const scrollToTopForm = () => {
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const autoFillRegisterForm = () => {
  const existingComplete = registeredAccounts.value.find((a) => a.profileCompleted)
  const suffix = String(Math.floor(10 + Math.random() * 89))
  registerForm.fullName = existingComplete?.fullName
    ? `${existingComplete.fullName.replace(/\s+\d+$/, '')} ${suffix}`
    : 'Siti Rahmawati, S.E.'
  registerForm.nip = `19960514202201${suffix}`
  registerForm.position = existingComplete?.position || positionPresets[0]!
  registerForm.department = existingComplete?.department || 'Unit Pelayanan Pajak Daerah — MyPajak'
  registerForm.phone = existingComplete?.phone || '081234567890'
  registerForm.address = existingComplete?.address || 'Jl. Ahmad Yani No. 25, Kota Pontianak'
  registerForm.email = `admin.petugas${suffix}@mypajak.id`
  registerForm.password = 'pajak2026'
  registerForm.confirmPassword = 'pajak2026'
  errorMessage.value = ''
  successMessage.value = 'Seluruh kolom formulir akun admin berhasil diisi otomatis. Anda bisa langsung klik simpan atau ubah seperlunya.'
}

const autoFillBiodataForm = () => {
  const donor = registeredAccounts.value.find(
    (a) => a.profileCompleted && a.email.toLowerCase() !== (currentUser.value?.email || '').toLowerCase()
  )
  const suffix = String(Math.floor(100 + Math.random() * 899))
  biodataForm.fullName =
    biodataForm.fullName.trim() && biodataForm.fullName !== 'Admin Pajak Daerah'
      ? biodataForm.fullName
      : donor?.fullName || 'Petugas Admin Pajak Daerah'
  biodataForm.nip = biodataForm.nip.trim() || `199501122021${suffix}`
  biodataForm.position = biodataForm.position || donor?.position || positionPresets[0]!
  biodataForm.department =
    biodataForm.department.trim() || donor?.department || 'Unit Pelayanan Pajak Daerah — MyPajak'
  biodataForm.phone = biodataForm.phone.trim() || donor?.phone || '081234567890'
  biodataForm.address = biodataForm.address.trim() || donor?.address || 'Jl. Merdeka No. 10, Kota Pontianak'
  errorMessage.value = ''
  successMessage.value = 'Seluruh kolom biodata berhasil diisi otomatis. Silakan periksa lalu klik simpan.'
}

const applyAccountToForm = (acc: AdminAccountPublic) => {
  errorMessage.value = ''
  if (activeTab.value === 'biodata' && isLoggedIn.value) {
    biodataForm.fullName = acc.fullName || ''
    // Hindari bentrok NIP jika menyalin dari akun lain
    const isSameAccount = acc.email.toLowerCase() === (currentUser.value?.email || '').toLowerCase()
    biodataForm.nip = isSameAccount
      ? acc.nip || ''
      : acc.nip
        ? `${acc.nip}-${String(Math.floor(10 + Math.random() * 89))}`
        : `19950112${String(Math.floor(1000 + Math.random() * 8999))}`
    biodataForm.position = acc.position || positionPresets[0]!
    biodataForm.department = acc.department || 'Unit Pelayanan Pajak Daerah — MyPajak'
    biodataForm.phone = acc.phone || '081234567890'
    biodataForm.address = acc.address || 'KOTA PONTIANAK'
    successMessage.value = `Biodata dari "${acc.fullName}" berhasil diisikan otomatis ke formulir.`
  } else {
    const suffix = String(Math.floor(10 + Math.random() * 89))
    registerForm.fullName = acc.fullName || 'Petugas Admin Pajak'
    registerForm.nip = acc.nip ? `${acc.nip}${suffix}` : `199501122021${suffix}`
    registerForm.position = acc.position || positionPresets[0]!
    registerForm.department = acc.department || 'Unit Pelayanan Pajak Daerah — MyPajak'
    registerForm.phone = acc.phone || '081234567890'
    registerForm.address = acc.address || 'KOTA PONTIANAK'
    const baseEmail = (acc.email.split('@')[0] || 'admin').replace(/[^a-z0-9._-]/gi, '')
    registerForm.email = `${baseEmail}${suffix}@mypajak.id`
    registerForm.password = 'pajak2026'
    registerForm.confirmPassword = 'pajak2026'
    successMessage.value = `Template biodata dari "${acc.fullName}" berhasil diisikan otomatis ke formulir pendaftaran.`
  }
  scrollToTopForm()
}

const handleRegisterAdmin = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (registerForm.password !== registerForm.confirmPassword) {
    errorMessage.value = 'Konfirmasi kata sandi tidak cocok.'
    return
  }

  isSubmitting.value = true
  try {
    const res = await $fetch<{
      success: boolean
      message: string
      user: SessionUser
      account: AdminAccountPublic
    }>('/api/auth/admin-register', {
      method: 'POST',
      body: {
        fullName: registerForm.fullName,
        nip: registerForm.nip,
        position: registerForm.position,
        department: registerForm.department,
        phone: registerForm.phone,
        address: registerForm.address,
        email: registerForm.email,
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword
      }
    })

    // Simpan kredensial lokal di perangkat ini agar tombol Isi Otomatis di halaman Login langsung terisi lengkap
    if (import.meta.client) {
      try {
        const savedMap = JSON.parse(localStorage.getItem('mypajak_saved_admin_creds') || '{}') as Record<string, string>
        savedMap[res.account.email.toLowerCase()] = registerForm.password.trim()
        localStorage.setItem('mypajak_saved_admin_creds', JSON.stringify(savedMap))
      } catch {
        // Abaikan jika storage diblokir browser
      }
    }

    await Promise.all([refreshNuxtData('auth-session-me'), refreshLocalAuth()])
    await playLoginToHomeTransition({
      name: res.account.fullName,
      subtitle: 'Akun & biodata tersimpan. Membuka Beranda MyPajak...',
      to: '/'
    })
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    errorMessage.value =
      fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal membuat akun Admin Pajak.'
  } finally {
    isSubmitting.value = false
  }
}

const handleSaveBiodata = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (biodataForm.newPassword && biodataForm.newPassword !== biodataForm.confirmPassword) {
    errorMessage.value = 'Konfirmasi kata sandi baru tidak cocok.'
    return
  }

  isSubmitting.value = true
  try {
    const wasFirstSetup = !currentUser.value?.profileCompleted
    const res = await $fetch<{
      success: boolean
      message: string
      user: SessionUser
      account: AdminAccountPublic
    }>('/api/auth/admin-profile', {
      method: 'PATCH',
      body: {
        fullName: biodataForm.fullName,
        nip: biodataForm.nip,
        position: biodataForm.position,
        department: biodataForm.department,
        phone: biodataForm.phone,
        address: biodataForm.address,
        newPassword: biodataForm.newPassword || undefined,
        confirmPassword: biodataForm.confirmPassword || undefined
      }
    })

    biodataForm.newPassword = ''
    biodataForm.confirmPassword = ''

    await Promise.all([
      refreshNuxtData('auth-session-me'),
      refreshLocalAuth(),
      refreshProfiles()
    ])

    if (wasFirstSetup) {
      await playLoginToHomeTransition({
        name: res.account.fullName,
        subtitle: 'Biodata admin tersimpan. Membuka Beranda MyPajak...',
        to: '/'
      })
    } else {
      successMessage.value = res.message
    }
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    errorMessage.value =
      fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal menyimpan biodata Admin.'
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
  <div class="login-aurora-bg min-h-screen flex flex-col relative overflow-hidden">
    <span class="login-bg-orb login-bg-orb-a" aria-hidden="true"></span>
    <span class="login-bg-orb login-bg-orb-b" aria-hidden="true"></span>
    <!-- Overlay Sukses Simpan Akun & Biodata Admin -->
    <Transition name="overlay-fade">
      <div
        v-if="isEnteringPanel"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-[#0C5D57]/88 text-white px-6 text-center"
      >
        <div class="login-welcome-card relative flex flex-col items-center">
          <div class="relative mb-5">
            <span class="login-ring-soft absolute -inset-3 rounded-3xl border border-teal-200/50 pointer-events-none"></span>
            <div class="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-xl">
              <svg class="w-9 h-9 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <p class="text-lg font-bold tracking-tight">Biodata Admin Tersimpan!</p>
          <p class="text-xs text-emerald-100/85 mt-1">Selamat bertugas, {{ successName }}. Membuka Beranda MyPajak...</p>

          <div class="w-48 h-1.5 rounded-full bg-white/20 overflow-hidden mt-4">
            <div class="login-progress-fill h-full rounded-full bg-gradient-to-r from-[#5EEAD4] to-[#F06A47]"></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Header Halaman Akun & Biodata Admin -->
    <header class="bg-white/90 backdrop-blur border-b border-[#EAE4D9] z-10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="logo-pill inline-flex items-center px-2.5 py-1 rounded-xl border border-[#EAE4D9] shadow-2xs shrink-0">
            <img
              src="/images/mypajak-logo.jpg"
              alt="MyPajak"
              class="h-7 w-auto object-contain"
            />
          </div>
          <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-[11px] font-semibold">
            Akun &amp; Biodata Khusus Admin Pajak
          </span>
        </div>

        <div class="flex items-center gap-2">
          <NuxtLink
            v-if="isLoggedIn && currentUser?.profileCompleted"
            to="/admin-pajak"
            class="nav-instant px-3.5 py-1.5 rounded-full bg-[#0F766E] hover:bg-[#0C5D57] text-white text-xs font-semibold"
          >
            Ke Panel Admin
          </NuxtLink>
          <NuxtLink
            v-else
            to="/login"
            class="nav-instant px-3.5 py-1.5 rounded-full border border-[#D8D0C2] bg-white hover:border-[#0F766E] text-xs font-semibold text-[#1F513F]"
          >
            ← Kembali ke Login
          </NuxtLink>
          <ThemeToggle :show-label="false" />
        </div>
      </div>
    </header>

    <!-- Konten Utama -->
    <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 bg-white rounded-[28px] border border-[#CFE4D4] shadow-2xl shadow-[#0F766E]/12 overflow-hidden">
        <!-- Panel Kiri: Info Akun & Biodata Admin -->
        <section class="lg:col-span-4 login-brand-admin-alive p-7 sm:p-8 text-white flex flex-col justify-between gap-6">
          <div class="space-y-5">
            <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold text-emerald-100">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Registrasi &amp; Profil Petugas
            </span>

            <div>
              <h1 class="text-2xl font-bold leading-tight tracking-tight">
                {{
                  activeTab === 'register'
                    ? 'Buat Akun Khusus Admin Pajak'
                    : 'Biodata Petugas Admin Pajak'
                }}
              </h1>
              <p class="text-xs sm:text-sm text-emerald-50/85 mt-2.5 leading-relaxed">
                Simpan identitas lengkap petugas Admin Pajak (Nama, NIP, Jabatan, Unit Kerja, No. HP, dan Alamat) agar setiap aktivitas verifikasi &amp; audit pajak memiliki penanggung jawab yang jelas.
              </p>
            </div>

            <!-- Kartu Profil Aktif jika sudah login -->
            <div v-if="isLoggedIn && currentUser" class="p-4 rounded-2xl bg-white/14 border border-white/20 space-y-2 text-xs">
              <p class="text-[10px] uppercase tracking-wider text-teal-200 font-semibold">Sesi Admin Aktif</p>
              <p class="text-sm font-bold text-white">{{ currentUser.name }}</p>
              <p class="font-mono text-[11px] text-emerald-100/90">{{ currentUser.email }}</p>
              <div class="pt-2 border-t border-white/15 space-y-1 text-[11px] text-emerald-100/90">
                <p>NIP: <span class="font-mono font-semibold text-white">{{ currentUser.nip || 'Belum diisi' }}</span></p>
                <p>Jabatan: <span class="font-semibold text-white">{{ currentUser.position || '-' }}</span></p>
                <p>Status Biodata:
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      currentUser.profileCompleted ? 'bg-emerald-400/25 text-emerald-100' : 'bg-amber-400/30 text-amber-100'
                    ]"
                  >
                    {{ currentUser.profileCompleted ? 'Lengkap ✓' : 'Belum Lengkap' }}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-white/15 space-y-2 text-[11px] text-emerald-50/85">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
              <span>Biodata admin tersimpan permanen di server</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
              <span>Bisa login langsung dengan Email atau NIP &amp; Kata Sandi</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
              <span>Kata sandi terenkripsi SHA-256 + sesi bertanda tangan</span>
            </div>
          </div>
        </section>

        <!-- Panel Kanan: Form Buat Akun Admin / Edit Biodata Admin -->
        <section class="lg:col-span-8 p-6 sm:p-8">
          <!-- Switcher Tab jika sudah login admin -->
          <div v-if="isLoggedIn" class="flex flex-wrap items-center gap-2 mb-5">
            <button
              type="button"
              @click="switchTab('biodata')"
              :class="[
                'px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer transition',
                activeTab === 'biodata'
                  ? 'bg-[#0F766E] border-[#0F766E] text-white shadow-xs'
                  : 'bg-[#FAF7F2] border-[#DFD8CA] text-[#445B51] hover:border-[#0F766E]'
              ]"
            >
              Biodata Akun Saya
            </button>
            <button
              type="button"
              @click="switchTab('register')"
              :class="[
                'px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer transition',
                activeTab === 'register'
                  ? 'bg-[#0F766E] border-[#0F766E] text-white shadow-xs'
                  : 'bg-[#FAF7F2] border-[#DFD8CA] text-[#445B51] hover:border-[#0F766E]'
              ]"
            >
              + Buat Akun Admin Baru
            </button>
          </div>

          <div
            v-if="isSetupPrompt && activeTab === 'biodata'"
            role="status"
            class="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-medium"
          >
            Silakan lengkapi &amp; simpan biodata Admin Pajak Anda terlebih dahulu (atau buat akun admin pribadi di tab sebelah) untuk membuka Panel Admin.
          </div>

          <div
            v-if="successMessage"
            role="status"
            class="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium"
          >
            {{ successMessage }}
          </div>

          <div
            v-if="errorMessage"
            role="alert"
            class="login-shake mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium"
          >
            {{ errorMessage }}
          </div>

          <!-- FORM 1: BUAT AKUN ADMIN BARU + BIODATA LENGKAP -->
          <form v-if="activeTab === 'register'" @submit.prevent="handleRegisterAdmin" class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-[#1F513F]">Formulir Pembuatan Akun &amp; Biodata Admin</h2>
                <p class="text-xs text-[#6B7F75] mt-0.5">
                  Isi data diri petugas pajak dengan benar, atau klik Isi Otomatis untuk menghemat waktu.
                </p>
              </div>
              <button
                type="button"
                @click="autoFillRegisterForm"
                class="px-3.5 py-1.5 rounded-full bg-[#EBF3EC] border border-[#CFE4D4] hover:border-[#0F766E] hover:bg-[#DCEADF]/70 text-[#1F513F] text-xs font-semibold transition cursor-pointer shrink-0"
              >
                ⚡ Isi Otomatis
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="reg-fullname" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Nama Lengkap Admin *
                </label>
                <input
                  id="reg-fullname"
                  v-model="registerForm.fullName"
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso, S.E."
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label for="reg-nip" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  NIP / ID Petugas Pajak *
                </label>
                <input
                  id="reg-nip"
                  v-model="registerForm.nip"
                  type="text"
                  required
                  placeholder="Contoh: 199508122021011005"
                  class="w-full px-3.5 py-2.5 text-sm font-mono border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label for="reg-position" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Jabatan *
                </label>
                <select
                  id="reg-position"
                  v-model="registerForm.position"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                >
                  <option v-for="pos in positionPresets" :key="pos" :value="pos">{{ pos }}</option>
                </select>
              </div>

              <div>
                <label for="reg-phone" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Nomor HP / WhatsApp *
                </label>
                <input
                  id="reg-phone"
                  v-model="registerForm.phone"
                  type="tel"
                  required
                  placeholder="Contoh: 081234567890"
                  class="w-full px-3.5 py-2.5 text-sm font-mono border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div class="sm:col-span-2">
                <label for="reg-department" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Unit Kerja / Instansi *
                </label>
                <input
                  id="reg-department"
                  v-model="registerForm.department"
                  type="text"
                  required
                  placeholder="Contoh: Bapenda Kota — Unit Pelayanan Pajak Daerah"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div class="sm:col-span-2">
                <label for="reg-address" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Alamat Kantor / Domisili *
                </label>
                <textarea
                  id="reg-address"
                  v-model="registerForm.address"
                  rows="2"
                  required
                  placeholder="Contoh: Jl. Merdeka No. 12, Kecamatan Tengah"
                  class="w-full px-3.5 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                ></textarea>
              </div>
            </div>

            <div class="pt-3 border-t border-[#EAE4D9] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label for="reg-email" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Email Akun Admin (untuk Login) *
                </label>
                <input
                  id="reg-email"
                  v-model="registerForm.email"
                  type="email"
                  required
                  placeholder="nama.petugas@mypajak.id"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label for="reg-password" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Kata Sandi (min. 6 karakter) *
                </label>
                <div class="relative">
                  <input
                    id="reg-password"
                    v-model="registerForm.password"
                    :type="showPassword ? 'text' : 'password'"
                    required
                    minlength="6"
                    placeholder="Buat kata sandi kuat"
                    class="w-full px-3.5 py-2.5 pr-16 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-[#52675E] cursor-pointer"
                  >
                    {{ showPassword ? 'Sembunyi' : 'Lihat' }}
                  </button>
                </div>
              </div>

              <div>
                <label for="reg-confirm" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Konfirmasi Kata Sandi *
                </label>
                <input
                  id="reg-confirm"
                  v-model="registerForm.confirmPassword"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  placeholder="Ulangi kata sandi"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              :disabled="isSubmitting"
              class="login-btn-gradient w-full py-3 rounded-full disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-[#0F766E]/25 cursor-pointer"
            >
              {{ isSubmitting ? 'Menyimpan Akun & Biodata...' : 'Buat Akun Admin & Masuk Beranda →' }}
            </button>
          </form>

          <!-- FORM 2: LENGKAPI / PERBARUI BIODATA ADMIN AKTIF -->
          <form v-else @submit.prevent="handleSaveBiodata" class="space-y-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-[#1F513F]">Simpan &amp; Kelola Biodata Admin Pajak</h2>
                <p class="text-xs text-[#6B7F75] mt-0.5">
                  Biodata ini terhubung ke akun <span class="font-mono font-semibold text-[#1F513F]">{{ currentUser?.email }}</span>.
                </p>
              </div>
              <button
                type="button"
                @click="autoFillBiodataForm"
                class="px-3.5 py-1.5 rounded-full bg-[#EBF3EC] border border-[#CFE4D4] hover:border-[#0F766E] hover:bg-[#DCEADF]/70 text-[#1F513F] text-xs font-semibold transition cursor-pointer shrink-0"
              >
                ⚡ Isi Otomatis
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="bio-fullname" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Nama Lengkap Admin *
                </label>
                <input
                  id="bio-fullname"
                  v-model="biodataForm.fullName"
                  type="text"
                  required
                  placeholder="Nama lengkap petugas"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label for="bio-nip" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  NIP / ID Petugas Pajak *
                </label>
                <input
                  id="bio-nip"
                  v-model="biodataForm.nip"
                  type="text"
                  required
                  placeholder="Contoh: 199508122021011005"
                  class="w-full px-3.5 py-2.5 text-sm font-mono border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label for="bio-position" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Jabatan *
                </label>
                <select
                  id="bio-position"
                  v-model="biodataForm.position"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                >
                  <option v-for="pos in positionPresets" :key="pos" :value="pos">{{ pos }}</option>
                </select>
              </div>

              <div>
                <label for="bio-phone" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Nomor HP / WhatsApp *
                </label>
                <input
                  id="bio-phone"
                  v-model="biodataForm.phone"
                  type="tel"
                  required
                  placeholder="081234567890"
                  class="w-full px-3.5 py-2.5 text-sm font-mono border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div class="sm:col-span-2">
                <label for="bio-department" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Unit Kerja / Instansi *
                </label>
                <input
                  id="bio-department"
                  v-model="biodataForm.department"
                  type="text"
                  required
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div class="sm:col-span-2">
                <label for="bio-address" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Alamat Kantor / Domisili *
                </label>
                <textarea
                  id="bio-address"
                  v-model="biodataForm.address"
                  rows="2"
                  required
                  placeholder="Alamat lengkap kantor atau domisili petugas"
                  class="w-full px-3.5 py-2 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                ></textarea>
              </div>
            </div>

            <div class="pt-3 border-t border-[#EAE4D9] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="bio-pass" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Kata Sandi Baru (Opsional)
                </label>
                <input
                  id="bio-pass"
                  v-model="biodataForm.newPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Kosongkan jika tidak diubah"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label for="bio-confirm" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                  Konfirmasi Kata Sandi Baru
                </label>
                <input
                  id="bio-confirm"
                  v-model="biodataForm.confirmPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Ulangi kata sandi baru"
                  class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              :disabled="isSubmitting"
              class="login-btn-gradient w-full py-3 rounded-full disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-[#0F766E]/25 cursor-pointer"
            >
              {{
                isSubmitting
                  ? 'Menyimpan Biodata...'
                  : currentUser?.profileCompleted
                    ? 'Simpan Perubahan Biodata Admin'
                    : 'Simpan Biodata & Masuk Beranda →'
              }}
            </button>
          </form>

          <!-- Footer Aksi -->
          <div class="mt-5 pt-4 border-t border-[#EAE4D9] flex flex-wrap items-center justify-between gap-3 text-xs">
            <NuxtLink
              v-if="isLoggedIn"
              to="/"
                class="nav-instant text-[#52675E] hover:text-[#1F513F] font-semibold"
            >
              ← Kembali ke Dashboard Usaha
            </NuxtLink>
            <NuxtLink
              v-else
              to="/login"
                class="nav-instant text-[#1F513F] hover:underline font-semibold"
            >
              Sudah punya akun Admin? Masuk di sini →
            </NuxtLink>

            <button
              v-if="isLoggedIn"
              type="button"
              @click="handleLogout"
              class="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
            >
              Keluar Akun
            </button>
          </div>
        </section>
      </div>

      <!-- Daftar Biodata Akun Admin Terdaftar (muncul saat sudah login admin) -->
      <section
        v-if="isLoggedIn && registeredAccounts.length > 0"
        class="bg-white rounded-3xl border border-[#EAE4D9] p-5 sm:p-6 shadow-xs"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 class="text-base font-bold text-[#1F513F]">Daftar Akun &amp; Biodata Admin Terdaftar</h2>
            <p class="text-xs text-[#6B7F75]">Seluruh akun petugas Admin Pajak yang tersimpan di sistem MyPajak.</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-xs font-semibold">
            {{ registeredAccounts.length }} Akun Admin
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <article
            v-for="acc in registeredAccounts"
            :key="acc.id"
            class="p-4 rounded-2xl border border-[#EAE4D9] bg-[#FAF7F2] space-y-2 text-xs"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-bold text-[#1F513F] truncate">{{ acc.fullName }}</p>
                <p class="text-[11px] font-mono text-[#1F513F] truncate">{{ acc.email }}</p>
              </div>
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0',
                  acc.profileCompleted
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                ]"
              >
                {{ acc.profileCompleted ? 'Lengkap' : 'Default' }}
              </span>
            </div>

            <div class="pt-2 border-t border-[#E6DFD3] space-y-1 text-[#52675E]">
              <p><span class="font-semibold">NIP:</span> <span class="font-mono">{{ acc.nip || '-' }}</span></p>
              <p><span class="font-semibold">Jabatan:</span> {{ acc.position || '-' }}</p>
              <p><span class="font-semibold">Unit:</span> {{ acc.department || '-' }}</p>
              <p><span class="font-semibold">HP:</span> <span class="font-mono">{{ acc.phone || '-' }}</span></p>
              <p v-if="acc.address" class="line-clamp-2"><span class="font-semibold">Alamat:</span> {{ acc.address }}</p>
            </div>

            <div class="pt-2.5 border-t border-[#E6DFD3]">
              <button
                type="button"
                @click="applyAccountToForm(acc)"
                class="w-full py-2 px-3 rounded-xl bg-white border border-[#CFE4D4] hover:border-[#0F766E] hover:bg-[#EBF3EC]/70 text-[#1F513F] text-xs font-semibold transition cursor-pointer"
              >
                ⚡ Isi Otomatis ke Formulir
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>
