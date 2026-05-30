#!/usr/bin/env python3
"""Probe ALL Garmin endpoints to see what data is available."""
from garminconnect import Garmin
import os, json
from datetime import date, timedelta

c = Garmin()
c.login(os.path.expanduser('~/.garminconnect'))
today = str(date.today())
yesterday = str(date.today() - timedelta(days=1))
week_ago = str(date.today() - timedelta(days=7))
month_ago = str(date.today() - timedelta(days=30))

def probe(label, fn, *args, **kwargs):
    print(f'\n{"="*20} {label} {"="*20}')
    try:
        result = fn(*args, **kwargs)
        out = json.dumps(result, indent=2)
        print(out[:2000])
        if len(out) > 2000:
            print(f'... (truncated, total {len(out)} chars)')
    except Exception as e:
        print(f'ERROR: {type(e).__name__}: {e}')

# ── Daily stats ────────────────────────────────────────────────────────────────
probe('STATS today',                    c.get_stats,                    today)
probe('STATS + BODY today',             c.get_stats_and_body,           today)
probe('USER SUMMARY today',             c.get_user_summary,             today)

# ── Heart rate ─────────────────────────────────────────────────────────────────
probe('HEART RATES today',              c.get_heart_rates,              today)
probe('RHR today',                      c.get_rhr_day,                  today)

# ── Sleep ──────────────────────────────────────────────────────────────────────
probe('SLEEP yesterday',                c.get_sleep_data,               yesterday)

# ── HRV ────────────────────────────────────────────────────────────────────────
probe('HRV today',                      c.get_hrv_data,                 today)

# ── Body battery ───────────────────────────────────────────────────────────────
probe('BODY BATTERY today',             c.get_body_battery,             today, today)
probe('BODY BATTERY EVENTS today',      c.get_body_battery_events,      today, today)

# ── Stress ─────────────────────────────────────────────────────────────────────
probe('STRESS today',                   c.get_stress_data,              today)
probe('ALL DAY STRESS today',           c.get_all_day_stress,           today)
probe('WEEKLY STRESS',                  c.get_weekly_stress,            week_ago, today)

# ── SpO2 / Respiration ─────────────────────────────────────────────────────────
probe('SPO2 today',                     c.get_spo2_data,                today)
probe('RESPIRATION today',              c.get_respiration_data,         today)

# ── Steps / Floors / Intensity ─────────────────────────────────────────────────
probe('STEPS today',                    c.get_steps_data,               today, today)
probe('DAILY STEPS week',               c.get_daily_steps,              week_ago, today)
probe('WEEKLY STEPS',                   c.get_weekly_steps,             week_ago, today)
probe('FLOORS today',                   c.get_floors,                   today, today)
probe('INTENSITY MINUTES week',         c.get_intensity_minutes_data,   week_ago, today)
probe('WEEKLY INTENSITY MINUTES',       c.get_weekly_intensity_minutes, week_ago, today)

# ── Training ───────────────────────────────────────────────────────────────────
probe('TRAINING READINESS today',       c.get_training_readiness,       today)
probe('TRAINING STATUS today',          c.get_training_status,          today)
probe('MORNING TRAINING READINESS',     c.get_morning_training_readiness, today)
probe('RUNNING TOLERANCE',              c.get_running_tolerance,        today, today)
probe('ENDURANCE SCORE',                c.get_endurance_score,          week_ago, today)
probe('HILL SCORE',                     c.get_hill_score,               week_ago, today)
probe('LACTATE THRESHOLD',              c.get_lactate_threshold)
probe('CYCLING FTP',                    c.get_cycling_ftp)

# ── Fitness metrics ────────────────────────────────────────────────────────────
probe('VO2MAX / MAX METRICS',           c.get_max_metrics,              today)
probe('FITNESS AGE',                    c.get_fitnessage_data,          today)
probe('PERSONAL RECORDS',               c.get_personal_record,          today)
probe('RACE PREDICTIONS',               c.get_race_predictions)
probe('PROGRESS SUMMARY month',         c.get_progress_summary_between_dates, month_ago, today, 'running')

# ── Activities ─────────────────────────────────────────────────────────────────
probe('ACTIVITIES last 10',             c.get_activities,               0, 10)
probe('ACTIVITIES by date week',        c.get_activities_by_date,       week_ago, today)
probe('ACTIVITIES fordate today',       c.get_activities_fordate,       today)
probe('LAST ACTIVITY',                  c.get_last_activity)
probe('ACTIVITY TYPES',                 c.get_activity_types)
probe('SCHEDULED WORKOUTS',             c.get_scheduled_workouts,       today)
probe('WORKOUTS',                       c.get_workouts,                 0, 5)

# ── Body composition / weight ──────────────────────────────────────────────────
probe('BODY COMPOSITION month',         c.get_body_composition,         month_ago, today)
probe('DAILY WEIGH INS week',           c.get_daily_weigh_ins,          week_ago, today)
probe('WEIGH INS week',                 c.get_weigh_ins,                week_ago, today)
probe('BLOOD PRESSURE week',            c.get_blood_pressure,           week_ago, today)

# ── Hydration / Nutrition ──────────────────────────────────────────────────────
probe('HYDRATION today',                c.get_hydration_data,           today)
probe('NUTRITION FOOD LOG today',       c.get_nutrition_daily_food_log, today)
probe('NUTRITION MEALS today',          c.get_nutrition_daily_meals,    today)

# ── Goals ──────────────────────────────────────────────────────────────────────
probe('GOALS',                          c.get_goals,                    'active')
probe('ALL DAY EVENTS today',           c.get_all_day_events,           today)
probe('LIFESTYLE LOGGING today',        c.get_lifestyle_logging_data,   today)

# ── Device ─────────────────────────────────────────────────────────────────────
probe('DEVICES',                        c.get_devices)
probe('DEVICE LAST USED',               c.get_device_last_used)
probe('PRIMARY TRAINING DEVICE',        c.get_primary_training_device)

# ── Profile ────────────────────────────────────────────────────────────────────
probe('USER PROFILE',                   c.get_user_profile)
probe('FULL NAME',                      c.get_full_name)
probe('UNIT SYSTEM',                    c.get_unit_system)

# ── Gear ───────────────────────────────────────────────────────────────────────
probe('GEAR',                           c.get_gear,                     144896636)

print('\n\nDONE')
