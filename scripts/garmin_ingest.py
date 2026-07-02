#!/usr/bin/env python3
"""One-time historical Garmin ingest — run manually to backfill all history.
Usage:
  python3 garmin_ingest.py               # last 365 days
  python3 garmin_ingest.py --days 730    # last 2 years
  python3 garmin_ingest.py --replace     # overwrite existing rows

Uses INSERT OR IGNORE by default (safe to re-run, skips rows already stored).
Shows a progress indicator. Adds small sleeps between calls to avoid rate limits."""

import os, json, sqlite3, sys, time, argparse
from datetime import date, timedelta
from garminconnect import Garmin
from garmin_poller import extract_activity_summary_fields

DB_PATH = os.environ.get('BACTA_DB', '/opt/bacta/data/bacta.db')
TOKEN_DIR = os.path.expanduser('~/.garminconnect')
SLEEP_PER_CALL = 0.5   # between API calls within a day
SLEEP_PER_DAY  = 0.2   # extra sleep after each day's batch


# ─── DB helpers ────────────────────────────────────────────────────────────────

def connect_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    return db


def make_store(replace=False):
    verb = 'INSERT OR REPLACE' if replace else 'INSERT OR IGNORE'
    def store(db, d, metric, value, unit='', raw=None):
        if value is None:
            return
        db.execute(
            f'{verb} INTO health_snapshots '
            '(date, metric, value, unit, source_json, created_at) '
            'VALUES (?, ?, ?, ?, ?, datetime("now"))',
            (d, metric, float(value), unit,
             json.dumps(raw) if raw is not None else None)
        )
    return store


def safe(obj, *keys, default=None):
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


# ─── Per-day sync ──────────────────────────────────────────────────────────────

def sync_day(db, store, c, d):
    prev = str(date.fromisoformat(d) - timedelta(days=1))
    errors = []

    # Stats
    try:
        s = c.get_stats(d)
        if s:
            store(db, d, 'steps',                safe(s, 'totalSteps'),               'steps', s)
            store(db, d, 'resting_hr',           safe(s, 'restingHeartRate'),         'bpm',   s)
            store(db, d, 'stress_avg',           safe(s, 'averageStressLevel'),       '',      s)
            store(db, d, 'calories_total',       safe(s, 'totalKilocalories'),        'kcal',  s)
            store(db, d, 'calories_active',      safe(s, 'activeKilocalories'),       'kcal',  s)
            store(db, d, 'distance_m',           safe(s, 'totalDistanceMeters'),      'm',     s)
            store(db, d, 'floors_up',            safe(s, 'floorsAscended'),           'floors', s)
            store(db, d, 'floors_down',          safe(s, 'floorsDescended'),          'floors', s)
            store(db, d, 'intensity_mod_min',    safe(s, 'moderateIntensityMinutes'), 'min',   s)
            store(db, d, 'intensity_vig_min',    safe(s, 'vigorousIntensityMinutes'), 'min',   s)
            store(db, d, 'body_battery_current', safe(s, 'bodyBatteryMostRecentValue'), '%',   s)
            store(db, d, 'body_battery_wake',    safe(s, 'bodyBatteryAtWakeTime'),    '%',     s)
    except Exception as e:
        errors.append(f'stats({e})')
    time.sleep(SLEEP_PER_CALL)

    # RHR (dedicated endpoint)
    try:
        s = c.get_rhr_day(d)
        if s:
            rhr = safe(s, 'restingHeartRate') or safe(s, 'value')
            store(db, d, 'resting_hr', rhr, 'bpm', s)
    except Exception as e:
        errors.append(f'rhr({e})')
    time.sleep(SLEEP_PER_CALL)

    # Sleep for date d = the night ending on d morning (prev→d)
    try:
        s = c.get_sleep_data(d)
        dto = safe(s, 'dailySleepDTO') or {}
        if dto:
            store(db, d, 'sleep_s',       (safe(dto, 'sleepTimeSeconds') or
                                      safe(dto, 'durationInSeconds')),    's',    s)
            store(db, d, 'sleep_deep_s',  safe(dto, 'deepSleepSeconds'),       's',    s)
            store(db, d, 'sleep_light_s', safe(dto, 'lightSleepSeconds'),      's',    s)
            store(db, d, 'sleep_rem_s',   safe(dto, 'remSleepSeconds'),        's',    s)
            store(db, d, 'sleep_awake_s', safe(dto, 'awakeSleepSeconds'),      's',    s)
            store(db, d, 'sleep_spo2',    safe(dto, 'averageSpO2Value'),       '%',    s)
            store(db, d, 'sleep_resp',    safe(dto, 'averageRespirationValue'),'brpm', s)
            store(db, d, 'sleep_hr',      safe(dto, 'avgHeartRate'),           'bpm',  s)
            store(db, d, 'sleep_stress',  safe(dto, 'avgSleepStress'),         '',     s)
            score = (safe(dto, 'sleepScore') or
                     safe(dto, 'sleepScores', 'overall', 'value') or
                     safe(s,   'sleepScores', 'overall', 'value'))
            store(db, d, 'sleep_score', score, '', s)
    except Exception as e:
        errors.append(f'sleep({e})')
    time.sleep(SLEEP_PER_CALL)

    # HRV
    try:
        s = c.get_hrv_data(d)
        summary = (safe(s, 'hrv_summary') or
                   safe(s, 'hrvSummary') or
                   (s if isinstance(s, dict) else {}))
        if summary:
            hrv = safe(summary, 'lastNightAvg') or safe(summary, 'lastNight') or safe(summary, 'weeklyAvg')
            store(db, d, 'hrv',               hrv,                                         'ms', s)
            store(db, d, 'hrv_week_avg',      safe(summary, 'weeklyAvg'),                 'ms', s)
            store(db, d, 'hrv_baseline_low',  safe(summary, 'baseline', 'balancedLow'),   'ms', s)
            store(db, d, 'hrv_baseline_high', safe(summary, 'baseline', 'balancedUpper'), 'ms', s)
    except Exception as e:
        errors.append(f'hrv({e})')
    time.sleep(SLEEP_PER_CALL)

    # Body battery
    try:
        bb = c.get_body_battery(d, d)
        if bb and isinstance(bb, list) and len(bb) > 0:
            item = bb[0]
            store(db, d, 'body_battery_charged', safe(item, 'charged'), '%', bb)
            store(db, d, 'body_battery_drained', safe(item, 'drained'), '%', bb)
    except Exception as e:
        errors.append(f'body_battery({e})')
    time.sleep(SLEEP_PER_CALL)

    # Stress
    try:
        s = c.get_stress_data(d)
        if s:
            store(db, d, 'stress_avg', (safe(s, 'overallStressLevel') or
                                         safe(s, 'averageStressLevel')), '', s)
            store(db, d, 'stress_max',  safe(s, 'maxStressLevel'), '', s)
    except Exception as e:
        errors.append(f'stress({e})')
    time.sleep(SLEEP_PER_CALL)

    # SpO2
    try:
        s = c.get_spo2_data(d)
        if s:
            store(db, d, 'spo2_avg', (safe(s, 'averageSpO2') or safe(s, 'averageSPO2')), '%', s)
            store(db, d, 'spo2_min', (safe(s, 'minimumSpO2') or safe(s, 'lowestSPO2')), '%', s)
    except Exception as e:
        errors.append(f'spo2({e})')
    time.sleep(SLEEP_PER_CALL)

    # Respiration
    try:
        s = c.get_respiration_data(d)
        if s:
            store(db, d, 'resp_avg', (safe(s, 'avgWakingRespirationValue') or
                                       safe(s, 'averageRespirationValue')), 'brpm', s)
            store(db, d, 'resp_max',  safe(s, 'highestRespirationValue'), 'brpm', s)
    except Exception as e:
        errors.append(f'respiration({e})')
    time.sleep(SLEEP_PER_CALL)

    # Training readiness (returns a list — take first/most recent item)
    try:
        s = c.get_training_readiness(d)
        if s and isinstance(s, list) and len(s) > 0:
            store(db, d, 'recovery_score', safe(s, 0, 'score'), '', s)
    except Exception as e:
        errors.append(f'training_readiness({e})')
    time.sleep(SLEEP_PER_CALL)

    # Training status + acute load
    try:
        s = c.get_training_status(d)
        if s:
            device_map = safe(s, 'mostRecentTrainingStatus', 'latestTrainingStatusData') or {}
            device = next(iter(device_map.values()), {})
            if device:
                store(db, d, 'training_status_n', safe(device, 'trainingStatus'), '', s)
                acute = safe(device, 'acuteTrainingLoadDTO') or {}
                store(db, d, 'training_load',     safe(acute, 'dailyTrainingLoadAcute'),  '', s)
                store(db, d, 'training_load_min', safe(acute, 'minTrainingLoadChronic'),   '', s)
                store(db, d, 'training_load_max', safe(acute, 'maxTrainingLoadChronic'),   '', s)
    except Exception as e:
        errors.append(f'training_status({e})')
    time.sleep(SLEEP_PER_CALL)

    # VO2max
    try:
        s = c.get_max_metrics(d)
        if s:
            item = s[0] if isinstance(s, list) else s
            vo2 = (safe(item, 'generic', 'vo2MaxPreciseValue') or
                   safe(item, 'vo2MaxValue'))
            store(db, d, 'vo2max', vo2, 'mL/kg/min', s)
    except Exception as e:
        errors.append(f'vo2max({e})')
    time.sleep(SLEEP_PER_CALL)

    # Fitness age (only changes occasionally — still worth recording each day)
    try:
        s = c.get_fitnessage_data(d)
        if s:
            store(db, d, 'fitness_age', safe(s, 'fitnessAge'), 'years', s)
    except Exception as e:
        errors.append(f'fitness_age({e})')
    time.sleep(SLEEP_PER_CALL)

    # Heart rate zones — aggregate secsInZone across all activities for the day
    # multi_sport containers return empty zones; query child activity IDs instead
    try:
        acts = c.get_activities_by_date(d, d) or []
        zone_secs = {}
        for act in acts:
            act_id = act.get('activityId')
            if not act_id:
                continue
            type_key = safe(act, 'activityType', 'typeKey') or ''
            if type_key == 'multi_sport':
                ids = []
                try:
                    data = c.get_activity(act_id) or {}
                    ids = [int(i) for i in ((data.get('metadataDTO') or {}).get('childIds') or [])]
                except Exception:
                    pass
                query_ids = ids or [act_id]
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
    except Exception as e:
        errors.append(f'hr_zones({e})')
    time.sleep(SLEEP_PER_CALL)

    db.commit()
    return errors


# ─── Range-based bulk fetches ──────────────────────────────────────────────────

def sync_range_bulk(db, store, c, start, end):
    print(f'\nFetching range metrics ({start} → {end})...')

    # Weigh-ins — v0.3.5: get_daily_weigh_ins only takes one date; use get_weigh_ins for range
    try:
        resp = c.get_weigh_ins(start, end)
        daily_summaries = safe(resp, 'dailyWeightSummaries') or []
        stored = 0
        for day in daily_summaries:
            d = safe(day, 'summaryDate')
            if not d:
                continue
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
        print(f'  weigh-ins:          {stored:4d} rows with data (of {len(daily_summaries)} days)')
    except Exception as e:
        print(f'  weigh-ins error: {e}')
    time.sleep(SLEEP_PER_CALL)

    # Intensity minutes
    try:
        rows = c.get_intensity_minutes_data(start, end)
        for row in (rows or []):
            d = safe(row, 'calendarDate') or safe(row, 'summaryDate')
            if d:
                store(db, d, 'intensity_mod_min', safe(row, 'moderateIntensityMinutes'), 'min', row)
                store(db, d, 'intensity_vig_min',  safe(row, 'vigorousIntensityMinutes'), 'min', row)
        db.commit()
        print(f'  intensity_minutes:  {len(rows or []):4d} rows')
    except Exception as e:
        print(f'  intensity_minutes error: {e}')
    time.sleep(SLEEP_PER_CALL)

    # Blood pressure
    try:
        rows = c.get_blood_pressure(start, end)
        measurements = safe(rows, 'measurementSummaries') or rows or []
        for row in (measurements if isinstance(measurements, list) else []):
            d = safe(row, 'measurementTimestampLocal', default='')[:10]
            if d:
                store(db, d, 'bp_systolic',  safe(row, 'systolic'),  'mmHg', row)
                store(db, d, 'bp_diastolic', safe(row, 'diastolic'), 'mmHg', row)
        db.commit()
        print(f'  blood_pressure:     {len(measurements if isinstance(measurements, list) else []):4d} rows')
    except Exception as e:
        print(f'  blood_pressure error: {e}')
    time.sleep(SLEEP_PER_CALL)

    # Activities
    # NOTE: pre-existing gap (not introduced by #41) — this bulk-ingest path stores fewer
    # columns than garmin_poller.py's sync_range (no aerobic_te/zones/run-dynamics here).
    # Out of scope for #41; only the new expansion fields below are added to close that gap
    # incrementally, per the issue's requirement that ingest and poller both populate them.
    try:
        acts = c.get_activities_by_date(start, end)
        for act in (acts or []):
            d = (safe(act, 'startTimeLocal') or '')[:10]
            if not d:
                continue
            act_id = safe(act, 'activityId')
            type_key = safe(act, 'activityType', 'typeKey') or 'other'
            summary_fields = extract_activity_summary_fields({}, type_key)
            if act_id:
                try:
                    act_data = c.get_activity(act_id) or {}
                    summary_fields = extract_activity_summary_fields(
                        act_data.get('summaryDTO') or {}, type_key)
                    time.sleep(SLEEP_PER_CALL)
                except Exception:
                    pass
            db.execute(
                'INSERT OR REPLACE INTO health_activities '
                '(activity_id, date, start_time, name, type_key, distance_m, duration_s, calories, avg_hr, elevation_m, '
                'max_hr, min_hr, training_load, body_battery_diff, '
                'moving_duration_s, elapsed_duration_s, avg_speed_mps, max_speed_mps, '
                'training_effect_label, steps, bmr_calories, '
                'moderate_intensity_min, vigorous_intensity_min, '
                'avg_power_w, normalized_power_w, active_sets, total_exercise_reps) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (act_id, d,
                 safe(act, 'startTimeLocal'), safe(act, 'activityName'),
                 type_key,
                 safe(act, 'distance'), safe(act, 'duration'),
                 safe(act, 'calories'), safe(act, 'averageHR'),
                 safe(act, 'elevationGain'),
                 summary_fields['max_hr'], summary_fields['min_hr'],
                 summary_fields['training_load'], summary_fields['body_battery_diff'],
                 summary_fields['moving_duration_s'], summary_fields['elapsed_duration_s'],
                 summary_fields['avg_speed_mps'], summary_fields['max_speed_mps'],
                 summary_fields['training_effect_label'], summary_fields['steps'],
                 summary_fields['bmr_calories'],
                 summary_fields['moderate_intensity_min'], summary_fields['vigorous_intensity_min'],
                 summary_fields['avg_power_w'], summary_fields['normalized_power_w'],
                 summary_fields['active_sets'], summary_fields['total_exercise_reps'])
            )
        db.commit()
        print(f'  activities:         {len(acts or []):4d} rows')
    except Exception as e:
        print(f'  activities error: {e}')
    time.sleep(SLEEP_PER_CALL)

    # Endurance score (single aggregate for the range)
    try:
        s = c.get_endurance_score(start, end)
        if s:
            score = safe(s, 'score') or safe(s, 'enduranceScore')
            store(db, end, 'endurance_score', score, '', s)
        db.commit()
        print(f'  endurance_score:    snapshot stored')
    except Exception as e:
        print(f'  endurance_score error: {e}')
    time.sleep(SLEEP_PER_CALL)

    # Hill score
    try:
        s = c.get_hill_score(start, end)
        if s:
            score = safe(s, 'score') or safe(s, 'hillScore')
            store(db, end, 'hill_score', score, '', s)
        db.commit()
        print(f'  hill_score:         snapshot stored')
    except Exception as e:
        print(f'  hill_score error: {e}')


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Historical Garmin data ingest')
    parser.add_argument('--days',    type=int, default=365,
                        help='Days of history to fetch (default: 365)')
    parser.add_argument('--replace', action='store_true',
                        help='Overwrite existing rows (default: skip/IGNORE)')
    args = parser.parse_args()

    db    = connect_db()
    store = make_store(replace=args.replace)
    c     = Garmin()
    c.login(TOKEN_DIR)
    print(f'Authenticated as: {c.display_name}')
    print(f'Fetching {args.days} days of history ({"REPLACE" if args.replace else "IGNORE duplicates"})...\n')

    today      = date.today()
    start_date = today - timedelta(days=args.days)
    total_days = args.days

    total_errors = 0
    for i in range(total_days, -1, -1):
        d   = str(today - timedelta(days=i))
        pct = int((total_days - i) / total_days * 100)
        sys.stdout.write(f'\r[{pct:3d}%] {d} ... ')
        sys.stdout.flush()

        errors = sync_day(db, store, c, d)
        if errors:
            total_errors += len(errors)
            print(f'errors: {", ".join(errors)}')
        else:
            sys.stdout.write('ok\n')
            sys.stdout.flush()

        time.sleep(SLEEP_PER_DAY)

    # Bulk range fetches that work better as a single call
    sync_range_bulk(db, store, c, str(start_date), str(today))

    db.close()
    row_count = sqlite3.connect(DB_PATH).execute(
        'SELECT COUNT(*) FROM health_snapshots'
    ).fetchone()[0]
    print(f'\nIngest complete. Total rows in health_snapshots: {row_count}')
    if total_errors:
        print(f'Total errors encountered: {total_errors} (check output above)')


if __name__ == '__main__':
    main()
