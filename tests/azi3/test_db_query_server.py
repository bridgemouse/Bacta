# tests/azi3/test_db_query_server.py
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
    conn.execute(
        "INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES ('2026-04-27', 'hrv', 58, 'ms', '{}')"
    )
    conn.execute(
        "INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES ('2026-04-27', 'steps', 9241, 'steps', '{}')"
    )
    conn.execute(
        "INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements) VALUES ('2026-04-27', 4, 200, '[\"creatine\"]')"
    )
    conn.commit()
    conn.close()
    monkeypatch.setenv('DB_PATH', path)
    return path


def test_list_metrics_returns_all_distinct_metrics(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._list_metrics()
    text = result[0].text
    assert 'hrv' in text
    assert 'steps' in text


def test_query_metric_returns_table(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_metric('hrv', '2026-04-01', '2026-04-30')
    text = result[0].text
    assert '58' in text
    assert '2026-04-27' in text


def test_query_metric_no_data_returns_message(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_metric('vo2max', '2026-04-01', '2026-04-30')
    assert 'No data' in result[0].text


def test_query_manual_inputs_returns_table(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_manual_inputs('2026-04-01', '2026-04-30')
    text = result[0].text
    assert '200' in text   # caffeine_mg
    assert '2026-04-27' in text


def test_query_manual_inputs_no_data_returns_message(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_manual_inputs('2020-01-01', '2020-01-02')
    assert 'No manual inputs' in result[0].text
