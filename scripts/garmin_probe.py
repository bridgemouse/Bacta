#!/usr/bin/env python3
"""Quick probe to check what Garmin data is available."""
from garminconnect import Garmin
import os, json
from datetime import date, timedelta

c = Garmin()
c.login(os.path.expanduser('~/.garminconnect'))
today = str(date.today())
yesterday = str(date.today() - timedelta(days=1))

print('--- HRV ---')
try:
    print(json.dumps(c.get_hrv_data(today), indent=2)[:1000])
except Exception as e:
    print(f'ERROR: {e}')

print('--- TRAINING READINESS ---')
try:
    print(json.dumps(c.get_training_readiness(today), indent=2)[:500])
except Exception as e:
    print(f'ERROR: {e}')

print('--- ACTIVITIES (last 5) ---')
try:
    acts = c.get_activities(0, 5)
    for a in acts:
        print(f"{a.get('startTimeLocal')} {a.get('activityType',{}).get('typeKey')} {a.get('distance',0)/1000:.1f}km {a.get('duration',0)/60:.0f}min")
except Exception as e:
    print(f'ERROR: {e}')

print('--- VO2MAX ---')
try:
    print(json.dumps(c.get_max_metrics(today), indent=2)[:500])
except Exception as e:
    print(f'ERROR: {e}')
