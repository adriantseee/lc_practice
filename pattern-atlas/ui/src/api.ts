const BASE = '/api'

export interface PatternSummary {
  id: number
  name: string
  primitive: string
  invariant: string
  complexity_signature: string
  difficulty_tier: number
  status: 'unseen' | 'learning' | 'mastered'
  locked: boolean
}

export interface GraphData {
  primitives: { id: number; name: string }[]
  patterns: (PatternSummary & { primitive_id: number })[]
  prereqs: { pattern_id: number; prereq_id: number }[]
}

export interface PatternDetail extends PatternSummary {
  template_code: string
  problems: {
    id: number
    leetcode_id: number
    url: string
    difficulty: string
    disguise_level: number
    role: string
    composition_type: string
  }[]
}

export interface RecognizeResult {
  pattern: string
  pattern_id: number | null
  score: number
  matched_clues: string
  has_constraint: number
}

export async function fetchGraph(): Promise<GraphData> {
  const r = await fetch(`${BASE}/graph`)
  if (!r.ok) throw new Error('Failed to fetch graph')
  return r.json()
}

export async function fetchPattern(id: number): Promise<PatternDetail> {
  const r = await fetch(`${BASE}/pattern?id=${id}`)
  if (!r.ok) throw new Error('Failed to fetch pattern')
  return r.json()
}

export async function fetchRecognize(q: string): Promise<RecognizeResult[]> {
  const r = await fetch(`${BASE}/recognize?q=${encodeURIComponent(q)}`)
  if (!r.ok) throw new Error('Failed to fetch recognize')
  return r.json()
}

export async function postProgress(patternId: number, status: string): Promise<void> {
  const r = await fetch(`${BASE}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern_id: patternId, status }),
  })
  if (!r.ok) throw new Error('Failed to update progress')
}
