<script setup lang="ts">
export type SidebarActiveKey =
  | 'usaha'
  | 'pengingat'
  | 'pajak'
  | 'peta'
  | 'bayar'
  | 'tambah'
  | 'admin'

interface SessionUser {
  name: string
  email: string
  role: string
  nip?: string
  position?: string
  profileCompleted?: boolean
  adminVerified?: boolean
}

const props = withDefaults(
  defineProps<{
    activeItem?: SidebarActiveKey
    pageTitle?: string
    reminderCount?: number
  }>(),
  {
    activeItem: 'usaha',
    pageTitle: 'Beranda'
  }
)

const isDrawerOpen = ref(false)
const isLoggingOut = ref(false)
const { isDark, toggleTheme } = useThemeMode()

const [
  { data: authData },
  { data: remindersMeta }
] = await Promise.all([
  useFetch<{ authenticated: boolean; user: SessionUser | null }>('/api/auth/me', {
    key: 'auth-session-me'
  }),
  useFetch<{ activeCount?: number }>('/api/reminders', {
    key: 'reminders-list'
  })
])

const currentUser = computed(() => authData.value?.user ?? null)
const isAdmin = computed(() => currentUser.value?.role === 'admin_pajak')
const isProfileCompleted = computed(() => isAdmin.value && currentUser.value?.profileCompleted === true)
const liveReminderCount = computed(
  () => props.reminderCount ?? remindersMeta.value?.activeCount ?? 0
)

const handleLogout = async () => {
  isLoggingOut.value = true
  isDrawerOpen.value = false
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await new Promise((resolve) => setTimeout(resolve, 240))
    await navigateTo('/login?loggedOut=1', { replace: true })
  } finally {
    isLoggingOut.value = false
  }
}

const navItemClass = (key: SidebarActiveKey) =>
  props.activeItem === key
    ? 'sidebar-menu-item sidebar-menu-active text-white font-semibold border border-white/25'
    : 'sidebar-menu-item text-white/85 hover:text-white border border-transparent'
</script>

<template>
  <!-- Bar Atas Khusus Mobile / Tablet (< lg) -->
  <header class="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#EAE4D9]">
    <div class="px-4 h-14 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          @click="isDrawerOpen = true"
          class="p-2 -ml-1 rounded-xl border border-[#E5DEC9] bg-white text-[#0F766E] cursor-pointer shrink-0"
          aria-label="Buka menu samping"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <NuxtLink to="/" class="nav-instant flex items-center gap-2 min-w-0">
          <span class="logo-pill inline-flex items-center px-2 py-1 rounded-xl border border-[#EAE4D9] shadow-2xs shrink-0">
            <img
              src="/images/mypajak-logo.jpg"
              alt="MyPajak"
              class="h-6 w-auto object-contain"
            />
          </span>
          <span v-if="pageTitle && pageTitle !== 'Beranda'" class="text-xs text-[#7D8F87] truncate">
            / {{ pageTitle }}
          </span>
        </NuxtLink>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <ThemeToggle :show-label="false" />
        <NuxtLink
          to="/bayar"
          class="nav-instant px-3.5 py-1.5 rounded-full bg-[#F06A47] hover:bg-[#DC5736] text-white text-xs font-semibold"
        >
          Bayar
        </NuxtLink>
      </div>
    </div>
  </header>

  <!-- Drawer Samping Kiri Melayang Mobile / Tablet -->
  <div
    v-if="isDrawerOpen"
    class="lg:hidden fixed inset-0 z-50 flex p-2.5"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="fixed inset-0 bg-[#081F1C]/60 backdrop-blur-xs"
      @click="isDrawerOpen = false"
    ></div>

    <aside class="sidebar-teal-surface relative z-10 w-68 max-w-[82vw] h-full rounded-[24px] text-white flex flex-col px-4 py-5 overflow-y-auto">
      <!-- Brand -->
      <div class="flex items-center justify-between gap-2 pb-4 border-b border-white/15">
        <NuxtLink
          to="/"
          @click="isDrawerOpen = false"
          class="sidebar-logo-card logo-pill inline-flex items-center px-3 py-1.5 rounded-2xl shadow-sm min-w-0"
        >
          <img
            src="/images/mypajak-logo.jpg"
            alt="MyPajak"
            class="h-7 w-auto object-contain"
          />
        </NuxtLink>

        <button
          type="button"
          @click="isDrawerOpen = false"
          class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/90 flex items-center justify-center text-xs cursor-pointer shrink-0"
          aria-label="Tutup menu"
        >
          ✕
        </button>
      </div>

      <!-- UTAMA -->
      <nav class="mt-5 space-y-1">
        <p class="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Utama
        </p>

        <NuxtLink
          to="/"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('usaha')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span>Dashboard Usaha</span>
        </NuxtLink>

        <NuxtLink
          to="/register-merchant"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('tambah')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Tambah Usaha</span>
        </NuxtLink>

        <NuxtLink
          to="/pengingat"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('pengingat')]"
        >
          <span class="flex items-center gap-3">
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span>Pengingat Bayar</span>
          </span>
          <span
            v-if="liveReminderCount > 0"
            class="px-2 py-0.5 rounded-full bg-[#F06A47] text-white text-[10px] font-bold leading-none shadow-xs"
          >
            {{ liveReminderCount }}
          </span>
        </NuxtLink>

        <NuxtLink
          to="/peta"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('peta')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span>Peta Lokasi</span>
        </NuxtLink>
      </nav>

      <!-- KEUANGAN & PAJAK -->
      <nav class="mt-5 space-y-1">
        <p class="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Keuangan &amp; Pajak
        </p>

        <NuxtLink
          to="/bayar"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('bayar')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          <span>Pembayaran</span>
        </NuxtLink>

        <NuxtLink
          to="/lapor-pajak"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('pajak')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span>Lapor Pajak</span>
        </NuxtLink>

        <NuxtLink
          v-if="isAdmin"
          :to="isProfileCompleted ? '/admin-pajak' : '/verifikasi-admin?setup=1'"
          @click="isDrawerOpen = false"
          :class="['w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('admin')]"
        >
          <span class="flex items-center gap-3 min-w-0">
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span class="truncate">Panel Admin Pajak</span>
          </span>
          <span
            v-if="!isProfileCompleted"
            class="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none shrink-0 bg-amber-400/30 text-amber-100"
          >
            Biodata
          </span>
        </NuxtLink>
      </nav>

      <!-- AKUN -->
      <div class="mt-auto pt-5 space-y-1.5">
        <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Akun
        </p>

        <button
          type="button"
          @click="toggleTheme"
          class="sidebar-menu-item w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px] text-white/85 hover:text-white cursor-pointer"
        >
          <span class="flex items-center gap-3">
            <svg v-if="isDark" class="w-4 h-4 text-[#FDE047] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            <svg v-else class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
            <span>{{ isDark ? 'Mode Siang' : 'Mode Malam' }}</span>
          </span>
          <span class="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-medium text-white/90">
            {{ isDark ? 'Gelap' : 'Terang' }}
          </span>
        </button>

        <div
          v-if="currentUser"
          class="mx-1 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-[11px] text-white/85 space-y-0.5"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="sidebar-live-dot shrink-0"></span>
            <p class="font-semibold text-white truncate">{{ currentUser.name }}</p>
          </div>
          <p class="text-[10px] text-white/75 truncate pl-4">
            {{ currentUser.position || 'Admin Pajak' }}<span v-if="currentUser.nip"> &middot; {{ currentUser.nip }}</span>
          </p>
        </div>

        <NuxtLink
          v-if="isAdmin"
          to="/verifikasi-admin"
          @click="isDrawerOpen = false"
          class="sidebar-menu-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] text-emerald-100 hover:text-white cursor-pointer"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span>Biodata &amp; Akun Admin</span>
        </NuxtLink>

        <button
          type="button"
          :disabled="isLoggingOut"
          @click="handleLogout"
          class="sidebar-menu-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] text-white/85 hover:text-white cursor-pointer"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          <span>{{ isLoggingOut ? 'Keluar...' : 'Keluar' }}</span>
        </button>
      </div>
    </aside>
  </div>

  <!-- Sidebar Melayang Bulat di Sisi Tepi Kiri untuk Desktop (>= lg) -->
  <div class="hidden lg:block shrink-0 p-3 pr-1">
    <aside class="sidebar-teal-surface sticky top-3 h-[calc(100vh-1.5rem)] w-60 rounded-[24px] text-white flex flex-col px-4 py-5 overflow-y-auto">
      <!-- Brand -->
      <div class="pb-4 border-b border-white/15">
        <NuxtLink
          to="/"
          class="sidebar-logo-card logo-pill w-full flex items-center justify-center px-3 py-2 rounded-2xl shadow-sm"
        >
          <img
            src="/images/mypajak-logo.jpg"
            alt="MyPajak"
            class="h-8 w-auto object-contain"
          />
        </NuxtLink>
      </div>

      <!-- UTAMA -->
      <nav class="mt-5 space-y-1">
        <p class="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Utama
        </p>

        <NuxtLink
          to="/"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('usaha')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span>Dashboard Usaha</span>
        </NuxtLink>

        <NuxtLink
          to="/register-merchant"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('tambah')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Tambah Usaha</span>
        </NuxtLink>

        <NuxtLink
          to="/pengingat"
          :class="['w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('pengingat')]"
        >
          <span class="flex items-center gap-3">
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span>Pengingat Bayar</span>
          </span>
          <span
            v-if="liveReminderCount > 0"
            class="px-2 py-0.5 rounded-full bg-[#F06A47] text-white text-[10px] font-bold leading-none shadow-xs"
          >
            {{ liveReminderCount }}
          </span>
        </NuxtLink>

        <NuxtLink
          to="/peta"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('peta')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span>Peta Lokasi</span>
        </NuxtLink>
      </nav>

      <!-- KEUANGAN & PAJAK -->
      <nav class="mt-5 space-y-1">
        <p class="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Keuangan &amp; Pajak
        </p>

        <NuxtLink
          to="/bayar"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('bayar')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          <span>Pembayaran</span>
        </NuxtLink>

        <NuxtLink
          to="/lapor-pajak"
          :class="['w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('pajak')]"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span>Lapor Pajak</span>
        </NuxtLink>

        <NuxtLink
          v-if="isAdmin"
          :to="isProfileCompleted ? '/admin-pajak' : '/verifikasi-admin?setup=1'"
          :class="['w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px]', navItemClass('admin')]"
        >
          <span class="flex items-center gap-3 min-w-0">
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span class="truncate">Panel Admin Pajak</span>
          </span>
          <span
            v-if="!isProfileCompleted"
            class="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none shrink-0 bg-amber-400/30 text-amber-100"
          >
            Biodata
          </span>
        </NuxtLink>
      </nav>

      <!-- AKUN -->
      <div class="mt-auto pt-5 space-y-1.5">
        <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Akun
        </p>

        <button
          type="button"
          @click="toggleTheme"
          class="sidebar-menu-item w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[13px] text-white/85 hover:text-white cursor-pointer"
        >
          <span class="flex items-center gap-3">
            <svg v-if="isDark" class="w-4 h-4 text-[#FDE047] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            <svg v-else class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
            <span>{{ isDark ? 'Mode Siang' : 'Mode Malam' }}</span>
          </span>
          <span class="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-medium text-white/90">
            {{ isDark ? 'Gelap' : 'Terang' }}
          </span>
        </button>

        <div
          v-if="currentUser"
          class="mx-1 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-[11px] text-white/85 space-y-0.5"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="sidebar-live-dot shrink-0"></span>
            <p class="font-semibold text-white truncate">{{ currentUser.name }}</p>
          </div>
          <p class="text-[10px] text-white/75 truncate pl-4">
            {{ currentUser.position || 'Admin Pajak' }}<span v-if="currentUser.nip"> &middot; {{ currentUser.nip }}</span>
          </p>
        </div>

        <NuxtLink
          v-if="isAdmin"
          to="/verifikasi-admin"
          class="sidebar-menu-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] text-emerald-100 hover:text-white cursor-pointer"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span>Biodata &amp; Akun Admin</span>
        </NuxtLink>

        <button
          type="button"
          :disabled="isLoggingOut"
          @click="handleLogout"
          class="sidebar-menu-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] text-white/85 hover:text-white cursor-pointer"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          <span>{{ isLoggingOut ? 'Keluar...' : 'Keluar' }}</span>
        </button>
      </div>
    </aside>
  </div>
</template>
