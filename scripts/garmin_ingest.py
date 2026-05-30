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
            f'{verb} INTO garmin_snapshots '
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
            store(db, d, 'steps',           safe(s, 'totalSteps'),          'steps', s)
            store(db, d, 'resting_hr',      safe(s, 'restingHeartRate'),    'bpm',   s)
            store(db, d, 'stress_avg',      safe(s, 'averageStressLevel'),  '',      s)
            store(db, d, 'calories_total',  safe(s, 'totalKilocalories'),   'kcal',  s)
            store(db, d, 'calories_active', safe(s, 'activeKilocalories'),  'kcal',  s)
            store(db, d, 'distance_m',      safe(s, 'totalDistanceMeters'), 'm',     s)
            store(db, d, 'floors_up',       safe(s, 'floorsAscended'),      'floors', s)
            store(db, d, 'floors_down',     safe(s, 'floorsDescended'),     'floors', s)
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

    # Sleep (sleep for morning-of-d = night of prev→d)
    try:
        s = c.get_sleep_data(prev)
        dto = safe(s, 'dailySleepDTO') or {}
        if dto:
            store(db, d, 'sleep_s',       safe(dto, 'durationInSeconds'),      's',    s)
            store(db, d, 'sleep_deep_s',  safe(dto, 'deepSleepSeconds'),       's',    s)
            store(db, d, 'sleep_light_s', safe(dto, 'lightSleepSeconds'),      's',    s)
            store(db, d, 'sleep_rem_s',   safe(dto, 'remSleepSeconds'),        's',    s)
            store(db, d, 'sleep_awake_s', safe(dto, 'awakeSleepSeconds'),      's',    s)
            store(db, d, 'sleep_spo2',    safe(dto, 'averageSpO2Value'),       '%',    s)
            store(db, d, 'sleep_resp',    safe(dto, 'averageRespirationValue'),'brpm', s)
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
            hrv = safe(summary, 'lastNight') or safe(summary, 'weeklyAvg')
            store(db, d, 'hrv',          hrv,                         'ms', s)
            store(db, d, 'hrv_week_avg', safe(summary, 'weeklyAvg'), 'ms', s)
    except Exception as e:
        errors.append(f'hrv({e})')
    time.sleep(SLEEP_PER_CALL)

    # Body battery
    try:
        bb = c.get_body_battery(d, d)
        if bb and isinstance(bb, list) and len(bb) > 0:
            item = bb[0]
            store(db, d, 'body_battery_max', (safe(item, 'maxBatteryValue') or
                                               safe(item, 'charged')), '%', bb)
            store(db, d, 'body_battery_min', (safe(item, 'minBatteryValue') or
                                               safe(item, 'drained')), '%', bb)
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

    # Training readiness
    try:
        s = c.get_training_readiness(d)
        if s:
            score = safe(s, 'score') or safe(s, 'value')
            store(db, d, 'recovery_score', score, '', s)
    except Exception as e:
        errors.append(f'training_readiness({e})')
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
            store(db, d, 'fitness_age', (safe(s, 'biometricAge') or
                                          safe(s, 'chronologicalAge')), 'years', s)
    except Exception as e:
        errors.append(f'fitness_age({e})')
    time.sleep(SLEEP_PER_CALL)

    db.commit()
    return errors


# ─── Range-based bulk fetches ──────────────────────────────────────────────────

def sync_range_bulk(db, store, c, start, end):
    print(f'\nFetching range metrics ({start} → {end})...')

    # Weigh-ins
    try:
        rows = c.get_daily_weigh_ins(start, end)
        for row in (rows or []):
            d = safe(row, 'summaryDate') or safe(row, 'calendarDate')
            if d:
                store(db, d, 'weight_kg',     safe(row, 'weight'),          'kg', row)
                store(db, d, 'bmi',            safe(row, 'bmi'),             '',   row)
                store(db, d, 'body_fat_pct',   safe(row, 'bodyFatPercent'), '%',  row)
                store(db, d, 'muscle_mass_kg', safe(row, 'muscleMass'),     'kg', row)
        db.commit()
        print(f'  weigh-ins:          {len(rows or []):4d} rows')
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
    try:
        acts = c.get_activities_by_date(start, end)
        for act in (acts or []):
            d = (safe(act, 'startTimeLocal') or '')[:10]
            if d:
                store(db, d, 'act_distance_m', safe(act, 'distance'),   'm',    act)
                store(db, d, 'act_duration_s', safe(act, 'duration'),   's',    act)
                store(db, d, 'act_calories',   safe(act, 'calories'),   'kcal', act)
                store(db, d, 'act_avg_hr',     safe(act, 'averageHR'), 'bpm',  act)
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
        'SELECT COUNT(*) FROM garmin_snapshots'
    ).fetchone()[0]
    print(f'\nIngest complete. Total rows in garmin_snapshots: {row_count}')
    if total_errors:
        print(f'Total errors encountered: {total_errors} (check output above)')


if __name__ == '__main__':
    main()
