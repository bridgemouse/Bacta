# tests/azi3/test_orchestrator.py
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))


def test_is_usage_limit_error_detects_limit():
    import orchestrator
    assert orchestrator.is_usage_limit_error('You have exceeded your usage limit')
    assert orchestrator.is_usage_limit_error('Rate limit exceeded for this period')
    assert orchestrator.is_usage_limit_error('Too many requests')
    assert not orchestrator.is_usage_limit_error('some other transient error')
    assert not orchestrator.is_usage_limit_error('')


def test_build_prompt_includes_section_name_and_data_header():
    import orchestrator
    from sections import SECTIONS

    section = SECTIONS[0]  # recovery
    prompt = orchestrator.build_prompt(section, {}, [])
    assert 'Recovery' in prompt
    assert 'Pre-fetched Data' in prompt
    assert 'Section Instructions' in prompt


def test_build_prompt_includes_manual_data_only_for_training(monkeypatch):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)
    from sections import SECTIONS

    training = next(s for s in SECTIONS if s.id == 'training-week')
    recovery = next(s for s in SECTIONS if s.id == 'recovery')

    manual = [{'date': '2026-04-27', 'readiness': 4, 'caffeine_mg': 200, 'supplements': None}]

    training_prompt = orchestrator.build_prompt(training, {}, manual)
    recovery_prompt = orchestrator.build_prompt(recovery, {}, manual)

    assert 'Manual inputs' in training_prompt
    assert 'Manual inputs' not in recovery_prompt


def test_run_claude_returns_html_on_success(tmp_path):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)

    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = '<div style="color:#f9fafb">AZI-3 recovery card</div>'
    mock_result.stderr = ''

    prompt_path = tmp_path / 'system-prompt.md'
    prompt_path.write_text('You are AZI-3.')
    config_path = tmp_path / 'mcp-config.json'
    config_path.write_text('{}')

    with patch.object(orchestrator, 'SYSTEM_PROMPT_PATH', prompt_path), \
         patch.object(orchestrator, 'MCP_CONFIG_PATH', config_path), \
         patch('subprocess.run', return_value=mock_result):
        result = orchestrator.run_claude('Generate recovery card')

    assert result == '<div style="color:#f9fafb">AZI-3 recovery card</div>'


def test_run_claude_retries_on_transient_failure_and_returns_none(tmp_path):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)

    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ''
    mock_result.stderr = 'some transient connection error'

    prompt_path = tmp_path / 'system-prompt.md'
    prompt_path.write_text('You are AZI-3.')
    config_path = tmp_path / 'mcp-config.json'
    config_path.write_text('{}')

    call_count = []

    def fake_run(*args, **kwargs):
        call_count.append(1)
        return mock_result

    with patch.object(orchestrator, 'SYSTEM_PROMPT_PATH', prompt_path), \
         patch.object(orchestrator, 'MCP_CONFIG_PATH', config_path), \
         patch.object(orchestrator, 'RETRY_DELAY', 0), \
         patch('subprocess.run', side_effect=fake_run):
        result = orchestrator.run_claude('Generate recovery card')

    assert result is None
    assert len(call_count) == orchestrator.MAX_RETRIES


def test_run_claude_raises_immediately_on_usage_limit(tmp_path):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)

    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ''
    mock_result.stderr = 'Usage limit exceeded for this billing period'

    prompt_path = tmp_path / 'system-prompt.md'
    prompt_path.write_text('You are AZI-3.')
    config_path = tmp_path / 'mcp-config.json'
    config_path.write_text('{}')

    call_count = []

    def fake_run(*args, **kwargs):
        call_count.append(1)
        return mock_result

    with patch.object(orchestrator, 'SYSTEM_PROMPT_PATH', prompt_path), \
         patch.object(orchestrator, 'MCP_CONFIG_PATH', config_path), \
         patch('subprocess.run', side_effect=fake_run):
        with pytest.raises(RuntimeError, match='USAGE_LIMIT'):
            orchestrator.run_claude('Generate recovery card')

    # Should not retry on usage limit
    assert len(call_count) == 1
