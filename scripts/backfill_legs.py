#!/usr/bin/env python3
"""One-time backfill: fetch and store leg data for multi_sport activities in past 30 days."""

import os, sys, time, sqlite3
from datetime import date, timedelta
from garminconnect import Garmin

sys.path.insert(0, os.path.dirname(__file__))
from garmin_poller import connect_db, _child_activity_ids, store_legs, SLEEP_BETWEEN, TOKEN_DIR


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    db = connect_db()
    c = Garmin()
    c.login(TOKEN_DIR)
    print(f'Authenticated as: {c.display_name}')

    since = str(date.today() - timedelta(days=days))
    rows = db.execute(
        "SELECT activity_id, date FROM health_activities WHERE type_key='multi_sport' AND date >= ? ORDER BY date DESC",
        (since,)
    ).fetchall()

    print(f'Found {len(rows)} multisport activities since {since} ({days} days)')

    for act_id, act_date in rows:
        existing = db.execute(
            'SELECT COUNT(*) FROM health_activity_legs WHERE activity_id = ?', (act_id,)
        ).fetchone()[0]
        if existing > 0:
            print(f'  {act_date} ({act_id}): already has {existing} legs, skipping')
            continue

        child_ids = _child_activity_ids(c, act_id)
        if not child_ids:
            print(f'  {act_date} ({act_id}): no child IDs found')
            continue

        print(f'  {act_date} ({act_id}): fetching {len(child_ids)} legs...')
        store_legs(db, c, act_id, child_ids)
        time.sleep(SLEEP_BETWEEN)

    db.close()
    print('Done.')


if __name__ == '__main__':
    main()
