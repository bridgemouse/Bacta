#!/usr/bin/env python3
"""Daily Garmin sync — run nightly via cron/systemd timer.
Fetches today + yesterday metrics and writes to SQLite.
Idempotent: INSERT OR REPLACE so safe to re-run."""

import os, json, sqlite3, sys, time
from datetime import date, timedelta
from garminconnect import Garmin

DB_PATH = os.environ.get('BACTA_DB', '/opt/bacta/data/bacta.db')
TOKEN_DIR = os.path.expanduser('~/.garminconnect')
SLEEP_BETWEEN = 0.4  # seconds between calls — stay polite to Garmin


# ─── DB helpers ────────────────────────────────────────────────────────────────

def connect_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    return db


def store(db, d, metric, value, unit='', raw=None):
    if value is None:
        return
    db.execute(
        'INSERT OR REPLACE INTO garmin_snapshots '
        '(date, metric, value, unit, source_json, created_at) '
        'VALUES (?, ?, ?, ?, ?, datetime("now"))',
        (d, metric, float(value), unit,
         json.dumps(raw) if raw is not None else None)
    )


def safe(obj, *keys, default=None):
    """Safely navigate nested dict/list without raising."""
    for k in keys:
        if obj is None:
            return default
        if isinstance(obj, dict):
            obj = obj.get(k)
        elif isinstance(obj, list):
            try:
                obj = obj[k]
            except (IndexError, TypeError):
                return default
        else:
            return default
    return obj if obj is not None else default


def _child_activity_ids(c, act_id):
    """Return child activity IDs for a multi_sport container, or [] if unavailable."""
    try:
        data = c.get_activity(act_id) or {}
        ids = (data.get('metadataDTO') or {}).get('childIds') or []
        if ids:
            return [int(i) for i in ids]
    except Exception:
        pass
    return []


def store_legs(db, c, parent_id, child_ids):
    """Fetch and store per-leg data for each child of a multi_sport activity."""
    RUN_TYPES = {'running', 'trail_running', 'treadmill_running'}
    ROW_TYPES = {'indoor_rowing', 'rowing'}
    for idx, child_id in enumerate(child_ids, 1):
        try:
            cdata = c.get_activity(child_id) or {}
            dtype = (cdata.get('activityTypeDTO') or {}).get('typeKey', 'other')
            dto   = cdata.get('summaryDTO') or {}
            is_run = dtype in RUN_TYPES
            is_row = dtype in ROW_TYPES

            zone1_s = zone2_s = zone3_s = zone4_s = zone5_s = None
            try:
                for z in (c.get_activity_hr_in_timezones(child_id) or []):
                    n = z.get('zoneNumber')
                    secs = int(z.get('secsInZone') or 0)
                    if   n == 1: zone1_s = (zone1_s or 0) + secs
                    elif n == 2: zone2_s = (zone2_s or 0) + secs
                    elif n == 3: zone3_s = (zone3_s or 0) + secs
                    elif n == 4: zone4_s = (zone4_s or 0) + secs
                    elif n == 5: zone5_s = (zone5_s or 0) + secs
                time.sleep(SLEEP_BETWEEN)
            except Exception:
                pass

            cadence  = dto.get('averageRunCadence') if is_run else None
            stride   = dto.get('strideLength')      if is_run else None
            vert_osc = dto.get('verticalOscillation') if is_run else None
            gct      = dto.get('groundContactTime') if is_run else None
            run_pwr  = dto.get('averagePower')      if is_run else None

            row_rate    = dto.get('averageStrokeCadence') if is_row else None
            row_pwr     = dto.get('averagePower')         if is_row else None
            row_strokes = dto.get('totalNumberOfStrokes') if is_row else None

            start_raw = (dto.get('startTimeLocal') or '')[:19].replace('T', ' ')
            cal = dto.get('calories')
            avg_hr = dto.get('averageHR')
            max_hr = dto.get('maxHR')

            db.execute(
                'INSERT OR REPLACE INTO garmin_activity_legs '
                '(leg_id, activity_id, leg_index, type_key, start_time, duration_s, distance_m, '
                'calories, avg_hr, max_hr, aerobic_te, anaerobic_te, training_load, body_battery_diff, '
                'zone1_s, zone2_s, zone3_s, zone4_s, zone5_s, '
                'run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms, run_power_w, '
                'row_stroke_rate, row_power_w, row_strokes) VALUES '
                '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                (
                    child_id, parent_id, idx, dtype, start_raw,
                    dto.get('duration'),
                    dto.get('distance'),
                    round(cal) if cal else None,
                    round(avg_hr) if avg_hr else None,
                    round(max_hr) if max_hr else None,
                    dto.get('trainingEffect'),
                    dto.get('anaerobicTrainingEffect'),
                    dto.get('activityTrainingLoad'),
                    dto.get('differenceBodyBattery'),
                    zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
                    round(cadence)       if cadence   else None,
                    round(stride, 1)     if stride    else None,
                    round(vert_osc, 1)   if vert_osc  else None,
                    round(gct)           if gct       else None,
                    round(run_pwr)       if run_pwr   else None,
                    round(row_rate)      if row_rate  else None,
                    round(row_pwr)       if row_pwr   else None,
                    round(row_strokes)   if row_strokes else None,
                )
            )
            time.sleep(SLEEP_BETWEEN)
        except Exception as e:
            print(f'    leg {child_id} error: {e}')
    db.commit()


# ─── Per-day sync ──────────────────────────────────────────────────────────────

def sync_day(db, c, d):
    """Fetch all per-day metrics for date d (YYYY-MM-DD)."""
    prev = str(date.fromisoformat(d) - timedelta(days=1))
    ok = []
    err = []

    # Stats (steps, RHR, stress, calories, distance, floors, intensity, body battery)
    try:
        s = c.get_stats(d)
        if s:
            store(db, d, 'steps',                safe(s, 'totalSteps'),               'steps')
            store(db, d, 'resting_hr',           safe(s, 'restingHeartRate'),         'bpm',   s)
            store(db, d, 'stress_avg',           safe(s, 'averageStressLevel'),       '',      s)
            store(db, d, 'calories_total',       safe(s, 'totalKilocalories'),        'kcal',  s)
            store(db, d, 'calories_active',      safe(s, 'activeKilocalories'),       'kcal',  s)
            store(db, d, 'distance_m',           safe(s, 'totalDistanceMeters'),      'm',     s)
            store(db, d, 'floors_up',            safe(s, 'floorsAscended'),           'floors')
            store(db, d, 'floors_down',          safe(s, 'floorsDescended'),          'floors')
            store(db, d, 'intensity_mod_min',    safe(s, 'moderateIntensityMinutes'), 'min',   s)
            store(db, d, 'intensity_vig_min',    safe(s, 'vigorousIntensityMinutes'), 'min',   s)
            store(db, d, 'body_battery_current', safe(s, 'bodyBatteryMostRecentValue'), '%',   s)
            store(db, d, 'body_battery_wake',    safe(s, 'bodyBatteryAtWakeTime'),    '%',     s)
            store(db, d, 'steps_goal',           safe(s, 'dailyStepGoal'),            'steps')
            store(db, d, 'floors_goal',          safe(s, 'userFloorsAscendedGoal'),   'floors')
        ok.append('stats')
    except Exception as e:
        err.append(f'stats({e})')
    time.sleep(SLEEP_BETWEEN)

    # RHR (dedicated endpoint, more precise than stats)
    try:
        s = c.get_rhr_day(d)
        if s:
            rhr = safe(s, 'restingHeartRate') or safe(s, 'value')
            store(db, d, 'resting_hr', rhr, 'bpm', s)
        ok.append('rhr')
    except Exception as e:
        err.append(f'rhr({e})')
    time.sleep(SLEEP_BETWEEN)

    # Sleep for date d = the night ending on d morning (prev→d)
    try:
        s = c.get_sleep_data(d)
        dto = safe(s, 'dailySleepDTO') or {}
        if dto:
            store(db, d, 'sleep_s',         (safe(dto, 'sleepTimeSeconds') or
                                          safe(dto, 'durationInSeconds')),    's',    s)
            store(db, d, 'sleep_deep_s',    safe(dto, 'deepSleepSeconds'),       's',    s)
            store(db, d, 'sleep_light_s',   safe(dto, 'lightSleepSeconds'),      's',    s)
            store(db, d, 'sleep_rem_s',     safe(dto, 'remSleepSeconds'),        's',    s)
            store(db, d, 'sleep_awake_s',   safe(dto, 'awakeSleepSeconds'),      's',    s)
            store(db, d, 'sleep_spo2',      safe(dto, 'averageSpO2Value'),       '%',    s)
            store(db, d, 'sleep_resp',      safe(dto, 'averageRespirationValue'),'brpm', s)
            store(db, d, 'sleep_hr',        safe(dto, 'avgHeartRate'),           'bpm',  s)
            store(db, d, 'sleep_stress',    safe(dto, 'avgSleepStress'),         '',     s)
            # sleep score lives in different places depending on firmware
            score = (safe(dto, 'sleepScore') or
                     safe(dto, 'sleepScores', 'overall', 'value') or
                     safe(s, 'sleepScores', 'overall', 'value'))
            store(db, d, 'sleep_score', score, '', s)
        ok.append('sleep')
    except Exception as e:
        err.append(f'sleep({e})')
    time.sleep(SLEEP_BETWEEN)

    # HRV
    try:
        s = c.get_hrv_data(d)
        summary = (safe(s, 'hrv_summary') or
                   safe(s, 'hrvSummary') or
                   (s if isinstance(s, dict) else {}))
        if summary:
            hrv = safe(summary, 'lastNightAvg') or safe(summary, 'lastNight') or safe(summary, 'weeklyAvg')
            store(db, d, 'hrv',               hrv,                                    'ms', s)
            store(db, d, 'hrv_week_avg',      safe(summary, 'weeklyAvg'),            'ms', s)
            store(db, d, 'hrv_baseline_low',  safe(summary, 'baseline', 'balancedLow'),   'ms', s)
            store(db, d, 'hrv_baseline_high', safe(summary, 'baseline', 'balancedUpper'), 'ms', s)
        ok.append('hrv')
    except Exception as e:
        err.append(f'hrv({e})')
    time.sleep(SLEEP_BETWEEN)

    # Body battery
    try:
        bb = c.get_body_battery(d, d)
        if bb and isinstance(bb, list) and len(bb) > 0:
            item = bb[0]
            store(db, d, 'body_battery_max', (safe(item, 'maxBatteryValue') or
                                               safe(item, 'charged')), '%', bb)
            store(db, d, 'body_battery_min', (safe(item, 'minBatteryValue') or
                                               safe(item, 'drained')), '%', bb)
        ok.append('body_battery')
    except Exception as e:
        err.append(f'body_battery({e})')
    time.sleep(SLEEP_BETWEEN)

    # Stress
    try:
        s = c.get_stress_data(d)
        if s:
            store(db, d, 'stress_avg', (safe(s, 'overallStressLevel') or
                                         safe(s, 'averageStressLevel')), '', s)
            store(db, d, 'stress_max', safe(s, 'maxStressLevel'), '', s)
        ok.append('stress')
    except Exception as e:
        err.append(f'stress({e})')
    time.sleep(SLEEP_BETWEEN)

    # SpO2
    try:
        s = c.get_spo2_data(d)
        if s:
            store(db, d, 'spo2_avg', (safe(s, 'averageSpO2') or
                                       safe(s, 'averageSPO2')), '%', s)
            store(db, d, 'spo2_min', (safe(s, 'minimumSpO2') or
                                       safe(s, 'lowestSPO2')), '%', s)
        ok.append('spo2')
    except Exception as e:
        err.append(f'spo2({e})')
    time.sleep(SLEEP_BETWEEN)

    # Respiration
    try:
        s = c.get_respiration_data(d)
        if s:
            store(db, d, 'resp_avg', (safe(s, 'avgWakingRespirationValue') or
                                       safe(s, 'averageRespirationValue')), 'brpm', s)
            store(db, d, 'resp_max',  safe(s, 'highestRespirationValue'),   'brpm', s)
        ok.append('respiration')
    except Exception as e:
        err.append(f'respiration({e})')
    time.sleep(SLEEP_BETWEEN)

    # Training readiness (returns a list — take first/most recent item)
    try:
        s = c.get_training_readiness(d)
        if s and isinstance(s, list) and len(s) > 0:
            item = s[0]
            store(db, d, 'recovery_score', safe(item, 'score'), '', s)
        ok.append('training_readiness')
    except Exception as e:
        err.append(f'training_readiness({e})')
    time.sleep(SLEEP_BETWEEN)

    # Training status + acute load
    try:
        s = c.get_training_status(d)
        if s:
            # navigate into per-device map — take the first (primary) device
            device_map = safe(s, 'mostRecentTrainingStatus', 'latestTrainingStatusData') or {}
            device = next(iter(device_map.values()), {})
            if device:
                store(db, d, 'training_status_n', safe(device, 'trainingStatus'), '', s)
                acute = safe(device, 'acuteTrainingLoadDTO') or {}
                store(db, d, 'training_load',     safe(acute, 'dailyTrainingLoadAcute'),  '', s)
                store(db, d, 'training_load_min', safe(acute, 'minTrainingLoadChronic'),   '', s)
                store(db, d, 'training_load_max', safe(acute, 'maxTrainingLoadChronic'),   '', s)
        ok.append('training_status')
    except Exception as e:
        err.append(f'training_status({e})')
    time.sleep(SLEEP_BETWEEN)

    # VO2max / max metrics
    try:
        s = c.get_max_metrics(d)
        if s:
            # get_max_metrics returns a list in some versions
            item = s[0] if isinstance(s, list) else s
            vo2 = (safe(item, 'generic', 'vo2MaxPreciseValue') or
                   safe(item, 'vo2MaxValue'))
            store(db, d, 'vo2max', vo2, 'mL/kg/min', s)
        ok.append('vo2max')
    except Exception as e:
        err.append(f'vo2max({e})')
    time.sleep(SLEEP_BETWEEN)

    # Fitness age
    try:
        s = c.get_fitnessage_data(d)
        if s:
            store(db, d, 'fitness_age', safe(s, 'fitnessAge'), 'years', s)
        ok.append('fitness_age')
    except Exception as e:
        err.append(f'fitness_age({e})')
    time.sleep(SLEEP_BETWEEN)

    # Heart rate zones — aggregate secsInZone across all activities for the day
    try:
        acts = c.get_activities_by_date(d, d) or []
        zone_secs = {}
        for act in acts:
            act_id = act.get('activityId')
            if not act_id:
                continue
            type_key = safe(act, 'activityType', 'typeKey') or ''
            if type_key == 'multi_sport':
                # Multi_sport containers return empty zones; use child sub-activities instead
                query_ids = _child_activity_ids(c, act_id) or [act_id]
            else:
                query_ids = [act_id]
            for qid in query_ids:
                try:
                    for z in (c.get_activity_hr_in_timezones(qid) or []):
                        n = z.get('zoneNumber')
                        if n and 1 <= n <= 5:
                            zone_secs[n] = zone_secs.get(n, 0) + (z.get('secsInZone') or 0)
                except Exception:
                    pass
        for n, secs in zone_secs.items():
            store(db, d, f'hrzone_{n}_min', round(secs / 60, 1), 'min')
        ok.append('hr_zones')
    except Exception as e:
        err.append(f'hr_zones({e})')
    time.sleep(SLEEP_BETWEEN)

    db.commit()
    status = f"  {d}: {len(ok)} ok"
    if err:
        status += f", {len(err)} errors: {', '.join(err)}"
    print(status)


# ─── Range-based metrics ───────────────────────────────────────────────────────

def sync_range(db, c, start, end):
    """Fetch metrics that use a date range API (past week)."""

    # Weigh-ins / body composition
    # NOTE: get_daily_weigh_ins(cdate) in v0.3.5 only accepts a single date.
    # Use get_weigh_ins(start, end) for range fetches → returns dailyWeightSummaries[].
    try:
        resp = c.get_weigh_ins(start, end)
        daily_summaries = safe(resp, 'dailyWeightSummaries') or []
        stored = 0
        for day in daily_summaries:
            d = safe(day, 'summaryDate')
            if not d:
                continue
            # Weight fields live inside latestWeight (or allWeightMetrics[0])
            latest = safe(day, 'latestWeight') or {}
            if not latest and safe(day, 'allWeightMetrics'):
                latest = safe(day, 'allWeightMetrics', 0) or {}
            if safe(latest, 'weight'):
                store(db, d, 'weight_kg',     safe(latest, 'weight'),          'kg', day)
                store(db, d, 'bmi',            safe(latest, 'bmi'),             '',   day)
                store(db, d, 'body_fat_pct',   safe(latest, 'bodyFatPercent'), '%',  day)
                store(db, d, 'muscle_mass_kg', safe(latest, 'muscleMass'),     'kg', day)
                stored += 1
        db.commit()
        print(f'  weigh-ins: {stored} rows with data (of {len(daily_summaries)} days)')
    except Exception as e:
        print(f'  weigh-ins error: {e}')
    time.sleep(SLEEP_BETWEEN)

    # intensity_mod_min / intensity_vig_min now fetched from get_stats per day

    # Activities — includes training effect, HR zones, run dynamics
    try:
        acts = c.get_activities_by_date(start, end)
        for act in (acts or []):
            d = (safe(act, 'startTimeLocal') or '')[:10]
            if not d:
                continue
            act_id = safe(act, 'activityId')
            type_key = safe(act, 'activityType', 'typeKey') or 'other'
            is_run = type_key in ('running', 'trail_running', 'treadmill_running')

            # Training effect + recovery time — available in activity list response
            aerobic_te      = safe(act, 'aerobicTrainingEffect')
            anaerobic_te    = safe(act, 'anaerobicTrainingEffect')
            recovery_time_h = safe(act, 'recoveryTime')  # Garmin returns hours

            # Per-activity HR zones — multi_sport containers return empty; use child IDs instead
            zone1_s = zone2_s = zone3_s = zone4_s = zone5_s = None
            if act_id:
                try:
                    query_ids = _child_activity_ids(c, act_id) if type_key == 'multi_sport' else [act_id]
                    for qid in query_ids:
                        for z in (c.get_activity_hr_in_timezones(qid) or []):
                            n = z.get('zoneNumber')
                            secs = int(z.get('secsInZone') or 0)
                            if   n == 1: zone1_s = (zone1_s or 0) + secs
                            elif n == 2: zone2_s = (zone2_s or 0) + secs
                            elif n == 3: zone3_s = (zone3_s or 0) + secs
                            elif n == 4: zone4_s = (zone4_s or 0) + secs
                            elif n == 5: zone5_s = (zone5_s or 0) + secs
                    time.sleep(SLEEP_BETWEEN)
                except Exception:
                    pass

            # Run dynamics — from get_activity() summaryDTO, run-type only
            run_cadence = run_stride_cm = run_vert_osc_cm = run_gct_ms = None
            if is_run and act_id:
                try:
                    act_data = c.get_activity(act_id) or {}
                    dto = act_data.get('summaryDTO') or {}
                    cadence  = dto.get('averageRunCadence')
                    stride   = dto.get('strideLength')         # returned in cm
                    vert_osc = dto.get('verticalOscillation')  # returned in cm
                    gct_ms   = dto.get('groundContactTime')
                    run_cadence     = round(cadence) if cadence is not None else None
                    run_stride_cm   = round(stride, 1) if stride is not None else None
                    run_vert_osc_cm = round(vert_osc, 1) if vert_osc is not None else None
                    run_gct_ms      = round(gct_ms) if gct_ms is not None else None
                    time.sleep(SLEEP_BETWEEN)
                except Exception:
                    pass

            db.execute(
                'INSERT OR REPLACE INTO garmin_activities '
                '(activity_id, date, start_time, name, type_key, distance_m, duration_s, '
                'calories, avg_hr, elevation_m, aerobic_te, anaerobic_te, recovery_time_h, '
                'zone1_s, zone2_s, zone3_s, zone4_s, zone5_s, '
                'run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (act_id, d,
                 safe(act, 'startTimeLocal'), safe(act, 'activityName'),
                 type_key,
                 safe(act, 'distance'), safe(act, 'duration'),
                 safe(act, 'calories'), safe(act, 'averageHR'), safe(act, 'elevationGain'),
                 aerobic_te, anaerobic_te, recovery_time_h,
                 zone1_s, zone2_s, zone3_s, zone4_s, zone5_s,
                 run_cadence, run_stride_cm, run_vert_osc_cm, run_gct_ms)
            )

            # For multisport containers, fetch and store per-leg data
            if type_key == 'multi_sport' and act_id:
                try:
                    child_ids = _child_activity_ids(c, act_id)
                    if child_ids:
                        store_legs(db, c, act_id, child_ids)
                except Exception as e:
                    print(f'    legs error for {act_id}: {e}')

        db.commit()
        print(f'  activities: {len(acts or [])} rows')
    except Exception as e:
        print(f'  activities error: {e}')


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    db = connect_db()
    c = Garmin()
    c.login(TOKEN_DIR)
    print(f'Authenticated as: {c.display_name}')

    today = date.today()
    yesterday = today - timedelta(days=1)
    week_ago = today - timedelta(days=7)

    print('Syncing per-day metrics (yesterday + today)...')
    for d in [str(yesterday), str(today)]:
        sync_day(db, c, d)

    print('Syncing range metrics (past 7 days)...')
    sync_range(db, c, str(week_ago), str(today))

    db.close()
    print('Done.')


if __name__ == '__main__':
    main()
