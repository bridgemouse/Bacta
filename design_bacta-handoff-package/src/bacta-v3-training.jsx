/* bacta-v3-training.jsx — Training channel v3 + InfoCard on every card. */

function TrainingViewV3({ tab }) {
  const { color } = BACTA;
  const accent = BACTA.section.training.accent;
  const m = BACTA.metrics.training;

  if (tab === 'trends') {
    return (
      <RecScroll>
        <MX4Briefing channel="training" brief={BACTA.brief.training} label="TRAINING" />

        <Rail label="TRAINING LOAD" accent={accent} right={`OPTIMAL ${m.load.low}–${m.load.high}`} />
        <InfoCard id="trn-load-trend" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 9 }}
          title="Acute Training Load"
          description="Weighted sum of training stress over the past 7 days. Each session contributes based on intensity and duration. Staying within your optimal band (455–555) builds fitness without raising injury risk."
          source="Garmin Fenix 7X · Training Readiness">
          <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.35} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>ACUTE LOAD · 7 DAYS</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 20, fontWeight: 700, color: color.text }}>{m.load.value}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: accent }}>{m.load.state.toUpperCase()}</span>
              </span>
            </div>
            <Bars7v2 data={m.load.trend} accent={accent} h={80} />
          </div>
        </InfoCard>

        <Rail label="WEEKLY VOLUME" accent={accent} right="6 WEEKS · HOURS" />
        <InfoCard id="trn-volume" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 9 }}
          title="Weekly Training Volume"
          description="Total training hours per calendar week across all activity types. Volume trend over 6 weeks reveals periodization patterns — look for planned step-backs (deload weeks) and progressive overload cycles."
          source="Garmin Connect · all activity types">
          <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.28} />
            {m.weeklyVolume && <WeeklyVolumeBars data={m.weeklyVolume} accent={accent} />}
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginTop: 7 }}>W1 = current week (partial)</div>
          </div>
        </InfoCard>

        <Rail label="FITNESS AGE · 30 DAY" accent={accent} right={`${m.vo2max.fitnessAge} yr NOW`} />
        <InfoCard id="trn-fitnessage-trend" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 9 }}
          title="Fitness Age Trend"
          description="Your physiological age estimated from VO2 Max relative to your demographic. Lower is better — a downward trend means your aerobic capacity is improving relative to your peers. A rising trend signals detraining or declining intensity."
          source="Garmin Fenix 7X · VO2 Max algorithm">
          <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden' }}>
            <Bracket color={accent} inset={6} op={0.28} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>IMPROVING ↓</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>{m.fitnessAgeTrend ? m.fitnessAgeTrend[0].toFixed(1) : '—'} →</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 15, fontWeight: 700, color: color.green }}>{m.vo2max.fitnessAge}</span>
                <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>yr</span>
              </div>
            </div>
            {m.fitnessAgeTrend && <FitnessAgeLine data={m.fitnessAgeTrend} accent={accent} />}
            <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginTop: 5 }}>lower = better · 368 data points available</div>
          </div>
        </InfoCard>

        <Rail label="AVG ACTIVITY HR · 6 WEEKS" accent={accent} right="DECLINING = IMPROVING" />
        {m.activityHrByWeek && (
          <InfoCard id="trn-acthr" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 9 }}
            title="Average Activity Heart Rate"
            description="Average HR across all workout sessions by week. At the same relative effort, a declining trend means your heart is doing the same work more efficiently — the hallmark of aerobic adaptation. This is a cleaner fitness signal than pace or power alone."
            source="Garmin Connect · activity sessions">
            <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 11px', overflow: 'hidden' }}>
              <Bracket color={accent} inset={6} op={0.28} />
              <TrendRow label="Avg HR" value={m.activityHrByWeek[5]} unit="bpm" data={m.activityHrByWeek} accent={accent} delta={m.activityHrByWeek[5] - m.activityHrByWeek[0]} lowerBetter />
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5, color: color.text3, marginTop: 6 }}>same effort, lower HR = aerobic adaptation</div>
            </div>
          </InfoCard>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <TrendRow label="VO2 Max" value={m.vo2max.value} unit="mL/kg" data={m.vo2max.trend} accent={accent} delta={m.vo2max.trend[m.vo2max.trend.length-1] - m.vo2max.trend[0]} />
          <TrendRow label="Intensity" value={m.intensity.moderate + m.intensity.vigorous * 2} unit="pts" data={m.intensity.trend} accent={accent} kind="bars" />
          <TrendRow label="Steps" value={m.daily.steps.toLocaleString()} data={m.daily.stepsTrend} accent={accent} kind="bars" fmt={v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v} />
          <TrendRow label="Calories" value={m.daily.caloriesTotal} unit="kcal" data={m.daily.calTrend} accent={accent} kind="bars" />
        </div>
      </RecScroll>
    );
  }

  const totalZoneMins = m.hrZones.reduce((s, z) => s + z.mins, 0);

  return (
    <RecScroll>
      <MX4Briefing channel="training" brief={BACTA.brief.training} label="TRAINING" />

      {/* Status */}
      <InfoCard id="trn-status" size="row" noStretch accent={accent} radius={9} style={{ marginBottom: 9 }}
        title="Training Status"
        description="Garmin's classification of your recent training load trajectory relative to your fitness trend. 'Productive' means load is appropriate to build fitness. Other states: Maintaining, Peaking, Recovery, Unproductive, Detraining. Updated after each workout."
        source="Garmin Fenix 7X · Training Readiness">
        <StatusBanner status={m.status.value} sub={m.status.sub} accent={accent} />
      </InfoCard>

      <Rail label="PERFORMANCE" accent={accent} right="CURRENT" />
      <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
        <InfoCard id="trn-fitnessage" size="pair" accent={accent} radius={10} style={{ flex: 1 }} compact
          title="Fitness Age"
          description="Your physiological age based on VO2 Max compared to your demographic. It can be decades below your chronological age with consistent aerobic training. Yours is currently 19 — elite for any age group. VO2 Max is the single strongest predictor of long-term health outcomes."
          source="Garmin Fenix 7X · VO2 Max algorithm">
          <HeadlineCard accent={accent} label="Fitness Age"
            foot={<div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}><span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3 }}>VO2MAX</span><span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 13, fontWeight: 700, color: accent }}>{m.vo2max.value}</span><span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8, color: color.text3 }}>mL/kg</span></div>}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 36, fontWeight: 700, color: accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{m.vo2max.fitnessAge}</span>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 11, color: color.text3 }}>yr</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, padding: '2px 7px', borderRadius: 4, background: hexA(accent, 0.1), border: `1px solid ${hexA(accent, 0.35)}` }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: accent, fontWeight: 700, letterSpacing: '0.06em' }}>ELITE</span>
            </div>
          </HeadlineCard>
        </InfoCard>

        <InfoCard id="trn-acuteload" size="pair" accent={accent} radius={10} style={{ flex: 1 }} compact
          title="Acute Training Load"
          description="Weighted sum of training stress over the past 7 days. Compared to your 28-day chronic load to produce the Load Ratio. Staying in the Optimal band builds fitness; below is undertraining; above 1.5× raises injury risk significantly."
          source="Garmin Fenix 7X · activity import">
          <HeadlineCard accent={accent} label="Acute Load"
            foot={<LoadBand value={m.load.value} low={m.load.low} high={m.load.high} accent={accent} />}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, paddingLeft: 3 }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 32, fontWeight: 700, color: color.text, lineHeight: 1, letterSpacing: '-0.01em' }}>{m.load.value}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', borderRadius: 4, background: hexA(accent, 0.12), border: `1px solid ${hexA(accent, 0.35)}` }}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, color: accent, fontWeight: 700, letterSpacing: '0.06em' }}>{m.load.state.toUpperCase()}</span>
            </div>
          </HeadlineCard>
        </InfoCard>
      </div>

      {/* Load Ratio */}
      {m.loadRatio && (
        <InfoCard id="trn-loadratio" size="row" noStretch accent={accent} radius={8} style={{ marginBottom: 0 }}
          title="Load Ratio (ACWR)"
          description="Acute ÷ Chronic workload ratio — the Acute:Chronic Workload Ratio. The optimal band (0.8–1.3) represents progressive overload without excessive spike. Above 1.5 is the 'danger zone' associated with 2–3× elevated injury risk in endurance athletes."
          source="Bacta-computed · Garmin load data">
          <LoadRatioRow ratio={m.loadRatio} accent={accent} />
        </InfoCard>
      )}

      <Rail label="INTENSITY THIS WEEK" accent={accent} right={`GOAL ${m.intensity.goal} MIN`} style={{ marginTop: 9 }} />
      <InfoCard id="trn-intensity" size="row" noStretch accent={accent} radius={9} style={{ marginBottom: 0 }}
        title="Weekly Intensity Minutes"
        description="Moderate and vigorous activity combined using a 1:2 ratio (1 vigorous = 2 moderate minutes). WHO recommends 150+ moderate or 75+ vigorous minutes weekly. Garmin counts minutes above your aerobic threshold toward vigorous."
        source="Garmin Fenix 7X · HR zone detection">
        <IntensityBar moderate={m.intensity.moderate} vigorous={m.intensity.vigorous} goal={m.intensity.goal} accent={accent} />
      </InfoCard>

      {m.hrZones && m.hrZones.some(z => z.mins > 0) && (
        <>
          <Rail label="HR ZONES" accent={accent} right={totalZoneMins.toFixed(0) + ' MIN TODAY'} />
          <InfoCard id="trn-hrzones" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 0 }}
            title="HR Zone Distribution"
            description="Time spent in each intensity zone relative to max HR. Zone 2 builds aerobic base and fat metabolism. Zone 3–4 builds threshold and VO2 Max. Zone 5 is anaerobic. Most elite programs target 80% Z1-2 and 20% Z3-5 over a training week."
            source="Garmin Fenix 7X · optical HR + zones">
            <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 12px', overflow: 'hidden' }}>
              <Bracket color={accent} inset={6} op={0.28} />
              <ZoneDistribution zones={m.hrZones} accent={accent} />
            </div>
          </InfoCard>
        </>
      )}

      <Rail label="DAILY ACTIVITY" accent={accent} right={m.daily.steps.toLocaleString() + ' STEPS'} />
      <InfoCard id="trn-steps" size="bar" noStretch accent={accent} radius={10} style={{ marginBottom: 9 }}
        title="Daily Steps"
        description="Total steps today tracked by the accelerometer. 8,000–10,000 steps/day is associated with significantly reduced all-cause mortality, independent of structured exercise. Non-exercise activity thermogenesis (NEAT) is often the largest variable in daily energy expenditure."
        source="Garmin Fenix 7X · accelerometer">
        <div style={{ position: 'relative', background: color.surface, border: `1px solid ${color.line}`, borderRadius: 10, padding: '13px 14px 12px', overflow: 'hidden' }}>
          <Bracket color={accent} inset={6} op={0.28} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: color.text2, fontWeight: 600 }}>STEPS · 7 DAYS</span>
            <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: m.daily.steps >= m.daily.stepGoal ? color.green : color.text3 }}>
              {m.daily.steps >= m.daily.stepGoal ? 'GOAL MET ◆' : (m.daily.stepGoal - m.daily.steps).toLocaleString() + ' TO GO'}
            </span>
          </div>
          <StepBars data={m.daily.stepsTrend} goal={m.daily.stepGoal} accent={accent} />
        </div>
      </InfoCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
        <InfoCard id="trn-distance" size="tile" accent={accent} radius={9} compact
          title="Distance"
          description="Total GPS-tracked distance today across all activities. Combine with HR zone data for a complete training load picture."
          source="Garmin Fenix 7X">
          <MetricRingTile label="Distance" value={m.daily.distanceKm} unit="km" goal={m.daily.distanceGoal} accent={accent} />
        </InfoCard>
        <InfoCard id="trn-calories" size="tile" accent={accent} radius={9} compact
          title="Total Calories"
          description="Basal metabolic rate plus active calories. Treat as a relative indicator — useful for tracking trends, not clinical nutrition precision."
          source="Garmin Fenix 7X">
          <MetricRingTile label="Calories" value={m.daily.caloriesTotal} unit="kcal" goal={m.daily.calGoal} accent={accent} />
        </InfoCard>
        <InfoCard id="trn-activecal" size="tile" accent={accent} radius={9} compact
          title="Active Calories"
          description="Calories from activity only, excluding resting metabolism. More directly reflects workout intensity and volume than total calories."
          source="Garmin Fenix 7X">
          <MetricRingTile label="Active Cal" value={m.daily.caloriesActive} unit="kcal" goal={m.daily.activeCalGoal} accent={accent} />
        </InfoCard>
        <InfoCard id="trn-floors" size="tile" accent={accent} radius={9} compact
          title="Floors Climbed"
          description="Elevation gained via barometric altimeter. Each floor ≈ 3m. Tracks incidental vertical movement — stairs, hills, hikes — beyond step count."
          source="Garmin Fenix 7X">
          <div style={{ position: 'relative', background: color.surface,
            border: `1px solid ${color.line}`, borderRadius: 9,
            padding: '10px 12px', overflow: 'hidden', flex: 1,
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${accent}, transparent 80%)`, opacity: 0.7 }} />
            <Ring progress={Math.min(m.daily.floors / m.daily.floorsGoal, 1)}
              accent={accent} size={46} stroke={4}>
              <span style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, fontWeight: 700,
                color: color.text }}>{Math.round(m.daily.floors)}</span>
            </Ring>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 8.5, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: color.text2, fontWeight: 600,
                marginBottom: 4 }}>Floors</div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 9, color: color.text3,
                lineHeight: 1.6 }}>
                ↑{Math.round(m.daily.floors)} up
                {m.daily.floorsDown != null && <> · ↓{m.daily.floorsDown} dn</>}
              </div>
              <div style={{ fontFamily: BACTA.FONT_MONO, fontSize: 7.5,
                color: hexA(color.text3, 0.7) }}>goal {m.daily.floorsGoal}</div>
            </div>
          </div>
        </InfoCard>
      </div>

      <Rail label="ACTIVITY LOG" accent={accent} right={m.activities.length + ' RECENT · TAP TO EXPAND'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.activities.map((a, i) => <LogEntryV3 key={i} a={a} accent={accent} />)}
      </div>
    </RecScroll>
  );
}

Object.assign(window, { TrainingView: TrainingViewV3 });
