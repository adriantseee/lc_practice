import {
  useCallback, useEffect, useReducer, useRef, useState,
} from 'react'
import {
  forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation,
} from 'd3-force'
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { useReducedMotion } from 'framer-motion'
import { fetchGraph } from '../api.ts'
import type { GraphData } from '../api.ts'

// ─── types ────────────────────────────────────────────────────────────────────

type NodeKind = 'primitive' | 'structure' | 'pattern'

interface GNode extends SimulationNodeDatum {
  id: string
  kind: NodeKind
  label: string
  patternId?: number
  status?: string
  locked?: boolean
}

interface GLink extends SimulationLinkDatum<GNode> {
  edge: 'concept' | 'prereq'
}

// ─── constants ────────────────────────────────────────────────────────────────

const R: Record<NodeKind, number> = { primitive: 28, structure: 18, pattern: 13 }

const STRUCTURES = [
  { id: 'struct-array', label: 'Array/String',  primId: 1, pats: [1,2,3,4,5,16,17,18] },
  { id: 'struct-hash',  label: 'Hash Table',    primId: 1, pats: [6] },
  { id: 'struct-stack', label: 'Stack/Queue',   primId: 1, pats: [7,8] },
  { id: 'struct-heap',  label: 'Heap',          primId: 1, pats: [13] },
  { id: 'struct-ll',    label: 'Linked List',   primId: 2, pats: [9,10] },
  { id: 'struct-tree',  label: 'Tree',          primId: 2, pats: [11,12,14] },
  { id: 'struct-graph', label: 'Graph',         primId: 2, pats: [15] },
] as const

// colours (light)
const C = {
  primitive: '#8C7B6B',
  structure:  '#D4CFC9',
  mastered:   '#5E8C6A',
  available:  '#5B7FA8',
  locked:     '#C8C3BD',
  edgeConcept: 'rgba(176,170,162,0.38)',
  edgePrereq:  'rgba(91,127,168,0.40)',
  edgeDim:     'rgba(176,170,162,0.08)',
  edgeHover:   'rgba(91,127,168,0.80)',
  label:       '#4A4845',
  labelLocked: '#B0ABA6',
}

// ─── graph builder ────────────────────────────────────────────────────────────

function buildGraph(data: GraphData): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = []
  const links: GLink[] = []

  data.primitives.forEach(p => {
    nodes.push({ id: `prim-${p.id}`, kind: 'primitive', label: p.name })
  })

  STRUCTURES.forEach(s => {
    nodes.push({ id: s.id, kind: 'structure', label: s.label })
    links.push({ source: `prim-${s.primId}`, target: s.id, edge: 'concept' })
  })

  data.patterns.forEach(p => {
    const struct = STRUCTURES.find(s => (s.pats as readonly number[]).includes(p.id))
    nodes.push({
      id: `pat-${p.id}`,
      kind: 'pattern',
      label: p.name.replace(/_/g, ' '),
      patternId: p.id,
      status: p.status,
      locked: p.locked,
    })
    if (struct) links.push({ source: struct.id, target: `pat-${p.id}`, edge: 'concept' })
  })

  data.prereqs.forEach(r => {
    links.push({
      source: `pat-${r.prereq_id}`,
      target: `pat-${r.pattern_id}`,
      edge: 'prereq',
    })
  })

  return { nodes, links }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function nodeColor(n: GNode): string {
  if (n.kind === 'primitive') return C.primitive
  if (n.kind === 'structure') return C.structure
  if (n.status === 'mastered') return C.mastered
  if (n.locked) return C.locked
  return C.available
}

function nodeOpacity(n: GNode): number {
  return n.kind === 'pattern' && n.locked ? 0.45 : 1
}

function offsetEndpoints(
  x1: number, y1: number, x2: number, y2: number, r1: number, r2: number
) {
  const dx = x2 - x1, dy = y2 - y1
  const d = Math.sqrt(dx * dx + dy * dy) || 1
  return {
    x1: x1 + (dx / d) * r1, y1: y1 + (dy / d) * r1,
    x2: x2 - (dx / d) * r2, y2: y2 - (dy / d) * r2,
  }
}

// ─── component ────────────────────────────────────────────────────────────────

interface AtlasProps {
  onSelectPattern: (id: number) => void
  flyToPatternId: number | null
  onFlyToConsumed: () => void
}

export default function Atlas({ onSelectPattern, flyToPatternId, onFlyToConsumed }: AtlasProps) {
  const svgRef    = useRef<SVGSVGElement>(null)
  const nodesRef  = useRef<GNode[]>([])
  const linksRef  = useRef<GLink[]>([])
  const simRef    = useRef<Simulation<GNode, GLink> | null>(null)
  const reduced   = useReducedMotion()

  const [, tick]     = useReducer(x => x + 1, 0)
  const [tx, setTx]  = useState(0)
  const [ty, setTy]  = useState(0)
  const [tk, setTk]  = useState(1)
  const [hovered, setHovered] = useState<string | null>(null)

  // drag state — node drag
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null)
  // pan state
  const panRef  = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  // ── load data + start sim ──────────────────────────────────────────────────

  useEffect(() => {
    let alive = true
    fetchGraph().then(data => {
      if (!alive) return
      const { nodes, links } = buildGraph(data)
      nodesRef.current = nodes
      linksRef.current = links

      const svg = svgRef.current
      if (svg) {
        const { width, height } = svg.getBoundingClientRect()
        setTx(width / 2); setTy(height / 2)
      }

      const sim = forceSimulation<GNode>(nodes)
        .force('link',    forceLink<GNode, GLink>(links).id(d => d.id).distance(l =>
          (l as GLink).edge === 'prereq' ? 110 : 85
        ))
        .force('charge',  forceManyBody<GNode>().strength(n =>
          n.kind === 'primitive' ? -500 : -220
        ))
        .force('collide', forceCollide<GNode>(n => R[n.kind] + 10))
        .force('center',  forceCenter(0, 0))
        .alphaDecay(0.025)
        .velocityDecay(0.45)

      if (reduced) {
        sim.stop().tick(400)
        tick()
      } else {
        sim.on('tick', () => tick())
      }

      simRef.current = sim
    }).catch(console.error)

    return () => { alive = false; simRef.current?.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── fly-to ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (flyToPatternId === null) return
    const node = nodesRef.current.find(n => n.patternId === flyToPatternId)
    if (!node?.x || !node?.y || !svgRef.current) { onFlyToConsumed(); return }

    const { width, height } = svgRef.current.getBoundingClientRect()
    const k = 1.6
    const targetX = width / 2 - node.x * k
    const targetY = height / 2 - node.y * k

    if (reduced) {
      setTx(targetX); setTy(targetY); setTk(k)
      onFlyToConsumed()
      return
    }

    const start = performance.now()
    const fromX = tx, fromY = ty, fromK = tk

    function step(now: number) {
      const t = Math.min((now - start) / 500, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setTx(fromX + (targetX - fromX) * e)
      setTy(fromY + (targetY - fromY) * e)
      setTk(fromK + (k - fromK) * e)
      if (t < 1) requestAnimationFrame(step)
      else onFlyToConsumed()
    }
    requestAnimationFrame(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToPatternId])

  // ── interaction ───────────────────────────────────────────────────────────

  const toSVGCoords = useCallback((cx: number, cy: number) => {
    return { x: (cx - tx) / tk, y: (cy - ty) / tk }
  }, [tx, ty, tk])

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const el = e.target as SVGElement
    const nodeId = el.dataset?.nid
    if (nodeId) {
      const { x, y } = toSVGCoords(e.clientX, e.clientY)
      dragRef.current = { id: nodeId, ox: x, oy: y }
      simRef.current?.alphaTarget(reduced ? 0 : 0.3).restart()
      return
    }
    panRef.current = { x: e.clientX, y: e.clientY, tx, ty }
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (dragRef.current) {
      const { x, y } = toSVGCoords(e.clientX, e.clientY)
      const node = nodesRef.current.find(n => n.id === dragRef.current!.id)
      if (node) { node.fx = x; node.fy = y }
      if (!reduced) tick()
      return
    }
    if (panRef.current) {
      setTx(panRef.current.tx + (e.clientX - panRef.current.x))
      setTy(panRef.current.ty + (e.clientY - panRef.current.y))
    }
  }

  function onMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (dragRef.current) {
      const dist = Math.hypot(
        e.clientX - (dragRef.current.ox * tk + tx),
        e.clientY - (dragRef.current.oy * tk + ty)
      )
      if (dist < 6) {
        const node = nodesRef.current.find(n => n.id === dragRef.current!.id)
        if (node?.patternId !== undefined) onSelectPattern(node.patternId)
      }
      const node = nodesRef.current.find(n => n.id === dragRef.current!.id)
      if (node && !reduced) { node.fx = null; node.fy = null }
      simRef.current?.alphaTarget(0)
      dragRef.current = null
      return
    }
    panRef.current = null
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.111
    const newK   = Math.max(0.2, Math.min(4, tk * factor))
    setTx(e.clientX - (e.clientX - tx) * (newK / tk))
    setTy(e.clientY - (e.clientY - ty) * (newK / tk))
    setTk(newK)
  }

  // ── render ────────────────────────────────────────────────────────────────

  const nodes = nodesRef.current
  const links = linksRef.current

  // Set of node IDs connected to hovered node
  const connectedIds = new Set<string>()
  if (hovered) {
    connectedIds.add(hovered)
    links.forEach(l => {
      const s = (l.source as GNode).id
      const t = (l.target as GNode).id
      if (s === hovered || t === hovered) { connectedIds.add(s); connectedIds.add(t) }
    })
  }

  return (
    <svg
      ref={svgRef}
      className="w-full h-full select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      style={{ cursor: dragRef.current ? 'grabbing' : panRef.current ? 'grabbing' : 'default' }}
    >
      <defs>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill={C.edgePrereq} />
        </marker>
        <marker id="arrow-h" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill={C.edgeHover} />
        </marker>
      </defs>

      <g transform={`translate(${tx},${ty}) scale(${tk})`}>

        {/* edges */}
        {links.map((l, i) => {
          const s = l.source as GNode
          const t = l.target as GNode
          if (!s.x || !t.x) return null
          const { x1, y1, x2, y2 } = offsetEndpoints(
            s.x, s.y ?? 0, t.x, t.y ?? 0, R[s.kind] + 2, R[t.kind] + 2
          )
          const isHovered = hovered && (connectedIds.has(s.id) && connectedIds.has(t.id))
          const isDim = hovered && !isHovered

          const stroke = isDim
            ? C.edgeDim
            : isHovered
              ? C.edgeHover
              : l.edge === 'prereq' ? C.edgePrereq : C.edgeConcept

          const markerEnd = l.edge === 'prereq'
            ? (isHovered ? 'url(#arrow-h)' : 'url(#arrow)')
            : undefined

          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={stroke}
              strokeWidth={l.edge === 'prereq' ? 1.2 : 0.9}
              markerEnd={markerEnd}
              style={{ transition: reduced ? 'none' : 'stroke 0.15s' }}
            />
          )
        })}

        {/* nodes */}
        {nodes.map(n => {
          if (n.x === undefined) return null
          const r    = R[n.kind]
          const fill = nodeColor(n)
          const op   = nodeOpacity(n)
          const dim  = hovered && !connectedIds.has(n.id)

          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y ?? 0})`}
              opacity={dim ? 0.25 : op}
              style={{ transition: reduced ? 'none' : 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <circle
                r={r}
                fill={n.kind === 'structure' ? 'none' : fill}
                stroke={n.kind === 'structure' ? fill : 'none'}
                strokeWidth={n.kind === 'structure' ? 1.5 : 0}
                data-nid={n.id}
                style={{ cursor: n.patternId !== undefined ? 'pointer' : 'grab' }}
              />
              {/* click target sized for pointer accuracy */}
              <circle r={r + 4} fill="transparent" data-nid={n.id} />

              {/* mastery ring on available pattern nodes */}
              {n.kind === 'pattern' && !n.locked && n.status !== 'mastered' && (
                <circle r={r + 4} fill="none" stroke={C.available} strokeWidth={1.5} opacity={0.3} />
              )}

              <text
                y={r + 11}
                textAnchor="middle"
                fontSize={n.kind === 'primitive' ? 10 : 9}
                fontWeight={n.kind === 'primitive' ? 600 : 400}
                fill={n.locked ? C.labelLocked : C.label}
                pointerEvents="none"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {n.label}
              </text>
            </g>
          )
        })}
      </g>

      {/* legend */}
      <g transform="translate(16, calc(100% - 80))" style={{ transform: 'translate(16px, calc(100% - 80px))' }}>
        {[
          { fill: C.primitive,  label: 'Primitive' },
          { fill: 'none', stroke: C.structure, label: 'Structure' },
          { fill: C.mastered,   label: 'Mastered' },
          { fill: C.available,  label: 'Available' },
          { fill: C.locked,     label: 'Locked', op: 0.5 },
        ].map((item, i) => (
          <g key={item.label} transform={`translate(0,${i * 16})`}>
            <circle
              r={5}
              fill={item.fill}
              stroke={item.stroke ?? 'none'}
              strokeWidth={item.stroke ? 1.5 : 0}
              opacity={item.op ?? 1}
            />
            <text x={12} y={4} fontSize={9} fill={C.labelLocked}
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              {item.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
