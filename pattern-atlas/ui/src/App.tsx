import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Atlas from './screens/Atlas.tsx'
import PatternDetail from './screens/PatternDetail.tsx'
import Recognize from './screens/Recognize.tsx'

const panelSlide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, x: 24, transition: { duration: 0.15, ease: 'easeIn' } },
}

export default function App() {
  const [patternId,    setPatternId]    = useState<number | null>(null)
  const [showRecognize, setShowRecognize] = useState(false)
  const [flyToId,      setFlyToId]      = useState<number | null>(null)

  function handleFlyTo(id: number) {
    setShowRecognize(false)
    setFlyToId(id)
  }

  const overlayOpen = patternId !== null || showRecognize

  return (
    <div className="fixed inset-0 bg-atlas-bg dark:bg-atlas-bg-dark overflow-hidden font-sans">

      {/* Graph canvas — hidden when detail is open, dimmed when Recognize is open */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ opacity: patternId !== null ? 0 : showRecognize ? 0.35 : 1, pointerEvents: overlayOpen ? 'none' : 'auto' }}
      >
        <Atlas
          onSelectPattern={setPatternId}
          flyToPatternId={flyToId}
          onFlyToConsumed={() => setFlyToId(null)}
        />
      </div>

      {/* Floating header */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 py-4 pointer-events-none z-10">
        <button
          className="text-sm font-semibold pointer-events-auto text-atlas-text dark:text-atlas-text-dk hover:text-atlas-accent dark:hover:text-atlas-accent-dk transition-colors"
          onClick={() => { setPatternId(null); setShowRecognize(false) }}
        >
          Pattern Atlas
        </button>
        <button
          className="text-sm text-atlas-muted hover:text-atlas-accent dark:hover:text-atlas-accent-dk transition-colors pointer-events-auto"
          onClick={() => { setPatternId(null); setShowRecognize(true) }}
        >
          Recognize →
        </button>
      </div>

      {/* Dim backdrop */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setPatternId(null); setShowRecognize(false) }}
          />
        )}
      </AnimatePresence>

      {/* Pattern detail panel */}
      <AnimatePresence>
        {patternId !== null && (
          <motion.div
            key={`detail-${patternId}`}
            className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-atlas-bg dark:bg-atlas-bg-dark shadow-2xl z-30 overflow-y-auto"
            {...panelSlide}
          >
            <PatternDetail
              id={patternId}
              onClose={() => setPatternId(null)}
              onMastered={() => {
                // Force atlas to re-fetch by briefly unmounting — simplest signal
                const id = patternId
                setPatternId(null)
                setTimeout(() => setPatternId(id), 50)
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recognize panel */}
      <AnimatePresence>
        {showRecognize && (
          <motion.div
            key="recognize"
            className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-atlas-bg dark:bg-atlas-bg-dark shadow-2xl z-30 overflow-y-auto"
            {...panelSlide}
          >
            <Recognize onClose={() => setShowRecognize(false)} onFlyTo={handleFlyTo} />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
