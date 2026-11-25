interface LoginTransitionState {
  phase: 'idle' | 'entering' | 'revealing'
  adminName: string
  subtitle: string
}

export const useLoginTransition = () => {
  const state = useState<LoginTransitionState>('mypajak-login-transition', () => ({
    phase: 'idle',
    adminName: '',
    subtitle: ''
  }))

  const playLoginToHomeTransition = async (options: {
    name: string
    subtitle: string
    to: string | { path: string; query?: Record<string, string> }
  }) => {
    state.value = {
      phase: 'entering',
      adminName: options.name,
      subtitle: options.subtitle
    }

    // Fase 1: Tirai gradasi mengembang penuh & animasi sambutan berjalan
    await new Promise((resolve) => setTimeout(resolve, 920))

    // Fase 2: Pindah ke halaman tujuan di balik tirai gradasi agar mulus tanpa kedip
    await navigateTo(options.to, { replace: true })

    // Fase 3: Tirai gradasi terangkat halus membuka Beranda
    await new Promise((resolve) => setTimeout(resolve, 120))
    state.value = {
      ...state.value,
      phase: 'revealing'
    }

    await new Promise((resolve) => setTimeout(resolve, 680))
    state.value = {
      phase: 'idle',
      adminName: '',
      subtitle: ''
    }
  }

  return {
    transitionState: state,
    playLoginToHomeTransition
  }
}
