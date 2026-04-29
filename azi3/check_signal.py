#!/usr/bin/env python3
# azi3/check_signal.py
"""Signal watcher — run by host cron every minute.

Checks for AZI3_SIGNAL_PATH file. If found, atomically removes it
and spawns the orchestrator. Atomic removal prevents double-trigger
if cron fires again before the orchestrator finishes.
"""

import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SIGNAL_PATH = Path(os.environ.get('AZI3_SIGNAL_PATH', str(SCRIPT_DIR.parent / 'data' / 'azi3_run_signal')))


def main() -> None:
    if not SIGNAL_PATH.exists():
        return

    # Atomic rename: grab the signal before any concurrent process can
    tmp_path = SIGNAL_PATH.with_suffix('.processing')
    try:
        SIGNAL_PATH.rename(tmp_path)
    except FileNotFoundError:
        return  # Another process got there first

    try:
        tmp_path.unlink()
    except Exception:
        pass

    subprocess.run(
        [sys.executable, str(SCRIPT_DIR / 'orchestrator.py')],
        cwd=str(SCRIPT_DIR.parent),
    )


if __name__ == '__main__':
    main()
