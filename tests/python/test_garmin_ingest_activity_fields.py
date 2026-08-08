"""Tests for #194 — garmin_ingest.py must write the same activity fields as
garmin_poller.py (aerobic_te, anaerobic_te, recovery_time_h, HR zones, run
dynamics), not just the #41 summary-DTO expansion fields.

Fixtures mirror the shape of real Garmin API responses (activity list item,
get_activity_hr_in_timezones list) — values are synthetic.

Run with: python3 -m unittest tests/python/test_garmin_ingest_activity_fields.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))

import garmin_poller
import garmin_ingest

ACTIVITY_LIST_ITEM = {
    'activityId': 12345,
    'aerobicTrainingEffect': 3.4,
    'anaerobicTrainingEffect': 1.1,
    'recoveryTime': 18,
}

RUN_DTO = {
    'averageRunCadence': 172.4,
    'strideLength': 118.2,
    'verticalOscillation': 8.9,
    'groundContactTime': 251.0,
}

ZONE_ENTRIES = [
    {'zoneNumber': 1, 'secsInZone': 120},
    {'zoneNumber': 2, 'secsInZone': 300},
    {'zoneNumber': 3, 'secsInZone': 600},
    {'zoneNumber': 4, 'secsInZone': 90},
    {'zoneNumber': 5, 'secsInZone': 0},
]


class TeRecoveryFieldsTests(unittest.TestCase):
    def test_extracts_aerobic_anaerobic_te_and_recovery_time_from_activity_list_item(self):
        result = garmin_poller.extract_activity_te_recovery_fields(ACTIVITY_LIST_ITEM)
        self.assertEqual(result['aerobic_te'], 3.4)
        self.assertEqual(result['anaerobic_te'], 1.1)
        self.assertEqual(result['recovery_time_h'], 18)

    def test_missing_fields_resolve_to_none(self):
        result = garmin_poller.extract_activity_te_recovery_fields({})
        self.assertIsNone(result['aerobic_te'])
        self.assertIsNone(result['anaerobic_te'])
        self.assertIsNone(result['recovery_time_h'])


class RunDynamicsFieldsTests(unittest.TestCase):
    def test_extracts_run_dynamics_for_a_running_activity(self):
        result = garmin_poller.extract_run_dynamics_fields(RUN_DTO, 'running')
        self.assertEqual(result['run_cadence'], 172)
        self.assertEqual(result['run_stride_cm'], 118.2)
        self.assertEqual(result['run_vert_osc_cm'], 8.9)
        self.assertEqual(result['run_gct_ms'], 251)

    def test_returns_none_for_a_non_running_activity_type(self):
        result = garmin_poller.extract_run_dynamics_fields(RUN_DTO, 'strength_training')
        self.assertIsNone(result['run_cadence'])
        self.assertIsNone(result['run_stride_cm'])
        self.assertIsNone(result['run_vert_osc_cm'])
        self.assertIsNone(result['run_gct_ms'])


class HrZoneAggregationTests(unittest.TestCase):
    def test_sums_secs_in_zone_per_zone_number(self):
        result = garmin_poller.aggregate_hr_zone_seconds(ZONE_ENTRIES)
        self.assertEqual(result['zone1_s'], 120)
        self.assertEqual(result['zone2_s'], 300)
        self.assertEqual(result['zone3_s'], 600)
        self.assertEqual(result['zone4_s'], 90)
        self.assertEqual(result['zone5_s'], 0)

    def test_aggregates_across_multiple_entries_for_the_same_zone(self):
        # e.g. multi_sport container — zone entries from two child activities concatenated
        result = garmin_poller.aggregate_hr_zone_seconds(ZONE_ENTRIES + ZONE_ENTRIES)
        self.assertEqual(result['zone1_s'], 240)

    def test_empty_input_resolves_to_none_not_zero(self):
        result = garmin_poller.aggregate_hr_zone_seconds([])
        for key, value in result.items():
            self.assertIsNone(value, f'{key} should be None, not 0, when there is no zone data')


class IngestPollerFieldParityTests(unittest.TestCase):
    """garmin_ingest.py must use the exact same extraction functions as
    garmin_poller.py — not a re-implementation that can silently drift."""

    def test_ingest_imports_the_same_te_recovery_function_as_poller(self):
        self.assertIs(garmin_ingest.extract_activity_te_recovery_fields, garmin_poller.extract_activity_te_recovery_fields)

    def test_ingest_imports_the_same_run_dynamics_function_as_poller(self):
        self.assertIs(garmin_ingest.extract_run_dynamics_fields, garmin_poller.extract_run_dynamics_fields)

    def test_ingest_imports_the_same_hr_zone_aggregator_as_poller(self):
        self.assertIs(garmin_ingest.aggregate_hr_zone_seconds, garmin_poller.aggregate_hr_zone_seconds)


if __name__ == '__main__':
    unittest.main()
