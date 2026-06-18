import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchPattern, postProgress } from '../api.ts'
import type { PatternDetail as PatternDetailData } from '../api.ts'

const STAGES = [
  { key: 'primitive',    label: 'Primitive',    desc: 'Understand the underlying memory model' },
  { key: 'template',     label: 'Template',     desc: 'Internalize the boilerplate + invariant' },
  { key: 'anchor',       label: 'Anchor',       desc: 'Solve a literal application (disguise 1–2)' },
  { key: 'variation',    label: 'Variations',   desc: 'Solve disguised or combined forms (disguise 3+)' },
  { key: 'antipattern',  label: 'Anti-pattern', desc: "Recognise when it looks right but isn't" },
  { key: 'synthesis',    label: 'Synthesis',    desc: 'Compose two mastered patterns' },
]

const DIFF: Record<string, string> = {
  Easy:   'text-atlas-success',
  Medium: 'text-atlas-accent dark:text-atlas-accent-dk',
  Hard:   'text-red-500',
}

function stageKey(id: number) { return `atlas_stages_${id}` }

function loadStages(id: number): boolean[] {
  try {
    const raw = localStorage.getItem(stageKey(id))
    if (raw) return JSON.parse(raw) as boolean[]
  } catch { /* ignore */ }
  return STAGES.map(() => false)
}

const list = { animate: { transition: { staggerChildren: 0.04 } } }
const row  = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}

interface Props {
  id: number
  onClose: () => void
  onMastered?: () => void
}

export default function PatternDetail({ id, onClose, onMastered }: Props) {
  const [data,    setData]    = useState<PatternDetailData | null>(null)
  const [checked, setChecked] = useState<boolean[]>(() => loadStages(id))
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    setChecked(loadStages(id))
    setSaved(false)
    fetchPattern(id).then(setData).catch(console.error)
  }, [id])

  async function toggle(i: number) {
    const next = checked.map((v, j) => (j === i ? !v : v))
    setChecked(next)
    localStorage.setItem(stageKey(id), JSON.stringify(next))
    if (next.every(Boolean) && data?.status !== 'mastered') {
      await postProgress(id, 'mastered').catch(console.error)
      setSaved(true)
      setData(d => d ? { ...d, status: 'mastered' } : d)
      onMastered?.()
    }
  }

  const primary   = data?.problems.filter(p => p.role === 'primary')   ?? []
  const auxiliary = data?.problems.filter(p => p.role === 'auxiliary')  ?? []

  return (
    <div className="px-6 py-6">
      {/* close */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-atlas-muted hover:text-atlas-text dark:hover:text-atlas-text-dk transition-colors mb-6"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Close
      </button>

      {!data ? (
        <p className="text-atlas-muted text-sm animate-pulse">Loading…</p>
      ) : (
        <>
          <div className="mb-7">
            <p className="text-xs text-atlas-muted uppercase tracking-wide mb-1">{data.primitive}</p>
            <h1 className="text-xl font-semibold leading-tight">{data.name.replace(/_/g, ' ')}</h1>
            <p className="text-sm text-atlas-muted mt-1">{data.complexity_signature}</p>
            {data.status === 'mastered' && (
              <span className="inline-block mt-2 text-xs text-atlas-success font-medium">Mastered</span>
            )}
          </div>

          <div className="rounded-2xl bg-atlas-surface dark:bg-atlas-surface-dk border border-atlas-border dark:border-atlas-border-dk p-4 mb-4">
            <p className="text-xs text-atlas-muted uppercase tracking-wide mb-2">Invariant</p>
            <p className="text-sm leading-relaxed">{data.invariant}</p>
          </div>

          <div className="rounded-2xl bg-atlas-surface dark:bg-atlas-surface-dk border border-atlas-border dark:border-atlas-border-dk p-4 mb-7">
            <p className="text-xs text-atlas-muted uppercase tracking-wide mb-2">Template</p>
            <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto">
              {data.template_code}
            </pre>
          </div>

          <h2 className="text-sm font-semibold mb-3">Progression</h2>
          {saved && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-atlas-success mb-3">
              All stages complete — marked mastered.
            </motion.p>
          )}
          <motion.div variants={list} initial="initial" animate="animate" className="space-y-2 mb-7">
            {STAGES.map((stage, i) => (
              <motion.label key={stage.key} variants={row}
                className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 flex-shrink-0">
                  <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} className="sr-only" />
                  <div className={[
                    'w-5 h-5 rounded-md border flex items-center justify-center transition-colors',
                    checked[i]
                      ? 'bg-atlas-accent dark:bg-atlas-accent-dk border-atlas-accent dark:border-atlas-accent-dk'
                      : 'border-atlas-border dark:border-atlas-border-dk group-hover:border-atlas-accent dark:group-hover:border-atlas-accent-dk',
                  ].join(' ')}>
                    {checked[i] && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l2.5 2.5L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className={['text-sm font-medium', checked[i] ? 'text-atlas-muted line-through' : ''].join(' ')}>
                    {stage.label}
                  </p>
                  <p className="text-xs text-atlas-muted mt-0.5">{stage.desc}</p>
                </div>
              </motion.label>
            ))}
          </motion.div>

          {primary.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold mb-2">Problems</h2>
              <div className="space-y-1.5">
                {primary.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-atlas-surface dark:bg-atlas-surface-dk border border-atlas-border dark:border-atlas-border-dk hover:border-atlas-accent dark:hover:border-atlas-accent-dk transition-colors group">
                    <span className="text-sm group-hover:text-atlas-accent transition-colors">LC {p.leetcode_id}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-atlas-muted">disguise {p.disguise_level}/5</span>
                      <span className={`text-xs font-medium ${DIFF[p.difficulty] ?? ''}`}>{p.difficulty}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {auxiliary.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-atlas-muted">Also appears in</h2>
              <div className="space-y-1.5">
                {auxiliary.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-atlas-border dark:border-atlas-border-dk hover:border-atlas-accent transition-colors group">
                    <span className="text-sm text-atlas-muted group-hover:text-atlas-accent transition-colors">LC {p.leetcode_id}</span>
                    <span className="text-xs text-atlas-muted capitalize">{p.composition_type}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
