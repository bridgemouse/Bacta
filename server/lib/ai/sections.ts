import type { SectionDef } from './types'

export const SECTIONS: SectionDef[] = [
  {
    id: 'recovery',
    name: 'Recovery',
    metrics: [
      'hrv', 'hrv_baseline_high', 'hrv_baseline_low', 'hrv_week_avg', 'recovery_score', 'recovery_time_h',
      'stress_avg', 'body_battery_charged', 'body_battery_drained',
      'body_battery_wake', 'body_battery_current', 'resting_hr', 'sleep_s',
    ],
    includeManual: false,
    promptAddendum: `Pull 30 days of HRV and recovery_score via queryDb. Pull today's resting_hr, stress_avg, body_battery_wake, and body_battery_current.

Lead with the most significant finding — what changed or what is notable today versus the 30-day trend. HRV is the primary autonomic signal. Recovery score and body battery are corroborating.

Issue a clear training recommendation: green (go hard) / yellow (moderate only) / red (rest or easy). State it directly in the summary and in the ## DIRECTIVE section of the body.

summary: 3–5 sentences. Key autonomic finding, what it means for today's training, the directive. No headers.
body: Use ## HRV, ## RECOVERY MARKERS, ## DIRECTIVE. Bold all metric values. Bullets for multi-point findings.

After writing: decide if anything is worth updating in your wiki — HRV baseline shifts, sustained trend changes, or a new pattern worth tracking.`,
  },
  {
    id: 'sleep',
    name: 'Sleep',
    metrics: [
      'sleep_s', 'sleep_score',
      'sleep_deep_s', 'sleep_rem_s',
      'sleep_light_s', 'sleep_awake_s',
      'sleep_stress', 'sleep_spo2', 'resp_avg',
    ],
    includeManual: false,
    promptAddendum: `Pull 14 days of sleep stage data via queryDb: sleep_s, sleep_deep_s, sleep_rem_s, sleep_awake_s, sleep_score. Calculate each stage as a percentage of total sleep to assess architecture.

Targets for a 26M athlete: deep ≥15% of total, REM ≥20%, awake <5%. Flag chronic deficiency — one bad night is a data point, three in a row is a pattern.

sleep_stress is Garmin's overnight autonomic stress estimate — lower is better, indicates parasympathetic recovery.

summary: 3–5 sentences. Key architecture finding (which stage and by how much), what it means for physical or cognitive recovery, one concrete action. No headers.
body: Use ## SLEEP ARCHITECTURE, ## STAGE BREAKDOWN, ## TREND, ## DIRECTIVE. Bold all durations and percentages. Bullets for the stage breakdown.

After writing: if deep sleep deficit is a sustained pattern (>3 nights), update or create a wiki page for sleep-architecture.`,
  },
  {
    id: 'training',
    name: 'Training',
    metrics: [
      'steps', 'intensity_mod_min', 'intensity_vig_min', 'training_load',
      'recovery_time_h', 'vo2max', 'training_status_n',
      'fitness_age', 'fitness_age_achievable',
    ],
    includeManual: true,
    promptAddendum: `Pull 90 days of vo2max via queryDb and project the trajectory toward the July target (52–55 ml/kg/min). State the projection directly — where does current trajectory land by late July?

Pull 30 days of training_load. Assess whether the stimulus is sufficient to drive VO2 max gains or whether it is merely maintaining.

intensity_mod_min and intensity_vig_min are weekly moderate and vigorous intensity minutes. Inconsistency in these indicates variable stimulus.

Do not attempt readVault — vault is inaccessible per standing orders.

summary: 3–5 sentences. VO2 max trajectory toward July target, whether current load is building or maintaining, and what needs to change. No headers.
body: Use ## VO2 MAX TRAJECTORY, ## LOAD ANALYSIS, ## INTENSITY PATTERN, ## DIRECTIVE. Bold all metric values. The ## DIRECTIVE must address the July target specifically.

After writing: update the vo2max-trajectory wiki page with the current projection and date.`,
  },
]
