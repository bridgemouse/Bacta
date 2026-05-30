# tests/azi3/test_check_signal.py
import importlib
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))


def test_no_signal_file_does_nothing(tmp_path, monkeypatch):
    monkeypatch.setenv('AZI3_SIGNAL_PATH', str(tmp_path / 'azi3_run_signal'))
    import check_signal
    importlib.reload(check_signal)

    called = []
    with patch('subprocess.run', side_effect=lambda *a, **kw: called.append(True)):
        check_signal.main()

    assert called == []


def test_signal_file_triggers_orchestrator_and_is_deleted(tmp_path, monkeypatch):
    signal_path = tmp_path / 'azi3_run_signal'
    signal_path.write_text('2026-04-28T07:43:00')
    monkeypatch.setenv('AZI3_SIGNAL_PATH', str(signal_path))

    import check_signal
    importlib.reload(check_signal)

    called = []
    with patch('subprocess.run', side_effect=lambda *a, **kw: called.append(a)):
        check_signal.main()

    assert len(called) == 1
    assert not signal_path.exists()


def test_double_call_only_triggers_once(tmp_path, monkeypatch):
    """Atomic rename prevents double-trigger if called twice before orchestrator runs."""
    signal_path = tmp_path / 'azi3_run_signal'
    signal_path.write_text('2026-04-28T07:43:00')
    monkeypatch.setenv('AZI3_SIGNAL_PATH', str(signal_path))

    import check_signal
    importlib.reload(check_signal)

    called = []
    with patch('subprocess.run', side_effect=lambda *a, **kw: called.append(True)):
        check_signal.main()  # first call — picks up signal
        check_signal.main()  # second call — no signal file

    assert len(called) == 1
