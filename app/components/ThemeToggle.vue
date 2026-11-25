<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    showLabel?: boolean
    fullWidth?: boolean
  }>(),
  {
    showLabel: true,
    fullWidth: false
  }
)

const { isDark, toggleTheme } = useThemeMode()
</script>

<template>
  <button
    type="button"
    @click="toggleTheme"
    :aria-label="isDark ? 'Ganti ke Mode Siang' : 'Ganti ke Mode Malam'"
    :title="isDark ? 'Ganti ke Mode Siang' : 'Ganti ke Mode Malam'"
    :class="[
      'theme-toggle-btn inline-flex items-center gap-2 rounded-full border border-[#DFD8CA] bg-white hover:border-[#2F614A] text-[#1F513F] text-xs font-semibold transition cursor-pointer shrink-0',
      props.fullWidth ? 'w-full justify-between px-3.5 py-2.5' : 'px-2.5 sm:px-3 py-2'
    ]"
  >
    <span class="inline-flex items-center gap-2">
      <!-- Ikon Matahari (saat Mode Malam aktif, klik untuk Mode Siang) -->
      <svg
        v-if="isDark"
        class="w-4 h-4 text-[#FBBF24] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>

      <!-- Ikon Bulan (saat Mode Siang aktif, klik untuk Mode Malam) -->
      <svg
        v-else
        class="w-4 h-4 text-[#1F513F] shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
      </svg>

      <span v-if="props.showLabel">
        {{ isDark ? 'Mode Siang' : 'Mode Malam' }}
      </span>
    </span>

    <span
      v-if="props.fullWidth"
      class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4EFE5] text-[#52675E]"
    >
      {{ isDark ? 'Gelap' : 'Terang' }}
    </span>
  </button>
</template>
