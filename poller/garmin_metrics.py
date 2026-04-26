from playwright.async_api import Page

BASE = 'https://connect.garmin.com/modern/proxy'


async def _get_json(page: Page, url: str) -> dict:
    response = await page.goto(url, wait_until='networkidle')
    try:
        return await response.json()
    except Exception:
        return {}


async def fetch_daily_summary(page: Page, display_name: str, date_str: str) -> dict:
    """Fetch the core daily user summary from Garmin Connect."""
    url = f'{BASE}/usersummary-service/usersummary/daily/{display_name}?calendarDate={date_str}'
    data = await _get_json(page, url)
    return {
        'steps': data.get('totalSteps'),
        'resting_hr': data.get('restingHeartRate'),
        'stress_score': data.get('averageStressLevel'),
        'body_battery_charged': data.get('bodyBatteryChargedValue'),
        'body_battery_drained': data.get('bodyBatteryDrainedValue'),
        'intensity_minutes': (
            data.get('moderateIntensityMinutes', 0) +
            data.get('vigorousIntensityMinutes', 0) * 2
        ),
        'floors': data.get('floorsAscended'),
        'hydration_ml': data.get('waterIntakeInML'),
    }


async def fetch_hrv(page: Page, date_str: str) -> dict:
    url = f'{BASE}/hrv-service/hrv/{date_str}'
    data = await _get_json(page, url)
    summary = data.get('hrvSummary', {})
    return {
        'hrv': summary.get('lastNight'),
        'hrv_5min_high': summary.get('lastNight5MinHigh'),
        'hrv_status': summary.get('status'),
    }


async def fetch_sleep(page: Page, date_str: str) -> dict:
    url = f'{BASE}/wellness-service/wellness/dailySleepData?date={date_str}'
    data = await _get_json(page, url)
    daily = data.get('dailySleepDTO', {})
    return {
        'sleep_duration': daily.get('sleepTimeSeconds', 0) // 60,
        'sleep_score': daily.get('sleepScores', {}).get('overall', {}).get('value'),
        'sleep_deep_minutes': daily.get('deepSleepSeconds', 0) // 60,
        'sleep_light_minutes': daily.get('lightSleepSeconds', 0) // 60,
        'sleep_rem_minutes': daily.get('remSleepSeconds', 0) // 60,
        'sleep_awake_minutes': daily.get('awakeSleepSeconds', 0) // 60,
    }


async def fetch_body_battery(page: Page, date_str: str) -> dict:
    url = f'{BASE}/wellness-service/wellness/bodyBattery?startDate={date_str}&endDate={date_str}'
    data = await _get_json(page, url)
    if isinstance(data, list) and len(data) > 0:
        readings = data[0].get('bodyBatteryValuesArray', [])
        if readings:
            return {'body_battery': readings[-1][1] if readings[-1] else None}
    return {'body_battery': None}


async def fetch_recovery(page: Page, date_str: str) -> dict:
    url = f'{BASE}/training-readiness-service/trainingReadiness/{date_str}'
    data = await _get_json(page, url)
    return {
        'recovery_score': data.get('score'),
        'training_load': data.get('acuteLoad'),
        'recovery_time_hours': data.get('recoveryTime'),
    }


async def fetch_vo2max(page: Page, display_name: str) -> dict:
    url = (
        f'{BASE}/fitnessstats-service/activity/{display_name}'
        '?aggregation=weekly&startDate=2020-01-01&endDate=2099-12-31'
        '&metrics=VO2_MAX_RUNNING'
    )
    data = await _get_json(page, url)
    values = data.get('metricsMap', {}).get('VO2_MAX_RUNNING', [])
    latest = values[-1] if values else {}
    return {'vo2max': latest.get('value')}


async def fetch_all(page: Page, display_name: str, date_str: str) -> dict:
    """Fetch all metrics and return as flat dict of {metric: (value, unit)}."""
    results: dict[str, tuple] = {}

    def add(data: dict, units: dict[str, str]):
        for k, v in data.items():
            if v is not None:
                results[k] = (v, units.get(k, ''))

    add(await fetch_daily_summary(page, display_name, date_str), {
        'steps': 'steps', 'resting_hr': 'bpm', 'stress_score': 'score',
        'body_battery_charged': 'score', 'body_battery_drained': 'score',
        'intensity_minutes': 'minutes', 'floors': 'floors', 'hydration_ml': 'ml'
    })
    add(await fetch_hrv(page, date_str), {
        'hrv': 'ms', 'hrv_5min_high': 'ms', 'hrv_status': ''
    })
    add(await fetch_sleep(page, date_str), {
        'sleep_duration': 'minutes', 'sleep_score': 'score',
        'sleep_deep_minutes': 'minutes', 'sleep_light_minutes': 'minutes',
        'sleep_rem_minutes': 'minutes', 'sleep_awake_minutes': 'minutes'
    })
    add(await fetch_body_battery(page, date_str), {'body_battery': 'score'})
    add(await fetch_recovery(page, date_str), {
        'recovery_score': 'score', 'training_load': 'load', 'recovery_time_hours': 'hours'
    })
    add(await fetch_vo2max(page, display_name), {'vo2max': 'ml/kg/min'})

    return results
