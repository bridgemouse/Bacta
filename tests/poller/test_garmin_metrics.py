import pytest
import sys
import os
from unittest.mock import AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../poller'))

@pytest.fixture
def mock_page():
    page = AsyncMock()
    response = AsyncMock()
    response.json = AsyncMock(return_value={
        "totalSteps": 9241,
        "restingHeartRate": 52,
        "averageStressLevel": 28
    })
    page.goto = AsyncMock(return_value=response)
    return page

@pytest.mark.asyncio
async def test_fetch_daily_summary_extracts_steps(mock_page):
    from garmin_metrics import fetch_daily_summary
    result = await fetch_daily_summary(mock_page, 'testuser', '2026-04-26')
    assert result['steps'] == 9241

@pytest.mark.asyncio
async def test_fetch_daily_summary_extracts_resting_hr(mock_page):
    from garmin_metrics import fetch_daily_summary
    result = await fetch_daily_summary(mock_page, 'testuser', '2026-04-26')
    assert result['resting_hr'] == 52

@pytest.mark.asyncio
async def test_fetch_daily_summary_handles_missing_field(mock_page):
    from garmin_metrics import fetch_daily_summary
    mock_page.goto.return_value.json = AsyncMock(return_value={})
    result = await fetch_daily_summary(mock_page, 'testuser', '2026-04-26')
    assert result.get('steps') is None
