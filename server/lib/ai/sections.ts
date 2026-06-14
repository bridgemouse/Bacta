import type { SectionDef } from './types'

export const SECTIONS: SectionDef[] = [
  {
    id: 'recovery',
    name: 'Recovery',
    metrics: [
      'hrv', 'hrv_baseline_high', 'recovery_score', 'recovery_time_h',
      'stress_avg', 'body_battery_charged', 'body_battery_drained',
      'body_battery_wake', 'body_battery_current', 'resting_hr', 'sleep_duration',
    ],
    includeManual: false,
    promptAddendum: `Focus: overall recovery status — is Ethan ready to train hard today or should he pull back?
Lead with the most significant finding. HRV is the primary autonomic signal; recovery_score and body_battery are corroborating.
stress_avg and resting_hr provide additional autonomic context.
Include a clear training recommendation: green (go hard) / yellow (moderate only) / red (rest or easy).
Use queryDb to pull 30-day HRV and recovery_score trends before drawing conclusions.
Do not reference clinical framing — this is Ethan's data, analyzed for his use.`,
  },
  {
    id: 'sleep',
    name: 'Sleep',
    metrics: [
      'sleep_duration', 'sleep_score',
      'sleep_deep_minutes', 'sleep_rem_minutes',
      'sleep_light_minutes', 'sleep_awake_minutes',
      'sleep_stress', 'sleep_spo2', 'respiration_avg',
    ],
    includeManual: false,
    promptAddendum: `Focus: sleep architecture and quality — not just duration but composition.
Deep sleep (slow-wave) drives physical recovery and GH release. REM drives cognitive consolidation and memory.
Flag chronic deficiency in any stage. Ideal targets for a 26-year-old male athlete: deep ≥15% of total, REM ≥20%, awake <5%.
Use queryDb to pull 14-day sleep stage trends before assessing whether last night is anomalous or part of a pattern.
sleep_stress is Garmin's overnight autonomic stress estimate — lower is better; it correlates with parasympathetic recovery.`,
  },
  {
    id: 'training',
    name: 'Training',
    metrics: [
      'steps', 'intensity_minutes', 'training_load',
      'recovery_time_h', 'vo2max', 'training_status',
      'acwr', 'fitness_age', 'fitness_age_achievable',
    ],
    includeManual: true,
    promptAddendum: `Focus: training stimulus and load management — is Ethan building fitness or accumulating excessive stress?
Ethan's declared goal: VO2 max 52–55 ml/kg/min ('Excellent' for age 26 male) by late July/pre-wedding.
Use queryDb to pull 90 days of vo2max history to project current trajectory toward that target.
training_load is Garmin's 4-week weighted EPOC-based load score; acwr is acute:chronic workload ratio.
Optimal ACWR band is 0.8–1.3. Flag if above 1.5 (injury risk) or below 0.6 (detraining).
Use readVault to check the summer running plan and current training block targets if available.
If manual inputs are included, look for correlations: high caffeine + low readiness on the same day is worth noting.`,
  },
]
