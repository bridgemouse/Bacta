import sqlite3

ALLOWED_TABLES = {"garmin_snapshots", "macrofactor_snapshots", "manual_inputs", "blood_work"}


def _validate_table(table: str) -> None:
    if table not in ALLOWED_TABLES:
        raise ValueError(f"Unknown table: {table!r}")


def upsert_snapshot(
    db_path: str,
    table: str,
    date: str,
    metric: str,
    value: float,
    unit: str,
    source_json: str
) -> None:
    _validate_table(table)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(f"""
            INSERT INTO {table} (date, metric, value, unit, source_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, metric) DO UPDATE SET
                value = excluded.value,
                unit = excluded.unit,
                source_json = excluded.source_json
        """, (date, metric, value, unit, source_json))
        conn.commit()
    finally:
        conn.close()


def upsert_many_snapshots(
    db_path: str,
    table: str,
    date: str,
    metrics: list[tuple[str, float, str]],  # (metric, value, unit)
    source_json: str
) -> None:
    _validate_table(table)
    conn = sqlite3.connect(db_path)
    try:
        conn.executemany(f"""
            INSERT INTO {table} (date, metric, value, unit, source_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, metric) DO UPDATE SET
                value = excluded.value,
                unit = excluded.unit,
                source_json = excluded.source_json
        """, [(date, m, v, u, source_json) for m, v, u in metrics])
        conn.commit()
    finally:
        conn.close()
