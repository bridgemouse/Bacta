import pytest
import sqlite3
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../poller'))

@pytest.fixture
def db_path(tmp_path):
    path = str(tmp_path / 'test.db')
    # Create schema from the actual schema.sql file
    conn = sqlite3.connect(path)
    schema = open(os.path.join(os.path.dirname(__file__), '../../server/db/schema.sql')).read()
    conn.executescript(schema)
    conn.close()
    return path

def test_upsert_snapshot_inserts_new_row(db_path):
    from db import upsert_snapshot
    upsert_snapshot(db_path, 'garmin_snapshots', '2026-04-26', 'steps', 9241, 'steps', '{}')
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT value FROM garmin_snapshots WHERE date='2026-04-26' AND metric='steps'").fetchone()
    conn.close()
    assert row[0] == 9241

def test_upsert_snapshot_updates_existing_row(db_path):
    from db import upsert_snapshot
    upsert_snapshot(db_path, 'garmin_snapshots', '2026-04-26', 'steps', 9000, 'steps', '{}')
    upsert_snapshot(db_path, 'garmin_snapshots', '2026-04-26', 'steps', 9999, 'steps', '{}')
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT value FROM garmin_snapshots WHERE date='2026-04-26' AND metric='steps'").fetchone()
    conn.close()
    assert row[0] == 9999

def test_upsert_many_snapshots(db_path):
    from db import upsert_many_snapshots
    metrics = [
        ('steps', 9241, 'steps'),
        ('hrv', 48, 'ms'),
        ('resting_hr', 52, 'bpm'),
    ]
    upsert_many_snapshots(db_path, 'garmin_snapshots', '2026-04-26', metrics, '{}')
    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT metric, value FROM garmin_snapshots WHERE date='2026-04-26'").fetchall()
    conn.close()
    assert len(rows) == 3
