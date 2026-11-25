<script setup lang="ts">
const { transitionState } = useLoginTransition()
const isVisible = computed(() => transitionState.value.phase !== 'idle')
const isRevealing = computed(() => transitionState.value.phase === 'revealing')
</script>

<template>
  <div
    v-if="isVisible"
    :class="[
      'entry-curtain-aurora fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden text-white px-6 text-center pointer-events-auto',
      isRevealing ? 'entry-curtain--revealing' : 'entry-curtain--entering'
    ]"
    aria-live="polite"
    role="status"
  >
    <!-- Bola cahaya gradasi bergerak agar transisi terasa hidup -->
    <span class="entry-orb entry-orb-1" aria-hidden="true"></span>
    <span class="entry-orb entry-orb-2" aria-hidden="true"></span>
    <span class="entry-orb entry-orb-3" aria-hidden="true"></span>

    <!-- Kartu Logo & Sapaan -->
    <div
      :class="[
        'relative z-10 flex flex-col items-center transition-all duration-500',
        isRevealing ? 'opacity-0 -translate-y-6 scale-95' : 'login-welcome-card'
      ]"
    >
      <div class="relative mb-6">
        <span class="login-ring-soft absolute -inset-4 rounded-3xl border border-teal-200/45 pointer-events-none"></span>
        <span class="login-ring-soft-delay absolute -inset-7 rounded-[30px] border border-emerald-200/30 pointer-events-none"></span>
        <div class="logo-pill px-6 py-3.5 rounded-2xl shadow-2xl shadow-black/25">
          <img
            src="/images/mypajak-logo.jpg"
            alt="MyPajak"
            class="h-11 sm:h-12 w-auto object-contain"
          />
        </div>
      </div>

      <span class="px-3.5 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-semibold tracking-wide text-emerald-100 backdrop-blur-xs mb-3">
        Akses Admin Pajak Terverifikasi
      </span>

      <h2 class="text-xl sm:text-2xl font-bold tracking-tight drop-shadow-xs">
        Selamat Datang, {{ transitionState.adminName }}
      </h2>
      <p class="text-xs sm:text-sm text-white/85 mt-1.5 max-w-sm">
        {{ transitionState.subtitle }}
      </p>

      <div class="w-56 h-2 rounded-full bg-white/20 overflow-hidden mt-5 p-0.5 border border-white/15">
        <div class="entry-shimmer-bar h-full rounded-full"></div>
      </div>
    </div>

    <!-- Pita cahaya gradasi tipis di tepi bawah tirai saat terangkat membuka Beranda -->
    <div
      aria-hidden="true"
      class="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-[#2DD4BF] via-[#6EE7B7] to-[#F06A47] opacity-85"
    ></div>
  </div>
</template>
