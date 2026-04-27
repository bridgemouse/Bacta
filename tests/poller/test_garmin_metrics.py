import sys
import os
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../poller'))


def _mock_client(summary_data=None, hrv_data=None, sleep_data=None):
    """Return a Garmin client mock with configurable method responses."""
    client = MagicMock()
    client.get_user_summary.return_value = summary_data or {}
    client.get_hrv_data.return_value = hrv_data or {}
    client.get_sleep_data.return_value = sleep_data or {}
    client.get_training_readiness.return_value = []
    client.get_max_metrics.return_value = []
    return client


def test_fetch_daily_summary_extracts_steps():
    from garmin_metrics import fetch_daily_summary
    client = _mock_client(summary_data={'totalSteps': 9241, 'restingHeartRate': 52})
    result = fetch_daily_summary(client, '2026-04-26')
    assert result['steps'] == 9241


def test_fetch_daily_summary_extracts_resting_hr():
    from garmin_metrics import fetch_daily_summary
    client = _mock_client(summary_data={'totalSteps': 9241, 'restingHeartRate': 52})
    result = fetch_daily_summary(client, '2026-04-26')
    assert result['resting_hr'] == 52


def test_fetch_daily_summary_handles_missing_field():
    from garmin_metrics import fetch_daily_summary
    client = _mock_client(summary_data={})
    result = fetch_daily_summary(client, '2026-04-26')
    assert result.get('steps') is None


def test_fetch_hrv_uses_last_night_avg():
    from garmin_metrics import fetch_hrv
    client = _mock_client()
    client.get_hrv_data.return_value = {'hrvSummary': {'lastNightAvg': 58, 'lastNight5MinHigh': 85, 'status': 'BALANCED'}}
    result = fetch_hrv(client, '2026-04-26')
    assert result['hrv'] == 58
    assert result['hrv_5min_high'] == 85


def test_fetch_sleep_converts_seconds_to_minutes():
    from garmin_metrics import fetch_sleep
    client = _mock_client()
    client.get_sleep_data.return_value = {
        'dailySleepDTO': {
            'sleepTimeSeconds': 24960,
            'deepSleepSeconds': 4980,
            'lightSleepSeconds': 14340,
            'remSleepSeconds': 5640,
            'awakeSleepSeconds': 3300,
            'sleepScores': {'overall': {'value': 60}},
        }
    }
    result = fetch_sleep(client, '2026-04-26')
    assert result['sleep_duration'] == 24960 // 60
    assert result['sleep_score'] == 60
    assert result['sleep_deep_minutes'] == 4980 // 60
