#!/usr/bin/env python3
"""Probe all relevant Garmin endpoints to understand available data."""
from garminconnect import Garmin
import os, json
from datetime import date, timedelta

c = Garmin()
c.login(os.path.expanduser('~/.garminconnect'))
today = str(date.today())
yesterday = str(date.today() - timedelta(days=1))
week_ago = str(date.today() - timedelta(days=7))

def probe(label, fn, *args, **kwargs):
    print(f'\n{"="*20} {label} {"="*20}')
    try:
        result = fn(*args, **kwargs)
        print(json.dumps(result, indent=2)[:1500])
    except Exception as e:
        print(f'ERROR: {e}')

probe('STATS (today)',           c.get_stats,               today)
probe('SLEEP (yesterday)',       c.get_sleep_data,          yesterday)
probe('HRV (today)',             c.get_hrv_data,            today)
probe('TRAINING READINESS',      c.get_training_readiness,  today)
probe('TRAINING STATUS',         c.get_training_status,     today)
probe('ACTIVITIES last 7',       c.get_activities_by_date,  week_ago, today)
probe('PERSONAL RECORDS',        c.get_personal_record,     today)
probe('RACE PREDICTIONS',        c.get_race_predictions)
probe('ENDURANCE SCORE',         c.get_endurance_score,     today, today)
probe('VO2MAX / MAX METRICS',    c.get_max_metrics,         today)
probe('BODY COMPOSITION',        c.get_body_composition,    week_ago, today)
probe('WEIGH INS',               c.get_daily_weigh_ins,     week_ago, today)
probe('SPO2 (today)',            c.get_spo2_data,           today)
probe('RESPIRATION (today)',     c.get_respiration_data,    today)
probe('HYDRATION (today)',       c.get_hydration_data,      today)
probe('FLOORS (today)',          c.get_floors,              today, today)
probe('INTENSITY MINUTES',       c.get_intensity_minutes_data, week_ago, today)
probe('STRESS (today)',          c.get_stress_data,         today)
probe('BODY BATTERY (today)',    c.get_body_battery,        today, today)
probe('FITNESS AGE',             c.get_fitnessage_data,     today)
probe('RUNNING TOLERANCE',       c.get_running_tolerance,   today, today)
probe('LACTATE THRESHOLD',       c.get_lactate_threshold)
probe('HILL SCORE',              c.get_hill_score,          week_ago, today)
