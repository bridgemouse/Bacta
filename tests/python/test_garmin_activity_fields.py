"""Tests for the #41 per-activity field expansion.

Fixtures below mirror the *shape* (key names, plausible value ranges) of real
get_activity() summaryDTO responses pulled from the live Garmin API for a
running and a strength_training activity during development of this feature —
values are synthetic, not copied from actual logged activity data.

No existing pytest/unittest harness exists for scripts/ in this repo (Python
scripts are otherwise verified via py_compile per CLAUDE.md); this introduces
a minimal stdlib-only unittest file so extract_activity_summary_fields can be
regression-tested in isolation, without hitting the DB or the live API.

Run with: python3 -m unittest tests/python/test_garmin_activity_fields.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))

from garmin_poller import extract_activity_summary_fields  # noqa: E402

RUNNING_SUMMARY_DTO = {
    'maxHR': 178,
    'minHR': 96,
    'activityTrainingLoad': 142.3,
    'differenceBodyBattery': -18,
    'movingDuration': 2831.0,
    'elapsedDuration': 2912.0,
    'averageSpeed': 3.21,
    'maxSpeed': 4.87,
    'trainingEffectLabel': 'TEMPO_TRAINING',
    'steps': 6210,
    'bmrCalories': 88,
    'moderateIntensityMinutes': 41,
    'vigorousIntensityMinutes': 6,
    'averagePower': 267,
    'normalizedPower': 279,
    'averageRunCadence': 172.4,
    'strideLength': 118.2,
    'verticalOscillation': 8.9,
    'groundContactTime': 251.0,
    # fields not part of the #41 expansion — must be ignored, not error
    'startLatitude': 40.0,
    'waterEstimated': 500,
}

STRENGTH_SUMMARY_DTO = {
    'maxHR': 142,
    'minHR': 68,
    'activityTrainingLoad': 51.0,
    'differenceBodyBattery': -9,
    'movingDuration': 1890.0,
    'elapsedDuration': 2650.0,
    'averageSpeed': 0.0,
    'maxSpeed': 0.0,
    'trainingEffectLabel': 'RECOVERY',
    'steps': 340,
    'bmrCalories': 61,
    'moderateIntensityMinutes': 12,
    'vigorousIntensityMinutes': 0,
    'activeSets': 14,
    'totalExerciseReps': 168,
    # no averagePower/normalizedPower/run dynamics keys present for strength — omitted entirely,
    # matching the real API response shape observed
}


class ExtractActivitySummaryFieldsTests(unittest.TestCase):
    def test_running_activity_extracts_broadly_applicable_and_power_fields(self):
        result = extract_activity_summary_fields(RUNNING_SUMMARY_DTO, 'running')
        self.assertEqual(result['max_hr'], 178)
        self.assertEqual(result['min_hr'], 96)
        self.assertEqual(result['training_load'], 142.3)
        self.assertEqual(result['body_battery_diff'], -18)
        self.assertEqual(result['moving_duration_s'], 2831.0)
        self.assertEqual(result['elapsed_duration_s'], 2912.0)
        self.assertEqual(result['avg_speed_mps'], 3.21)
        self.assertEqual(result['max_speed_mps'], 4.87)
        self.assertEqual(result['training_effect_label'], 'TEMPO_TRAINING')
        self.assertEqual(result['steps'], 6210)
        self.assertEqual(result['bmr_calories'], 88)
        self.assertEqual(result['moderate_intensity_min'], 41)
        self.assertEqual(result['vigorous_intensity_min'], 6)
        self.assertEqual(result['avg_power_w'], 267)
        self.assertEqual(result['normalized_power_w'], 279)
        # strength-only fields must be absent (None) for a running activity
        self.assertIsNone(result['active_sets'])
        self.assertIsNone(result['total_exercise_reps'])

    def test_strength_activity_extracts_set_and_rep_counts(self):
        result = extract_activity_summary_fields(STRENGTH_SUMMARY_DTO, 'strength_training')
        self.assertEqual(result['active_sets'], 14)
        self.assertEqual(result['total_exercise_reps'], 168)
        self.assertEqual(result['max_hr'], 142)
        self.assertEqual(result['steps'], 340)
        self.assertEqual(result['training_effect_label'], 'RECOVERY')
        # power fields absent from the raw payload — must resolve to None, not KeyError
        self.assertIsNone(result['avg_power_w'])
        self.assertIsNone(result['normalized_power_w'])

    def test_missing_dto_fields_resolve_to_none_not_error(self):
        result = extract_activity_summary_fields({}, 'walking')
        for key, value in result.items():
            self.assertIsNone(value, f'{key} should be None for an empty summaryDTO')


if __name__ == '__main__':
    unittest.main()
