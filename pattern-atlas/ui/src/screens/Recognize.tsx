import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { fetchRecognize } from '../api.ts'
import type { RecognizeResult } from '../api.ts'

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const list = { animate: { transition: { staggerChildren: 0.04 } } }
const row  = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}

interface Props {
  onClose: () => void
  onFlyTo: (patternId: number) => void
}

export default function Recognize({ onClose, onFlyTo }: Props) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<RecognizeResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const debounced = useDebounce(query, 300)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debounced.trim().length < 3) { setResults([]); return }
    setLoading(true)
    fetchRecognize(debounced)
      .then(rows => { setResults(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [debounced])

  const maxScore = results[0]?.score ?? 1

  return (
    <div className="px-6 py-6">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-atlas-muted hover:text-atlas-text dark:hover:text-atlas-text-dk transition-colors mb-6"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Close
      </button>

      <div className="mb-7">
        <h1 className="text-xl font-semibold mb-1">Recognize</h1>
        <p className="text-sm text-atlas-muted">
          Describe what you see — patterns surface by likelihood.
        </p>
      </div>

      <div className="relative mb-6">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="contiguous subarray, kth largest, detect cycle…"
          className="w-full px-4 py-3 rounded-2xl bg-atlas-surface dark:bg-atlas-surface-dk border border-atlas-border dark:border-atlas-border-dk focus:outline-none focus:border-atlas-accent dark:focus:border-atlas-accent-dk text-sm placeholder:text-atlas-muted transition-colors"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 rounded-full border-2 border-atlas-accent/40 border-t-atlas-accent animate-spin" />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div
            key={debounced}
            variants={list}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="space-y-2"
          >
            {results.map((r, i) => {
              const pct = maxScore > 0 ? (r.score / maxScore) * 100 : 0
              return (
                <motion.div key={r.pattern} variants={row}
                  className="rounded-2xl bg-atlas-surface dark:bg-atlas-surface-dk border border-atlas-border dark:border-atlas-border-dk p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className={['text-sm font-medium', i === 0 ? 'text-atlas-accent dark:text-atlas-accent-dk' : ''].join(' ')}>
                      {r.pattern.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-atlas-muted tabular-nums">{r.score.toFixed(2)}</span>
                      {r.pattern_id !== null && (
                        <button
                          onClick={() => r.pattern_id !== null && onFlyTo(r.pattern_id)}
                          className="text-xs text-atlas-accent dark:text-atlas-accent-dk hover:underline"
                        >
                          Show on atlas
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="h-1 rounded-full bg-atlas-border dark:bg-atlas-border-dk overflow-hidden mb-2.5">
                    <motion.div
                      className="h-full rounded-full bg-atlas-accent dark:bg-atlas-accent-dk"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    />
                  </div>

                  <p className="text-xs text-atlas-muted leading-relaxed">{r.matched_clues}</p>

                  {r.has_constraint === 1 && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Constraint clue matched — verify n bounds before committing.
                    </p>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
        {!loading && debounced.trim().length >= 3 && results.length === 0 && (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-sm text-atlas-muted">
            No patterns matched.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
