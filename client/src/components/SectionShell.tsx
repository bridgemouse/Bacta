import { MX4Sigil } from './primitives/MX4Sigil'
import { TransmissionPanel } from './MX4Card'
import { hexA } from '../lib/hexA'
import { COLORS, FONT_MONO, SECTION_ACCENTS, SECTION_LABELS } from '../theme'
import type { SectionKey } from '../theme'

type NonHomeSectionKey = Exclude<SectionKey, 'home'>

interface SectionShellProps {
  section: NonHomeSectionKey
}

const GREETINGS: Record<NonHomeSectionKey, string> = {
  recovery:  'Recovery channel online. Battery and HRV trends will surface here once the system is wired in.',
  training:  'Training channel online. Load, blocks, and session protocols will populate here.',
  sleep:     'Sleep channel online. Stages, score, and debt readouts will live here.',
  nutrition: 'Nutrition channel online. Intake, macros, and targets will surface here.',
  bloodwork: 'Blood Work channel online. Panels, biomarkers, and flags will populate here.',
  dailylog:  'Daily Log channel online. Your entries and check-ins will live here.',
}

export function SectionShell({ section }: SectionShellProps) {
  const accent = SECTION_ACCENTS[section]
  const label = SECTION_LABELS[section]

  return (
    <>
      <TransmissionPanel
        accent={accent}
        mood="idle"
        label={`MX-4 // ${label.toUpperCase()}`}
        meta="STANDBY"
        assessment={GREETINGS[section]}
        chips={[
          ['CH', label.toUpperCase()],
          ['DATA', 'PENDING'],
        ]}
      />

      {/* Channel rail */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: accent,
          }}
        >
          {label.toUpperCase()}
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${accent}44, transparent)`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            color: COLORS.textMuted,
          }}
        >
          CALIBRATING
        </span>
      </div>

      {/* Shimmer skeleton cards */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: hexA(accent, 0.04),
            border: `1px solid ${hexA(accent, 0.12)}`,
            borderRadius: 10,
            padding: '14px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              height: 10,
              borderRadius: 5,
              marginBottom: 10,
              width: '55%',
              background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'mx4shimmer 1.6s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 22,
              borderRadius: 5,
              marginBottom: 8,
              width: '35%',
              background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'mx4shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
          <div
            style={{
              height: 8,
              borderRadius: 5,
              width: '70%',
              background: `linear-gradient(90deg, ${hexA(accent, 0.06)} 25%, ${hexA(accent, 0.16)} 50%, ${hexA(accent, 0.06)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'mx4shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.24}s`,
            }}
          />
        </div>
      ))}

      {/* Calibrating footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 0 4px',
        }}
      >
        <MX4Sigil color={accent} size={15} mood="think" spin />
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.12em',
            color: COLORS.textMuted,
          }}
        >
          MX-4 IS CALIBRATING THIS SYSTEM
        </span>
      </div>
    </>
  )
}
