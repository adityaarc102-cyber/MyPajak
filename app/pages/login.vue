<script setup lang="ts">
useHead({
  title: 'Masuk Admin Pajak — MyPajak'
})

interface RegisteredAdminPreview {
  id: string
  fullName: string
  email: string
  nip: string
  position: string
  profileCompleted: boolean
}

const route = useRoute()
const { playLoginToHomeTransition } = useLoginTransition()

const { data: adminAccountsData } = await useFetch<{
  success: boolean
  accounts: RegisteredAdminPreview[]
}>('/api/auth/admin-accounts', {
  key: 'login-admin-accounts-list'
})

const customAdminAccounts = computed(() =>
  (adminAccountsData.value?.accounts ?? []).filter(
    (acc) => acc.email.toLowerCase() !== 'admin@mypajak.id'
  )
)

const form = reactive({
  username: '',
  password: ''
})

const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const autoFillInfo = ref('')
const justLoggedOut = computed(() => route.query.loggedOut === '1')

const fillDemoAdminCredentials = () => {
  form.username = 'admin@mypajak.id'
  form.password = 'pajak2026'
  errorMessage.value = ''
  autoFillInfo.value = ''
}

const fillRegisteredAdmin = (acc: RegisteredAdminPreview) => {
  form.username = acc.email
  if (import.meta.client) {
    try {
      const savedMap = JSON.parse(localStorage.getItem('mypajak_saved_admin_creds') || '{}') as Record<string, string>
      if (savedMap[acc.email.toLowerCase()]) {
        form.password = savedMap[acc.email.toLowerCase()] || ''
        autoFillInfo.value = `Email & kata sandi tersimpan untuk ${acc.fullName} berhasil diisi otomatis.`
      } else {
        form.password = ''
        autoFillInfo.value = `Email ${acc.email} terisi otomatis. Masukkan kata sandi akun Anda untuk masuk.`
      }
    } catch {
      autoFillInfo.value = `Email ${acc.email} terisi otomatis.`
    }
  }
  errorMessage.value = ''
}

const handleLogin = async () => {
  errorMessage.value = ''

  if (!form.username.trim() || !form.password) {
    errorMessage.value = 'Email / NIP Admin dan kata sandi wajib diisi.'
    return
  }

  isSubmitting.value = true
  try {
    const res = await $fetch<{
      success: boolean
      requiresProfileSetup?: boolean
      user: {
        name: string
        email: string
        role: 'admin_pajak'
        profileCompleted?: boolean
      }
    }>('/api/auth/login', {
      method: 'POST',
      body: {
        username: form.username.trim(),
        password: form.password
      }
    })

    const requestedRedirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/'

    let targetPath: string | { path: string; query?: Record<string, string> }
    let subtitle = 'Menyiapkan Beranda & Direktori MyPajak untuk Anda...'
    if (res.requiresProfileSetup || !res.user.profileCompleted) {
      targetPath = {
        path: '/verifikasi-admin',
        query: { setup: '1' }
      }
      subtitle = 'Lengkapi & simpan biodata akun Admin Pajak Anda...'
    } else {
      targetPath = requestedRedirect === '/login' ? '/' : requestedRedirect
    }

    // Simpan kredensial lokal di perangkat ini agar tombol Isi Otomatis bisa langsung dipakai di login berikutnya
    if (import.meta.client) {
      try {
        const savedMap = JSON.parse(localStorage.getItem('mypajak_saved_admin_creds') || '{}') as Record<string, string>
        savedMap[res.user.email.toLowerCase()] = form.password.trim()
        localStorage.setItem('mypajak_saved_admin_creds', JSON.stringify(savedMap))
      } catch {
        // Abaikan jika storage diblokir browser
      }
    }

    await refreshNuxtData('auth-session-me')

    await playLoginToHomeTransition({
      name: res.user.name,
      subtitle,
      to: targetPath
    })
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string }
    errorMessage.value =
      fetchErr?.data?.statusMessage || fetchErr?.statusMessage || 'Gagal masuk. Periksa akun Admin Anda.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-aurora-bg min-h-screen flex flex-col relative overflow-hidden">
    <!-- Bola cahaya gradasi melayang lembut di latar belakang -->
    <span class="login-bg-orb login-bg-orb-a" aria-hidden="true"></span>
    <span class="login-bg-orb login-bg-orb-b" aria-hidden="true"></span>
    <span class="login-bg-orb login-bg-orb-c" aria-hidden="true"></span>

    <!-- Header Ringkas -->
    <header class="bg-white/85 backdrop-blur-md border-b border-[#EAE4D9] z-10">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div class="logo-pill inline-flex items-center px-2.5 py-1 rounded-xl border border-[#EAE4D9] shadow-2xs">
          <img
            src="/images/mypajak-logo.jpg"
            alt="MyPajak"
            class="h-7 w-auto object-contain"
          />
        </div>

        <div class="flex items-center gap-3">
          <span class="hidden sm:inline text-xs font-semibold text-[#1F513F] px-3 py-1 rounded-full bg-[#EBF3EC] border border-[#CFE4D4]">
            Portal Resmi Admin Pajak
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- Konten Utama Khusus Admin Pajak -->
    <main class="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
      <div class="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 bg-white/95 backdrop-blur-sm rounded-[28px] border border-[#CFE4D4] shadow-2xl shadow-[#0F766E]/15 overflow-hidden fade-up">
        <!-- Panel Kiri: Identitas Admin Pajak dengan Gradasi Hijau Teal Mengalir Hidup -->
        <section class="relative p-7 sm:p-9 text-white flex flex-col justify-between gap-6 login-brand-admin-alive">
          <div class="space-y-5">
            <div class="flex items-center justify-between gap-3">
              <div class="login-logo-float logo-pill inline-flex items-center px-4 py-2 rounded-2xl shadow-md">
                <img
                  src="/images/mypajak-logo.jpg"
                  alt="MyPajak"
                  class="h-8 w-auto object-contain"
                />
              </div>

              <span class="px-3 py-1 rounded-full text-[11px] font-semibold border border-white/25 bg-emerald-300/20 text-emerald-50 backdrop-blur-xs">
                Khusus Admin Pajak
              </span>
            </div>

            <div>
              <h1 class="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                Panel Kendali Admin Pajak Daerah
              </h1>
              <p class="text-xs sm:text-sm text-white/85 mt-2.5 leading-relaxed">
                Kelola direktori UMKM, verifikasi setoran pajak daerah, terbitkan NTPN &amp; Surat Tagihan Pajak (STP), serta pantau kepatuhan secara real-time.
              </p>
            </div>
          </div>

          <div class="space-y-3 pt-4 border-t border-white/15 text-xs text-white/90">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </span>
              <span>Akun pribadi petugas lengkap dengan biodata &amp; NIP</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6" />
                </svg>
              </span>
              <span>Verifikasi setoran &amp; penerbitan NTPN otomatis</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25v9H4.125A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625h2.25V21H9.75V8.625zM16.5 4.125h2.25V21H16.5V4.125z" />
                </svg>
              </span>
              <span>Monitor kepatuhan, rekap kecamatan &amp; log audit</span>
            </div>
          </div>
        </section>

        <!-- Panel Kanan: Form Masuk Admin Pajak -->
        <section class="p-6 sm:p-8 lg:p-9 flex flex-col justify-center">
          <div class="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-[#0F766E] text-white text-xs font-semibold shadow-xs mb-5">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6" />
            </svg>
            <span>Admin Pajak</span>
          </div>

          <div class="mb-5">
            <h2 class="text-xl sm:text-2xl font-bold text-[#1F513F]">
              Masuk Admin Pajak
            </h2>
            <p class="text-xs sm:text-sm text-[#6B7F75] mt-1">
              Masuk menggunakan Email atau NIP akun Admin Pajak Anda yang sudah terdaftar.
            </p>
          </div>

          <div
            v-if="justLoggedOut"
            role="status"
            class="mb-4 p-3.5 rounded-xl bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-xs sm:text-sm font-medium"
          >
            Anda berhasil keluar dari MyPajak. Silakan masuk kembali sebagai Admin Pajak.
          </div>

          <div
            v-if="autoFillInfo"
            role="status"
            class="mb-4 p-3 rounded-xl bg-[#EBF3EC] border border-[#CFE4D4] text-[#1F513F] text-xs font-medium"
          >
            {{ autoFillInfo }}
          </div>

          <div
            v-if="errorMessage"
            role="alert"
            class="login-shake mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium"
          >
            {{ errorMessage }}
          </div>

          <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
              <label for="login-username" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                Email atau NIP Petugas Admin
              </label>
              <input
                id="login-username"
                v-model="form.username"
                type="text"
                autocomplete="username"
                placeholder="admin@mypajak.id atau NIP Anda"
                class="w-full px-3.5 py-2.5 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none transition"
              />
            </div>

            <div>
              <label for="login-password" class="block text-xs font-semibold text-[#445B51] mb-1.5">
                Kata Sandi
              </label>
              <div class="relative">
                <input
                  id="login-password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="Masukkan kata sandi admin"
                  class="w-full px-3.5 py-2.5 pr-16 text-sm border border-[#DFD8CA] rounded-xl bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] focus:outline-none transition"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-[#52675E] hover:text-[#1F513F] cursor-pointer"
                >
                  {{ showPassword ? 'Sembunyi' : 'Lihat' }}
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="isSubmitting"
              class="login-btn-gradient w-full py-3 rounded-full disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-[#0F766E]/25 cursor-pointer"
            >
              {{ isSubmitting ? 'Memeriksa akun admin...' : 'Masuk ke Beranda Admin Pajak →' }}
            </button>
          </form>

          <!-- Buat Akun Khusus Admin & Simpan Biodata -->
          <div class="mt-5 p-4 rounded-2xl border border-[#CFE4D4] bg-[#EBF3EC]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-bold text-[#1F513F]">
                Belum punya akun Admin pribadi?
              </p>
              <p class="text-[11px] text-[#52675E] mt-0.5">
                Buat akun khusus Admin Pajak untuk menyimpan biodata lengkap Anda.
              </p>
            </div>
            <NuxtLink
              to="/verifikasi-admin?mode=register"
              class="px-4 py-2 rounded-full bg-white border border-[#B8D7C1] hover:border-[#0F766E] text-[#1F513F] text-xs font-semibold text-center shrink-0 transition"
            >
              Buat Akun Admin →
            </NuxtLink>
          </div>

          <!-- Daftar Cepat Akun Admin Terdaftar untuk Isi Otomatis 1 Klik -->
          <div
            v-if="customAdminAccounts.length > 0"
            class="mt-4 p-3.5 rounded-2xl border border-[#CFE4D4] bg-[#EBF3EC]/45 space-y-2 text-xs"
          >
            <p class="font-semibold text-[#1F513F]">Pilih Akun Admin Terdaftar (Isi Otomatis)</p>
            <div class="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
              <div
                v-for="acc in customAdminAccounts"
                :key="acc.id"
                class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#DCEADF]"
              >
                <div class="min-w-0">
                  <p class="font-semibold text-[#1F513F] truncate">{{ acc.fullName }}</p>
                  <p class="text-[11px] font-mono text-[#6B7F75] truncate">
                    {{ acc.email }}<span v-if="acc.nip"> · NIP {{ acc.nip }}</span>
                  </p>
                </div>
                <button
                  type="button"
                  @click="fillRegisteredAdmin(acc)"
                  class="px-3 py-1.5 rounded-full bg-[#EBF3EC] border border-[#B8D7C1] hover:border-[#0F766E] text-[#1F513F] text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  ⚡ Isi Otomatis
                </button>
              </div>
            </div>
          </div>

          <!-- Akun Demo Bawaan Admin Pajak -->
          <div class="mt-3 p-3.5 rounded-2xl border bg-[#FAF7F2] border-[#EAE4D9] flex items-center justify-between gap-3 text-xs">
            <div class="min-w-0">
              <p class="font-semibold text-[#1F513F]">Akun Bawaan Admin Pajak</p>
              <p class="text-[#6B7F75] font-mono mt-0.5 truncate">
                admin@mypajak.id / pajak2026
              </p>
            </div>
            <button
              type="button"
              @click="fillDemoAdminCredentials"
              class="px-3.5 py-1.5 rounded-full bg-white border border-[#D8D0C2] hover:border-[#0F766E] text-[#1F513F] font-semibold transition cursor-pointer shrink-0"
            >
              Isi Otomatis
            </button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
