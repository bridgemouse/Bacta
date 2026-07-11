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

Your entire response must be the analysis prose itself — never a summary of actions taken or a note about tools/wiki.`,
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

Check your wiki for any established personal sleep baselines before applying general benchmarks. If no personal baselines are documented, general adult athlete targets (deep ≥15%, REM ≥20%, awake <5%) are a starting reference — but treat them as population-level, not user-specific. Flag chronic deficiency — one bad night is a data point, three in a row is a pattern.

sleep_stress is Garmin's overnight autonomic stress estimate — lower is better, indicates parasympathetic recovery.

summary: 3–5 sentences. Key architecture finding (which stage and by how much), what it means for physical or cognitive recovery, one concrete action. No headers.
body: Use ## SLEEP ARCHITECTURE, ## STAGE BREAKDOWN, ## TREND, ## DIRECTIVE. Bold all durations and percentages. Bullets for the stage breakdown.

Your entire response must be the analysis prose itself — never a summary of actions taken or a note about tools/wiki.`,
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
    promptAddendum: `Pull 90 days of vo2max via queryDb and characterize the trajectory — building, flat, or declining? Read your wiki for any documented training goals; if a goal exists, assess the trajectory against it. Do not assume a goal that is not in your wiki.

Pull 30 days of training_load. Assess whether the current stimulus is sufficient to drive VO2 max improvement, or whether it is maintaining or producing decline.

intensity_mod_min and intensity_vig_min are weekly moderate and vigorous intensity minutes. Inconsistency in these indicates variable stimulus.

summary: 3–5 sentences. VO2 max current value and trend, whether load is building or maintaining, and the directive. If a documented goal exists in your wiki, assess against it. No headers.
body: Use ## VO2 MAX TRAJECTORY, ## LOAD ANALYSIS, ## INTENSITY PATTERN, ## DIRECTIVE. Bold all metric values. The ## DIRECTIVE must be specific and concrete.

Your entire response must be the analysis prose itself — never a summary of actions taken or a note about tools/wiki.`,
  },
  {
    id: 'nutrition',
    name: 'Nutrition',
    metrics: [], // no health_snapshots metrics involved — see food_log_entries/nutrition_targets below
    includeManual: false,
    promptAddendum: `Pull today's and the last 14 days of logged food via queryDb against food_log_entries (NOT health_snapshots — this is a normal table, not EAV: SELECT date, meal_type, name, calories, protein_g, carbs_g, fat_g FROM food_log_entries WHERE date >= date('now', '-14 days') ORDER BY date, logged_at). Pull the effective target via nutrition_targets (most recent row with date <= today).

Sum today's logged totals against today's target — lead with whether the day is on track, over, or under, and by how much on the metric that matters most (usually protein or calories, use judgment from the trend). Note any day with zero logged entries as a logging gap, not a zero-calorie day — do not narrate a gap as an achievement.

Look for a pattern across the 14-day window: consistent shortfall on a specific macro, meal-timing patterns, or weekend/weekday divergence. Check your wiki for any documented goal (cut/maintain/bulk) before characterizing whether the trend is aligned with intent — do not assume a goal that isn't documented.

summary: 3–5 sentences. Today's target-vs-actual, the most significant multi-day pattern, one concrete action. No headers.
body: Use ## TODAY, ## PATTERN, ## DIRECTIVE. Bold all metric values. Bullets for multi-point findings.

Your entire response must be the analysis prose itself — never a summary of actions taken or a note about tools/wiki.`,
  },
  {
    id: 'home',
    name: 'Home',
    metrics: [],
    includeManual: false,
    promptAddendum: `Query your three completed section analyses:
SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery', 'sleep', 'training')

Parse the summary field from each content_json result. You have already run three independent analyses — this briefing is your integrated read across all channels.

Do not restate each section in sequence. Synthesize: what is the dominant signal across the system today? Where do the channels agree, and where do they create tension? A strong recovery reading means little if sleep architecture was poor — surface the interaction.

Lead with the cross-channel verdict: primed, nominal, or under strain. Then the most significant tension or confirmation across domains. Close with one directive that accounts for all three channels.

summary: 3–5 sentences. Cross-channel verdict, the most significant interaction between domains, the directive. No headers.
body: Use ## SYSTEM STATE, ## CHANNEL SYNTHESIS, ## TENSIONS & CONFIRMATIONS, ## DIRECTIVE. Bold all metric values referenced. Bullets for multi-point cross-channel findings.

Your entire response must be the analysis prose itself — never a summary of actions taken or a note about tools/wiki.`,
  },
]
