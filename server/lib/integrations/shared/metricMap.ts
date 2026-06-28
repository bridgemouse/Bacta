export const METRICS: Record<string, { unit: string; description: string }> = {
  hrv:                  { unit: 'ms',         description: 'HRV (RMSSD)' },
  resting_hr:           { unit: 'bpm',        description: 'Resting heart rate' },
  sleep_score:          { unit: 'score',      description: 'Sleep quality score (0–100)' },
  sleep_duration_s:     { unit: 's',          description: 'Total sleep duration' },
  deep_sleep_s:         { unit: 's',          description: 'Deep sleep duration' },
  rem_sleep_s:          { unit: 's',          description: 'REM sleep duration' },
  light_sleep_s:        { unit: 's',          description: 'Light sleep duration' },
  spo2:                 { unit: '%',          description: 'Blood oxygen saturation' },
  respiration:          { unit: 'brpm',       description: 'Breathing rate' },
  stress:               { unit: 'score',      description: 'Stress score' },
  steps:                { unit: 'count',      description: 'Daily steps' },
  vo2max:               { unit: 'ml/kg/min',  description: 'VO2 max estimate' },
  body_battery_charged: { unit: 'points',     description: 'Body battery charged' },
  readiness_score:      { unit: 'score',      description: 'Readiness score' },
  strain_score:         { unit: 'score',      description: 'Strain score' },
  weight_kg:            { unit: 'kg',         description: 'Body weight' },
  distance_m:           { unit: 'm',          description: 'Activity distance' },
}

export const METRIC_SOURCES: Record<string, Record<string, string>> = {
  garmin: {
    hrv:          'overnight RMSSD',
    resting_hr:   'sleep detection',
    sleep_score:  'accelerometer + HRV',
    spo2:         'optical sensor',
    stress:       'HRV-derived',
    respiration:  'optical sensor',
    steps:        'accelerometer',
    vo2max:       'VO2 Max algorithm',
  },
  oura: {
    hrv:            'infrared PPG',
    resting_hr:     'sleep detection',
    sleep_score:    'sleep algorithm',
    spo2:           'infrared + red LED',
    readiness_score:'readiness algorithm',
    respiration:    'optical sensor',
  },
  polar: {
    hrv:          'overnight RMSSD',
    resting_hr:   'sleep detection',
    sleep_score:  'sleep algorithm',
    vo2max:       'fitness test estimate',
  },
  whoop: {
    hrv:          'overnight RMSSD',
    resting_hr:   'sleep detection',
    strain_score: 'HR + exertion model',
    spo2:         'optical sensor',
  },
  withings: {
    resting_hr: 'optical HR',
    spo2:       'optical sensor',
    weight_kg:  'scale measurement',
  },
  strava: {
    distance_m: 'GPS',
    steps:      'GPS + accelerometer',
  },
  hevy: {},
}

export const PROVIDER_LABELS: Record<string, string> = {
  garmin:   'Garmin',
  oura:     'Oura Ring',
  polar:    'Polar',
  whoop:    'Whoop',
  withings: 'Withings',
  strava:   'Strava',
  hevy:     'Hevy',
}
