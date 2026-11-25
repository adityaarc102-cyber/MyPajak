export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const INTERACTIVE_SELECTOR =
    'button:not(:disabled), a[href], [role="button"], [role="tab"], .card-interactive, label, summary, input[type="checkbox"], input[type="radio"]'

  const spawnViewportBurst = (clientX: number, clientY: number, isLight: boolean) => {
    const burst = document.createElement('div')
    burst.className = 'tap-burst-root'
    burst.style.left = `${clientX}px`
    burst.style.top = `${clientY}px`

    // 2 cincin gelombang luar di titik sentuh (tetap halus meski halaman langsung berpindah)
    const outerRing1 = document.createElement('span')
    outerRing1.className = isLight
      ? 'tap-burst-ring tap-burst-ring--light'
      : 'tap-burst-ring tap-burst-ring--teal'

    const outerRing2 = document.createElement('span')
    outerRing2.className = isLight
      ? 'tap-burst-ring tap-burst-ring--delay tap-burst-ring--light'
      : 'tap-burst-ring tap-burst-ring--delay tap-burst-ring--teal'

    burst.appendChild(outerRing1)
    burst.appendChild(outerRing2)

    // 6 percikan cahaya mikro memancar simetris dari titik klik
    const sparkColors = isLight
      ? ['#FFFFFF', '#A7F3D0', '#5EEAD4', '#FDE68A', '#FFFFFF', '#6EE7B7']
      : ['#0F766E', '#14B8A6', '#F06A47', '#2B634C', '#34D399', '#0F766E']

    const sparkCount = 6
    const baseAngle = Math.random() * 35
    for (let i = 0; i < sparkCount; i += 1) {
      const spark = document.createElement('span')
      spark.className = 'tap-burst-spark'
      const angleDeg = baseAngle + i * (360 / sparkCount) + (Math.random() * 14 - 7)
      const angleRad = (angleDeg * Math.PI) / 180
      const dist = 24 + Math.random() * 16
      const dx = Math.cos(angleRad) * dist
      const dy = Math.sin(angleRad) * dist

      spark.style.setProperty('--tx', `${dx.toFixed(1)}px`)
      spark.style.setProperty('--ty', `${dy.toFixed(1)}px`)
      spark.style.backgroundColor = sparkColors[i % sparkColors.length] || '#0F766E'
      burst.appendChild(spark)
    }

    document.body.appendChild(burst)
    window.setTimeout(() => {
      burst.remove()
    }, 680)
  }

  const handlePointerDown = (event: PointerEvent) => {
    const rawTarget = event.target as HTMLElement | null
    if (!rawTarget) return

    const el = rawTarget.closest(INTERACTIVE_SELECTOR) as HTMLElement | null

    const classStr = el && typeof el.className === 'string' ? el.className : ''
    const insideVibrantSurface = Boolean(
      rawTarget.closest('.sidebar-teal-surface, .hero-surface, .login-brand-admin-alive')
    )
    const hasSolidColoredBg =
      /login-btn-gradient|bg-\[#(F06A47|DC5736|0F766E|0C5D57|1F513F|2D6A4F|164234|1D4ED8)\]|bg-(slate-900|emerald-600|teal-600|teal-700|rose-600)/.test(
        classStr
      )
    const isLightWave = insideVibrantSurface || hasSolidColoredBg

    // Selalu munculkan gelombang sentuh + percikan cahaya di titik klik
    spawnViewportBurst(event.clientX, event.clientY, isLightWave)

    if (!el || el.dataset.noRipple === 'true') return

    const rect = el.getBoundingClientRect()
    if (rect.width < 16 || rect.height < 16) return

    // Hindari mengubah elemen inline biasa
    const style = window.getComputedStyle(el)
    if (style.display === 'inline') return

    const activeCount = Number(el.dataset.activeWaves || '0')
    if (activeCount === 0) {
      if (style.position === 'static') {
        el.dataset.prevPosition = el.style.position || ''
        el.style.position = 'relative'
      }
      if (style.overflow !== 'hidden') {
        el.dataset.prevOverflow = el.style.overflow || ''
        el.style.overflow = 'hidden'
      }
    }
    el.dataset.activeWaves = String(activeCount + 1)

    // Efek pantulan pegas mikro pada elemen yang ditekan (kecuali menu nav-instant)
    if (!el.classList.contains('nav-instant')) {
      el.classList.remove('click-spring-pop')
      void el.offsetWidth
      el.classList.add('click-spring-pop')
    }

    const size = Math.max(rect.width, rect.height) * 2.2
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2

    // Lapis 1: Inti gelombang gradasi cahaya
    const waveCore = document.createElement('span')
    waveCore.className = isLightWave
      ? 'click-ripple click-ripple--light'
      : 'click-ripple click-ripple--teal'
    waveCore.style.width = `${size}px`
    waveCore.style.height = `${size}px`
    waveCore.style.left = `${x}px`
    waveCore.style.top = `${y}px`

    // Lapis 2: Cincin gelombang pertama
    const waveRing1 = document.createElement('span')
    waveRing1.className = isLightWave
      ? 'click-wave-ring click-wave-ring--light'
      : 'click-wave-ring click-wave-ring--teal'
    waveRing1.style.width = `${size}px`
    waveRing1.style.height = `${size}px`
    waveRing1.style.left = `${x}px`
    waveRing1.style.top = `${y}px`

    // Lapis 3: Cincin gelombang kedua menyusul di belakangnya
    const waveRing2 = document.createElement('span')
    waveRing2.className = isLightWave
      ? 'click-wave-ring click-wave-ring--second click-wave-ring--light'
      : 'click-wave-ring click-wave-ring--second click-wave-ring--teal'
    waveRing2.style.width = `${size}px`
    waveRing2.style.height = `${size}px`
    waveRing2.style.left = `${x}px`
    waveRing2.style.top = `${y}px`

    // Kilau cahaya melintas di permukaan tombol/kartu
    const sheen = document.createElement('span')
    sheen.className = isLightWave
      ? 'click-sheen click-sheen--light'
      : 'click-sheen click-sheen--teal'

    el.appendChild(waveCore)
    el.appendChild(waveRing1)
    el.appendChild(waveRing2)
    el.appendChild(sheen)

    window.setTimeout(() => {
      waveCore.remove()
      waveRing1.remove()
      waveRing2.remove()
      sheen.remove()

      const remaining = Math.max(0, Number(el.dataset.activeWaves || '1') - 1)
      el.dataset.activeWaves = String(remaining)
      if (remaining === 0) {
        el.classList.remove('click-spring-pop')
        if ('prevOverflow' in el.dataset) {
          el.style.overflow = el.dataset.prevOverflow || ''
          delete el.dataset.prevOverflow
        }
        if ('prevPosition' in el.dataset) {
          el.style.position = el.dataset.prevPosition || ''
          delete el.dataset.prevPosition
        }
        delete el.dataset.activeWaves
      }
    }, 820)
  }

  document.addEventListener('pointerdown', handlePointerDown, { passive: true })
})
