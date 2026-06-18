import { useEffect, useState } from 'react'

export type LogoKey = 'capsule' | 'splash' | 'splat' | 'crown' | 'bloom' | 'orb' | 'vortex'

export const LOGO_OPTIONS: { key: LogoKey; label: string }[] = [
  { key: 'splash',  label: 'SPLASH'  },
  { key: 'capsule', label: 'CAPSULE' },
  { key: 'splat',   label: 'SPLAT'   },
  { key: 'crown',   label: 'CROWN'   },
  { key: 'bloom',   label: 'BLOOM'   },
  { key: 'orb',     label: 'ORB'     },
  { key: 'vortex',  label: 'VORTEX'  },
]

export const DEFAULT_LOGO: LogoKey = 'splash'

export function logoSrc(key: LogoKey) {
  return `/logos/logo-${key}.png`
}

export function useAppLogo() {
  const [logo, setLogo] = useState<LogoKey>(DEFAULT_LOGO)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        const v = s['app_logo'] as LogoKey | undefined
        if (v && LOGO_OPTIONS.some(o => o.key === v)) setLogo(v)
      })
      .catch(() => {})
  }, [])

  return logo
}
