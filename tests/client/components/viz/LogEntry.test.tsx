import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { LogEntry } from '../../../../client/src/components/viz/LogEntry'
import type { GarminActivity, ActivityLeg } from '../../../../client/src/lib/garminApi'
import * as garminApi from '../../../../client/src/lib/garminApi'

const BASE_ACTIVITY: GarminActivity = {
  activity_id: 1,
  date: '2026-06-05',
  start_time: '2026-06-05 07:30:00',
  name: 'Morning Run',
  type_key: 'running',
  distance_m: 7900,
  duration_s: 3540,
  calories: 627,
  avg_hr: 148,
  elevation_m: null,
  aerobic_te: null,
  anaerobic_te: null,
  recovery_time_h: null,
  zone1_s: null,
  zone2_s: null,
  zone3_s: null,
  zone4_s: null,
  zone5_s: null,
  run_cadence: null,
  run_stride_cm: null,
  run_vert_osc_cm: null,
  run_gct_ms: null,
}

const WITH_TRAINING_EFFECT: GarminActivity = {
  ...BASE_ACTIVITY,
  aerobic_te: 3.8,
  anaerobic_te: 1.2,
  recovery_time_h: 24,
}

const WITH_ZONES: GarminActivity = {
  ...BASE_ACTIVITY,
  zone1_s: 120,
  zone2_s: 900,
  zone3_s: 600,
  zone4_s: 120,
  zone5_s: 60,
}

const WITH_RUN_DYNAMICS: GarminActivity = {
  ...BASE_ACTIVITY,
  run_cadence: 172,
  run_stride_cm: 115.5,
  run_vert_osc_cm: 8.4,
  run_gct_ms: 245,
}

const FULL_RUN: GarminActivity = {
  ...BASE_ACTIVITY,
  // training effect
  aerobic_te: 3.8,
  anaerobic_te: 1.2,
  recovery_time_h: 24,
  // zones
  zone1_s: 120,
  zone2_s: 900,
  zone3_s: 600,
  zone4_s: 120,
  zone5_s: 60,
  // run dynamics
  run_cadence: 172,
  run_stride_cm: 115.5,
  run_vert_osc_cm: 8.4,
  run_gct_ms: 245,
}

describe('LogEntry — header', () => {
  it('renders activity label and stats', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText(/7\.9 km/)).toBeInTheDocument()
  })

  it('renders the chevron character', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('›')).toBeInTheDocument()
  })

  it('chevron has no rotation by default', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('›')).toHaveStyle({ transform: 'none' })
  })

  it('chevron rotates 90deg when clicked', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'rotate(90deg)' })
  })

  it('chevron returns to none on second click', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'none' })
  })

  it('shows benefit tag when aerobic_te >= 3', () => {
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    expect(screen.getByText('IMPROVING')).toBeInTheDocument()
  })

  it('shows HIGHLY IMPROVING when aerobic_te >= 4', () => {
    const a = { ...WITH_TRAINING_EFFECT, aerobic_te: 4.2 }
    render(<LogEntry activity={a} accent="#fb923c" />)
    expect(screen.getByText('HIGHLY IMPROVING')).toBeInTheDocument()
  })

  it('does not show benefit tag when aerobic_te is null', () => {
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    expect(screen.queryByText('IMPROVING')).not.toBeInTheDocument()
    expect(screen.queryByText('HIGHLY IMPROVING')).not.toBeInTheDocument()
  })
})

describe('LogEntry — no expand panel without data', () => {
  it('does not show expand panel when all fields are null', async () => {
    const user = userEvent.setup()
    const { container } = render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    const panels = container.querySelectorAll('[style*="border-top"]')
    expect(panels).toHaveLength(0)
  })
})

describe('LogEntry — Training Effect section', () => {
  it('shows TRAINING EFFECT header after expand', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('TRAINING EFFECT')).toBeInTheDocument()
  })

  it('shows aerobic and anaerobic labels', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('AEROBIC')).toBeInTheDocument()
    expect(screen.getByText('ANAEROBIC')).toBeInTheDocument()
  })

  it('shows aerobic_te value', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('3.8')).toBeInTheDocument()
  })

  it('shows REC TIME badge when recovery_time_h is present', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('REC TIME 24H')).toBeInTheDocument()
  })

  it('does not show training effect section when aerobic_te is null', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_ZONES} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('TRAINING EFFECT')).not.toBeInTheDocument()
  })
})

describe('LogEntry — HR Zones section', () => {
  it('shows HR ZONES header after expand with zone data', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_ZONES} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('HR ZONES')).toBeInTheDocument()
  })

  it('shows zone labels in legend', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_ZONES} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText(/Z2/)).toBeInTheDocument()
  })

  it('does not show HR ZONES section when all zones are null', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_TRAINING_EFFECT} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('HR ZONES')).not.toBeInTheDocument()
  })
})

describe('LogEntry — Run Dynamics section', () => {
  it('shows RUNNING DYNAMICS header for run with dynamics data', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_RUN_DYNAMICS} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('RUNNING DYNAMICS')).toBeInTheDocument()
  })

  it('shows all 4 dynamic stat labels', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_RUN_DYNAMICS} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('CADENCE')).toBeInTheDocument()
    expect(screen.getByText('STRIDE')).toBeInTheDocument()
    expect(screen.getByText('VERT OSC')).toBeInTheDocument()
    expect(screen.getByText('GCT')).toBeInTheDocument()
  })

  it('shows cadence value', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={WITH_RUN_DYNAMICS} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('172')).toBeInTheDocument()
  })

  it('does not show RUNNING DYNAMICS for non-run activity', async () => {
    const user = userEvent.setup()
    const walkAct = { ...WITH_RUN_DYNAMICS, type_key: 'walking' }
    render(<LogEntry activity={walkAct} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('RUNNING DYNAMICS')).not.toBeInTheDocument()
  })

  it('does not show RUNNING DYNAMICS for run with null dynamics', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={BASE_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('RUNNING DYNAMICS')).not.toBeInTheDocument()
  })
})

describe('LogEntry — full expand with all sections', () => {
  it('shows all three section headers for a full run', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={FULL_RUN} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('TRAINING EFFECT')).toBeInTheDocument()
    expect(screen.getByText('HR ZONES')).toBeInTheDocument()
    expect(screen.getByText('RUNNING DYNAMICS')).toBeInTheDocument()
  })
})

const MULTI_SPORT_ACTIVITY: GarminActivity = {
  ...BASE_ACTIVITY,
  type_key: 'multi_sport',
}

const LEG_WITH_BATTERY_DRAIN: ActivityLeg = {
  leg_id: 1,
  activity_id: 1,
  leg_index: 0,
  type_key: 'cycling',
  start_time: '2026-06-05 07:30:00',
  duration_s: 1800,
  distance_m: 10000,
  calories: 300,
  avg_hr: 140,
  max_hr: 160,
  aerobic_te: null,
  anaerobic_te: null,
  training_load: null,
  body_battery_diff: -18,
  zone1_s: null, zone2_s: null, zone3_s: null, zone4_s: null, zone5_s: null,
  run_cadence: null, run_stride_cm: null, run_vert_osc_cm: null, run_gct_ms: null, run_power_w: null,
  row_stroke_rate: null, row_power_w: null, row_strokes: null,
}

describe('LogEntry — multisport leg body battery display', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a themed icon for body battery delta instead of a raw emoji', async () => {
    vi.spyOn(garminApi, 'fetchActivityLegs').mockResolvedValue([LEG_WITH_BATTERY_DRAIN])
    const user = userEvent.setup()
    const { container } = render(<LogEntry activity={MULTI_SPORT_ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByText(/-18/)).toBeInTheDocument())

    expect(container.textContent).not.toContain('🔋')
    expect(container.querySelector('[data-testid="battery-glyph"]')).not.toBeNull()
  })
})
