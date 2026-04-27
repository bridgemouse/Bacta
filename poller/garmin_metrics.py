from garminconnect import Garmin


def fetch_daily_summary(client: Garmin, date_str: str) -> dict:
    try:
        data = client.get_user_summary(date_str)
        return {
            'steps': data.get('totalSteps'),
            'resting_hr': data.get('restingHeartRate'),
            'stress_score': data.get('averageStressLevel'),
            'body_battery': data.get('bodyBatteryMostRecentValue'),
            'body_battery_charged': data.get('bodyBatteryChargedValue'),
            'body_battery_drained': data.get('bodyBatteryDrainedValue'),
            'intensity_minutes': (
                (data.get('moderateIntensityMinutes') or 0) +
                (data.get('vigorousIntensityMinutes') or 0) * 2
            ) or None,
            'floors': data.get('floorsAscended'),
            'hydration_ml': data.get('waterIntakeInML'),
        }
    except Exception:
        return {}


def fetch_hrv(client: Garmin, date_str: str) -> dict:
    try:
        data = client.get_hrv_data(date_str)
        summary = data.get('hrvSummary', {})
        return {
            'hrv': summary.get('lastNightAvg'),
            'hrv_5min_high': summary.get('lastNight5MinHigh'),
            'hrv_status': summary.get('status'),
        }
    except Exception:
        return {}


def fetch_sleep(client: Garmin, date_str: str) -> dict:
    try:
        data = client.get_sleep_data(date_str)
        daily = data.get('dailySleepDTO', {})

        def _mins(key: str):
            v = daily.get(key)
            return v // 60 if v is not None else None

        return {
            'sleep_duration': _mins('sleepTimeSeconds'),
            'sleep_score': daily.get('sleepScores', {}).get('overall', {}).get('value'),
            'sleep_deep_minutes': _mins('deepSleepSeconds'),
            'sleep_light_minutes': _mins('lightSleepSeconds'),
            'sleep_rem_minutes': _mins('remSleepSeconds'),
            'sleep_awake_minutes': _mins('awakeSleepSeconds'),
        }
    except Exception:
        return {}


def fetch_recovery(client: Garmin, date_str: str) -> dict:
    try:
        data = client.get_training_readiness(date_str)
        entry = data[0] if isinstance(data, list) and data else {}
        return {
            'recovery_score': entry.get('score'),
            'training_load': entry.get('acuteLoad'),
            'recovery_time_hours': entry.get('recoveryTime'),
        }
    except Exception:
        return {}


def fetch_vo2max(client: Garmin, date_str: str) -> dict:
    try:
        data = client.get_max_metrics(date_str)
        if isinstance(data, list) and data:
            return {'vo2max': data[0].get('vo2MaxPreciseValue') or data[0].get('vo2MaxValue')}
    except Exception:
        pass
    return {}


def fetch_all(client: Garmin, date_str: str) -> dict:
    """Fetch all metrics and return as flat dict of {metric: (value, unit)}."""
    results: dict[str, tuple] = {}

    def add(data: dict, units: dict[str, str]):
        for k, v in data.items():
            if v is not None:
                results[k] = (v, units.get(k, ''))

    add(fetch_daily_summary(client, date_str), {
        'steps': 'steps', 'resting_hr': 'bpm', 'stress_score': 'score',
        'body_battery': 'score', 'body_battery_charged': 'score',
        'body_battery_drained': 'score', 'intensity_minutes': 'minutes',
        'floors': 'floors', 'hydration_ml': 'ml',
    })
    add(fetch_hrv(client, date_str), {
        'hrv': 'ms', 'hrv_5min_high': 'ms', 'hrv_status': '',
    })
    add(fetch_sleep(client, date_str), {
        'sleep_duration': 'minutes', 'sleep_score': 'score',
        'sleep_deep_minutes': 'minutes', 'sleep_light_minutes': 'minutes',
        'sleep_rem_minutes': 'minutes', 'sleep_awake_minutes': 'minutes',
    })
    add(fetch_recovery(client, date_str), {
        'recovery_score': 'score', 'training_load': 'load', 'recovery_time_hours': 'hours',
    })
    add(fetch_vo2max(client, date_str), {'vo2max': 'ml/kg/min'})

    return results
