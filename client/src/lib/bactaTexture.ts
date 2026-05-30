import type { CSSProperties } from 'react'
import { hexA } from './hexA'

/** Global MX-4 OS texture: horizontal scanlines + accent grid. */
export function bactaTexture(accent: string): CSSProperties {
  const a = (x: number) => hexA(accent, x)
  return {
    backgroundImage:
      `repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 1px, transparent 1px, transparent 3px),` +
      `linear-gradient(${a(0.035)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.035)} 1px, transparent 1px)`,
    backgroundSize: '100% 3px, 26px 26px, 26px 26px',
  }
}
