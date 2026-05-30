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


# ─── Per-day sync ──────────────────────────────────────────────────────────────

def sync_day(db, c, d):
    """Fetch all per-day metrics for date d (YYYY-MM-DD)."""
    prev = str(date.fromisoformat(d) - timedelta(days=1))
    ok = []
    err = []

    # Stats (steps, RHR, stress, calories, distance, floors)
    try:
        s = c.get_stats(d)
        if s:
            store(db, d, 'steps',           safe(s, 'totalSteps'),          'steps')
            store(db, d, 'resting_hr',      safe(s, 'restingHeartRate'),    'bpm',   s)
            store(db, d, 'stress_avg',      safe(s, 'averageStressLevel'),  '',      s)
            store(db, d, 'calories_total',  safe(s, 'totalKilocalories'),   'kcal',  s)
            store(db, d, 'calories_active', safe(s, 'activeKilocalories'),  'kcal',  s)
            store(db, d, 'distance_m',      safe(s, 'totalDistanceMeters'), 'm',     s)
            store(db, d, 'floors_up',       safe(s, 'floorsAscended'),      'floors')
            store(db, d, 'floors_down',     safe(s, 'floorsDescended'),     'floors')
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

    # Sleep — "d" morning means the night of prev→d
    try:
        s = c.get_sleep_data(prev)
        dto = safe(s, 'dailySleepDTO') or {}
        if dto:
            store(db, d, 'sleep_s',         safe(dto, 'durationInSeconds'),      's',    s)
            store(db, d, 'sleep_deep_s',    safe(dto, 'deepSleepSeconds'),       's',    s)
            store(db, d, 'sleep_light_s',   safe(dto, 'lightSleepSeconds'),      's',    s)
            store(db, d, 'sleep_rem_s',     safe(dto, 'remSleepSeconds'),        's',    s)
            store(db, d, 'sleep_awake_s',   safe(dto, 'awakeSleepSeconds'),      's',    s)
            store(db, d, 'sleep_spo2',      safe(dto, 'averageSpO2Value'),       '%',    s)
            store(db, d, 'sleep_resp',      safe(dto, 'averageRespirationValue'),'brpm', s)
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
            hrv = safe(summary, 'lastNight') or safe(summary, 'weeklyAvg')
            store(db, d, 'hrv',          hrv,                          'ms', s)
            store(db, d, 'hrv_week_avg', safe(summary, 'weeklyAvg'),  'ms', s)
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

    # Training readiness
    try:
        s = c.get_training_readiness(d)
        if s:
            score = safe(s, 'score') or safe(s, 'value')
            store(db, d, 'recovery_score', score, '', s)
        ok.append('training_readiness')
    except Exception as e:
        err.append(f'training_readiness({e})')
    time.sleep(SLEEP_BETWEEN)

    # Training status
    try:
        s = c.get_training_status(d)
        if s:
            STATUS_MAP = {
                'NO_DATA': 0, 'DETRAINING': 1, 'RECOVERY': 2,
                'MAINTAINING': 3, 'PRODUCTIVE': 4, 'PEAKING': 5,
                'OVERREACHING': 6,
            }
            st = (safe(s, 'trainingStatus', 'status') or
                  safe(s, 'status') or '')
            store(db, d, 'training_status_n', STATUS_MAP.get(st), '', s)
            store(db, d, 'training_load',
                  safe(s, 'trainingStatus', 'trainingLoad') or
                  safe(s, 'trainingLoad'), '', s)
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
            store(db, d, 'fitness_age', (safe(s, 'biometricAge') or
                                          safe(s, 'chronologicalAge')), 'years', s)
        ok.append('fitness_age')
    except Exception as e:
        err.append(f'fitness_age({e})')
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
        print(f'  weigh-ins: {len(rows or [])} rows')
    except Exception as e:
        print(f'  weigh-ins error: {e}')
    time.sleep(SLEEP_BETWEEN)

    # Intensity minutes
    try:
        rows = c.get_intensity_minutes_data(start, end)
        for row in (rows or []):
            d = safe(row, 'calendarDate') or safe(row, 'summaryDate')
            if d:
                store(db, d, 'intensity_mod_min', safe(row, 'moderateIntensityMinutes'), 'min', row)
                store(db, d, 'intensity_vig_min',  safe(row, 'vigorousIntensityMinutes'), 'min', row)
        db.commit()
        print(f'  intensity_minutes: {len(rows or [])} rows')
    except Exception as e:
        print(f'  intensity_minutes error: {e}')
    time.sleep(SLEEP_BETWEEN)

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
