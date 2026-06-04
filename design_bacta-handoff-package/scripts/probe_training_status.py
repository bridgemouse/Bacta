#!/usr/bin/env python3
"""probe_training_status.py — Dump full Garmin training status payload for inspection.

Run manually after a sync to see what fields Garmin returns that the poller
isn't capturing yet. Useful for finding Garmin Coach / training plan data.

Usage:
  python3 scripts/probe_training_status.py
  python3 scripts/probe_training_status.py 2026-06-03   # specific date
  python3 scripts/probe_training_status.py --all        # try every endpoint

Output is written to probe_output.json (and printed to stdout).
"""

import json, os, sys, time
from datetime import date, timedelta
from garminconnect import Garmin

TOKEN_DIR = os.path.expanduser('~/.garminconnect')
OUT_FILE  = os.path.join(os.path.dirname(__file__), '..', 'probe_output.json')

SLEEP = 0.5  # be polite


def try_call(label, fn, *args, **kwargs):
    """Call a Garmin API method, catch errors, return (label, result_or_error)."""
    print(f'  → {label}...', end=' ', flush=True)
    try:
        result = fn(*args, **kwargs)
        print('OK')
        return label, result
    except Exception as e:
        print(f'ERROR: {e}')
        return label, {'_error': str(e)}


def main():
    target = str(date.today())
    run_all = '--all' in sys.argv
    for arg in sys.argv[1:]:
        if arg != '--all' and len(arg) == 10:
            target = arg

    print(f'Authenticating...')
    c = Garmin()
    c.login(TOKEN_DIR)
    print(f'Authenticated as: {c.display_name}')
    print(f'Target date: {target}')
    print()

    results = {}

    # ── Core training endpoints ───────────────────────────────────────────────

    print('── TRAINING STATUS ──────────────────────────────────────────────────')
    _, r = try_call('get_training_status', c.get_training_status, target)
    results['training_status'] = r
    time.sleep(SLEEP)

    _, r = try_call('get_training_readiness', c.get_training_readiness, target)
    results['training_readiness'] = r
    time.sleep(SLEEP)

    _, r = try_call('get_max_metrics', c.get_max_metrics, target)
    results['max_metrics'] = r
    time.sleep(SLEEP)

    _, r = try_call('get_fitnessage_data', c.get_fitnessage_data, target)
    results['fitness_age'] = r
    time.sleep(SLEEP)

    print()

    # ── Activity details — pick the most recent activity ─────────────────────

    print('── ACTIVITY DETAILS ─────────────────────────────────────────────────')
    week_ago = str(date.fromisoformat(target) - timedelta(days=7))
    _, acts = try_call('get_activities_by_date', c.get_activities_by_date, week_ago, target)
    results['recent_activities_summary'] = acts
    time.sleep(SLEEP)

    if isinstance(acts, list) and len(acts) > 0:
        act_id = acts[0].get('activityId')
        if act_id:
            print(f'  Most recent activity: {acts[0].get("activityName")} (id={act_id})')
            _, r = try_call('get_activity', c.get_activity, act_id)
            results['activity_detail'] = r
            time.sleep(SLEEP)

            _, r = try_call('get_activity_hr_in_timezones', c.get_activity_hr_in_timezones, act_id)
            results['activity_hr_zones'] = r
            time.sleep(SLEEP)

            _, r = try_call('get_activity_splits', c.get_activity_splits, act_id)
            results['activity_splits'] = r
            time.sleep(SLEEP)

    print()

    # ── Garmin Coach / training plan endpoints (if --all) ────────────────────

    if run_all:
        print('── GARMIN COACH / PLAN (--all) ──────────────────────────────────────')

        plan_methods = [
            ('get_workout_scheduled_on',      lambda: c.get_workout_scheduled_on(target)),
            ('get_workouts',                  lambda: c.get_workouts(0, 5)),
            ('get_training_load',             lambda: c.get_training_load(target)),
        ]

        for label, fn in plan_methods:
            if hasattr(c, label.split('(')[0]):
                _, r = try_call(label, fn)
                results[label] = r
                time.sleep(SLEEP)
            else:
                print(f'  → {label}... NOT AVAILABLE on this garminconnect version')
                results[label] = {'_error': 'method not found'}

        print()

    # ── Intraday / body battery curve ─────────────────────────────────────────

    print('── INTRADAY DATA ────────────────────────────────────────────────────')
    _, r = try_call('get_body_battery', c.get_body_battery, target, target)
    results['body_battery_raw'] = r
    time.sleep(SLEEP)

    _, r = try_call('get_stress_data', c.get_stress_data, target)
    results['stress_data'] = r
    time.sleep(SLEEP)

    print()

    # ── Write output ──────────────────────────────────────────────────────────

    out_path = os.path.abspath(OUT_FILE)
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    print(f'── DONE ─────────────────────────────────────────────────────────────')
    print(f'Full output saved to: {out_path}')
    print()

    # Print a summary of keys found in training_status
    ts = results.get('training_status')
    if isinstance(ts, (dict, list)):
        print('Keys found in training_status response (top level):')
        if isinstance(ts, list) and ts:
            ts = ts[0]
        if isinstance(ts, dict):
            _print_keys(ts, depth=0, max_depth=3)
    print()

    # Check if any Coach/plan related keys appear anywhere
    raw = json.dumps(results).lower()
    coach_hints = ['coach', 'plan', 'phase', 'block', 'week', 'taper', 'build', 'base', 'peak', 'schedule']
    found = [h for h in coach_hints if h in raw]
    if found:
        print(f'⚑  Keywords found in responses (possible Coach data): {", ".join(found)}')
        print(f'   → Search probe_output.json for these to find the fields.')
    else:
        print('○  No Coach/plan keywords found — Garmin Coach may not be active or exposed.')


def _print_keys(obj, depth=0, max_depth=3, prefix=''):
    indent = '  ' * (depth + 1)
    if depth >= max_depth:
        print(f'{indent}...')
        return
    if isinstance(obj, dict):
        for k, v in list(obj.items())[:20]:
            vtype = type(v).__name__
            if isinstance(v, (dict, list)):
                print(f'{indent}{k}: [{vtype}]')
                _print_keys(v, depth + 1, max_depth)
            else:
                print(f'{indent}{k}: {repr(v)[:80]}')
    elif isinstance(obj, list):
        print(f'{indent}[list of {len(obj)} items]')
        if obj:
            _print_keys(obj[0], depth + 1, max_depth)


if __name__ == '__main__':
    main()
