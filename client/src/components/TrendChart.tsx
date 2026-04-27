// client/src/components/TrendChart.tsx
import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  Tooltip,
} from 'recharts'
import { getMetricHistory } from '../api'
import type { MetricRow } from '../api'

// Metrics that look better as a smooth line than bars
const LINE_METRICS = new Set(['hrv', 'vo2max', 'resting_hr', 'recovery_score'])

type Props = {
  metric: string
  days?: number
}

type ChartPoint = { date: string; value: number }

const tooltipStyle = {
  contentStyle: {
    background: '#1f2937',
    border: 'none',
    borderRadius: 6,
    color: '#f9fafb',
    fontSize: 12,
  },
}

export function TrendChart({ metric, days = 7 }: Props) {
  const [data, setData] = useState<ChartPoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getMetricHistory(metric, days).then((rows: MetricRow[]) => {
      if (!cancelled) {
        setData(rows.map((r) => ({ date: r.date.slice(5), value: r.value })))
      }
    })
    return () => { cancelled = true }
  }, [metric, days])

  if (data === null) {
    return <div className="h-24 rounded-xl bg-gray-800 animate-pulse" />
  }

  if (data.length === 0) {
    return (
      <div
        data-testid="trend-chart-empty"
        className="h-24 rounded-xl bg-gray-800 flex items-center justify-center"
      >
        <span className="text-xs text-gray-500">No data yet</span>
      </div>
    )
  }

  const isLine = LINE_METRICS.has(metric)

  return (
    <div data-testid="trend-chart" className="rounded-xl bg-gray-800 p-3">
      <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
        {metric.replace(/_/g, ' ')} — {days}d
      </p>
      <ResponsiveContainer width="100%" height={80}>
        {isLine ? (
          <LineChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Tooltip {...tooltipStyle} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Tooltip {...tooltipStyle} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
