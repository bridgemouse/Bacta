export interface BriefingResult {
  tone:           'POSITIVE' | 'CAUTION' | 'FLAG'
  headline:       string
  body:           string
  recommendation: string
  flags:          string[]
  generated_at?:  string
  model?:         string
}
