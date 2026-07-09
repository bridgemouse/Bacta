"""Tests that the 4 previously-unguarded provider pollers (oura, polar, whoop,
withings) fail cleanly instead of crashing with an unhandled traceback —
matching the existing strava/hevy pattern.

Each script is exercised as a real subprocess (these are standalone CLI
scripts run by systemd/cron, not imported modules), so this test drives them
the same way production does.

Run with: python3 -m unittest tests.python.test_provider_poller_error_handling -v
"""
import os
import subprocess
import sys
import unittest

REPO_ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
PROVIDERS = ['oura', 'polar', 'whoop', 'withings']


def run_poller(provider: str, env_overrides: dict) -> subprocess.CompletedProcess:
    script = os.path.join(REPO_ROOT, 'scripts', 'providers', provider, 'poller.py')
    env = {**os.environ, **env_overrides}
    return subprocess.run(
        [sys.executable, script],
        env=env, capture_output=True, text=True, timeout=15,
    )


class TestMissingToken(unittest.TestCase):
    def test_exits_cleanly_when_token_unset(self):
        for provider in PROVIDERS:
            with self.subTest(provider=provider):
                env = {k: v for k, v in os.environ.items() if k != 'BACTA_INTERNAL_TOKEN'}
                env['BACTA_INTERNAL_TOKEN'] = ''
                result = run_poller(provider, env)
                self.assertEqual(result.returncode, 1)
                self.assertNotIn('Traceback', result.stderr)
                self.assertIn('BACTA_INTERNAL_TOKEN', result.stderr)


class TestUnreachableServer(unittest.TestCase):
    def test_exits_cleanly_when_server_unreachable(self):
        for provider in PROVIDERS:
            with self.subTest(provider=provider):
                result = run_poller(provider, {
                    'BACTA_INTERNAL_TOKEN': 'dummy-token',
                    'BACTA_BASE_URL': 'http://127.0.0.1:1',
                })
                self.assertEqual(result.returncode, 1)
                self.assertNotIn('Traceback', result.stderr)
                self.assertIn('is bacta-api running', result.stderr)


class TestRequestsImportGuard(unittest.TestCase):
    def test_exits_cleanly_when_requests_not_installed(self):
        for provider in PROVIDERS:
            with self.subTest(provider=provider):
                script = os.path.join(REPO_ROOT, 'scripts', 'providers', provider, 'poller.py')
                # Simulate a missing `requests` package: sys.modules['requests'] = None
                # makes `import requests` raise ImportError, without needing to
                # actually uninstall the real dependency.
                code = f'import sys; sys.modules["requests"] = None; exec(open({script!r}).read())'
                result = subprocess.run(
                    [sys.executable, '-c', code],
                    capture_output=True, text=True, timeout=15,
                )
                self.assertEqual(result.returncode, 1)
                self.assertNotIn('Traceback', result.stderr)
                self.assertIn('requests library not installed', result.stderr)


if __name__ == '__main__':
    unittest.main()
