# tests/azi3/test_data_fetcher.py
import importlib
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))

SCHEMA = (Path(__file__).parent.parent.parent / 'server/db/schema.sql').read_text()


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    path = str(tmp_path / 'test.db')
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    monkeypatch.setenv('DB_PATH', path)
    return path


def seed_metric(db_path, date, metric, value, unit='ms'):
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES (?, ?, ?, ?, '{}')",
        (date, metric, value, unit),
    )
    conn.commit()
    conn.close()


def test_fetch_metrics_groups_by_metric(db_path):
    seed_metric(db_path, '2026-04-27', 'hrv', 58)
    seed_metric(db_path, '2026-04-27', 'steps', 9241, 'steps')

    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_metrics(['hrv', 'steps'], days=30)

    assert result['hrv'][0]['value'] == 58
    assert result['steps'][0]['value'] == 9241


def test_fetch_metrics_empty_for_missing_metric(db_path):
    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_metrics(['vo2max'], days=30)
    assert result['vo2max'] == []


def test_fetch_metrics_empty_list_returns_empty_dict(db_path):
    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_metrics([], days=30)
    assert result == {}


def test_fetch_manual_inputs_returns_entries(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements) VALUES (?, ?, ?, ?)",
        ('2026-04-27', 4, 200, '["creatine"]'),
    )
    conn.commit()
    conn.close()

    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_manual_inputs(days=30)
    assert len(result) == 1
    assert result[0]['readiness'] == 4
    assert result[0]['caffeine_mg'] == 200


def test_format_metric_table_empty():
    import data_fetcher
    importlib.reload(data_fetcher)
    out = data_fetcher.format_metric_table('hrv', [])
    assert 'No data' in out


def test_format_metric_table_with_rows():
    import data_fetcher
    importlib.reload(data_fetcher)
    rows = [{'date': '2026-04-27', 'value': 58, 'unit': 'ms'}]
    out = data_fetcher.format_metric_table('hrv', rows)
    assert '58' in out
    assert '2026-04-27' in out
    assert 'hrv' in out


def test_format_manual_table_empty():
    import data_fetcher
    importlib.reload(data_fetcher)
    out = data_fetcher.format_manual_table([])
    assert 'No entries' in out


def test_format_manual_table_with_rows():
    import data_fetcher
    importlib.reload(data_fetcher)
    rows = [{'date': '2026-04-27', 'readiness': 4, 'caffeine_mg': 200, 'supplements': '["creatine"]'}]
    out = data_fetcher.format_manual_table(rows)
    assert '200' in out
    assert '2026-04-27' in out
