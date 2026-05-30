# mx4/sections.py
"""Section definitions for MX-4 insight cards."""

from dataclasses import dataclass


@dataclass
class Section:
    id: str
    name: str
    metrics: list[str]
    include_manual: bool
    prompt_addendum: str


SECTIONS: list[Section] = [
    Section(
        id='recovery',
        name='Recovery',
        metrics=[
            'hrv', 'hrv_5min_high', 'recovery_score', 'recovery_time_hours',
            'stress_score', 'body_battery', 'body_battery_charged', 'resting_hr', 'sleep_duration',
        ],
        include_manual=False,
        prompt_addendum=(
            "Focus: overall recovery status — is the patient ready to train hard today or should they pull back? "
            "Lead with the most clinically significant finding. "
            "HRV is the primary autonomic signal; recovery_score and body_battery are corroborating. "
            "Stress score and resting HR provide additional autonomic context. "
            "Include a clear training recommendation: green / yellow / red."
        ),
    ),
    Section(
        id='sleep-quality',
        name='Sleep Quality',
        metrics=[
            'sleep_duration', 'sleep_score',
            'sleep_deep_minutes', 'sleep_rem_minutes',
            'sleep_light_minutes', 'sleep_awake_minutes',
        ],
        include_manual=False,
        prompt_addendum=(
            "Focus: sleep architecture and quality — not just duration but composition. "
            "Deep sleep (slow-wave) drives physical recovery and GH release; REM drives cognitive consolidation and memory. "
            "Flag chronic deficiency in any stage. "
            "Ideal targets for a 26-year-old male: deep ≥15% of total, REM ≥20%, awake <5%. "
            "Use WebSearch to find current sleep science on these targets."
        ),
    ),
    Section(
        id='training-week',
        name='Training Week',
        metrics=['steps', 'intensity_minutes', 'training_load', 'recovery_time_hours', 'vo2max'],
        include_manual=True,
        prompt_addendum=(
            "Focus: training stimulus and load management — is the patient building fitness or accumulating excessive stress? "
            "WHO recommends 150–300 min/week moderate or 75–150 min/week vigorous activity for health; "
            "athletic development requires more. "
            "Manual inputs (readiness, caffeine, supplements) are patient self-reports — look for correlations. "
            "High caffeine + low readiness on the same day is a signal worth flagging. "
            "Use vault-query to check the summer running plan and weekly mileage targets."
        ),
    ),
    Section(
        id='vo2-fitness',
        name='VO2 Max & Fitness',
        metrics=['vo2max', 'resting_hr', 'recovery_score', 'training_load'],
        include_manual=False,
        prompt_addendum=(
            "Focus: long-term aerobic fitness trajectory. "
            "The patient's declared goal: VO2 max 52–55 ml/kg/min ('Excellent' for age 26 male) by late July/pre-wedding. "
            "VO2 max typically improves ~0.5–1 ml/kg/min per month with consistent structured training. "
            "Use vault-query to find the summer running plan, race goals, and specific training timeline. "
            "Use bacta-db to pull 90 days of vo2max history for a proper trend line. "
            "Project forward: at current trajectory, what does VO2 max look like in 8 weeks? "
            "Is the goal achievable? What would need to change if not?"
        ),
    ),
]
