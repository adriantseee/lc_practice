# Pattern Atlas — Design Doc

> **For Claude Code:** This is the source of truth. Read it once at session start. Do **not** re-scan the repo to rediscover decisions made here. When a decision is ambiguous, ask one batched question rather than exploring. Token-efficiency rules are in §9 and are binding.

---

## 1. One-line purpose

A graph-backed system that teaches LeetCode as **pattern recognition**, built on the principle that every data structure reduces to one of two primitives: **contiguous memory (arrays)** or **referenced memory (linked nodes)**. The primary interface is an **interactive knowledge graph** (see §12) that makes this structure visible — not a linear list.

## 2. Scope

**In scope (v1):**
- Data model for patterns, problems, clues, and their relationships.
- A seed dataset (~15 patterns, ~60 problems) so the system is usable immediately.
- A query layer answering: "what do I learn next?" and "given these clues, which pattern?"
- A minimal CLI to ingest data and run those two queries.
- A web UI over that query layer (see §12).

**Out of scope (v1):** auth, spaced-repetition scheduling, LeetCode API scraping, hosting/deploy. Note these as `// FUTURE` only; do not build.

## 3. Core model (the two primitives)

Everything roots at two primitive nodes. Every structure declares which it descends from. This is the spine — keep it explicit in the schema, not just the docs.

- **Contiguous** → dynamic array, string, hash table, heap, matrix.
- **Referenced** → linked list, tree, trie, graph (adjacency list = array of linked lists — composes both).

## 4. Schema

Graph-shaped. Use **SQLite for v1** (single file, zero setup, cheap to inspect) modeling the graph as tables. Do not pull in Neo4j in v1 — overkill, adds a daemon and setup tokens. Keep the model graph-portable so a later migration is mechanical.

**Nodes**

`Primitive(id, name)` — exactly two rows.

`Pattern(id, name, primitive_id, invariant, template_code, complexity_signature, difficulty_tier)`
- `invariant`: the loop/recursion invariant — the real abstraction (e.g. "window always satisfies condition X").
- `complexity_signature`: what it buys (e.g. "O(n²)→O(n)").

`Problem(id, leetcode_id, url, difficulty, disguise_level, decomposition)`
- `disguise_level` 1–5: how literally the pattern presents. Drives sequencing independent of LeetCode's own labels.
- `decomposition`: ordered clue→pattern chain (JSON).

`Clue(id, text, signal_type)` — `signal_type` ∈ {linguistic, structural, constraint}.

**Edges (as join tables, carrying properties)**

`pattern_prereq(pattern_id, prereq_id)` — self-referential; enables topological sequencing.

`problem_pattern(problem_id, pattern_id, role, composition_type)`
- `role` ∈ {primary, auxiliary}.
- `composition_type` ∈ {sequential, nested, choice, none}.

`clue_pattern(clue_id, pattern_id, weight)` — `weight` = Bayesian prior, **not** a guarantee. The reverse index lives here.

## 5. The clue→pattern index (seed content)

Populate `clue_pattern` from this table. Treat weights as priors; recognition = updating on multiple clues plus constraints (`n ≤ 20` → exponential OK; `n ≤ 1e5` → forbids O(n²)).

| Clue | Pattern |
|---|---|
| contiguous subarray/substring | Sliding Window |
| sorted array + pair/triplet sum | Two Pointers |
| kth largest / top k / stream median | Heap |
| next greater/smaller element | Monotonic Stack |
| number of ways / min-max cost, optimal substructure | Dynamic Programming |
| all combinations/permutations/subsets | Backtracking |
| detect cycle / find middle, no extra space | Fast & Slow Pointers |
| shortest path, unweighted grid/graph | BFS |
| islands / connected components / flood fill | DFS / Union-Find |
| search sorted X / minimize the maximum | Binary Search (incl. on answer) |
| prefix / range sum query | Prefix Sum |
| intervals / overlapping / merge | Sort + Sweep / Greedy |

## 6. Learning progression (per pattern)

Each pattern stores its problems tagged to a stage:

1. **Primitive** — underlying memory model.
2. **Template** — boilerplate + the invariant.
3. **Anchor** — literal application (e.g. Linked List Cycle for Fast & Slow).
4. **Variations** — disguised/combined (`disguise_level` ≥ 3).
5. **Anti-pattern** — looks like the pattern by its clues but isn't; forces confirmation over reflex. (e.g. "contiguous subarray" with negatives where window monotonicity breaks → needs prefix sum + hashmap.)
6. **Synthesis** — explicit composition of two mastered patterns (`composition_type` = nested/sequential).

## 7. Curriculum ordering

Topological sort over `pattern_prereq`. Default seed order:

Arrays/strings → Two Pointers → Sliding Window → Prefix Sum → Binary Search → Hashing → Stacks/Queues → Monotonic Stack → Linked Lists → Fast & Slow → Trees (DFS/BFS) → Heaps → Backtracking → Graphs → Union-Find → DP → Greedy.

DP is late by design: it's a paradigm (optimal substructure + overlapping subproblems), not a pattern, and composes with everything before it.

## 8. Query layer (the only two queries v1 must answer)

1. **Next pattern:** unmastered `Pattern`s whose prereqs are all mastered, ranked by how many of the learner's weak clues map in via `clue_pattern`. (Mastery state: a simple `progress(pattern_id, status)` table.)
2. **Recognize:** given free-text clues, return ranked patterns by summed `clue_pattern.weight`, with the constraint-check caveat surfaced in output.

## 9. Token-efficiency rules (binding for Claude Code)

These exist to minimize both tokens-per-task and number of iterations.

- **Read this doc, not the repo.** Don't `grep`/scan the whole tree to infer intent already stated here.
- **Scope file reads.** Open only the file you're editing plus its direct imports. No speculative full-directory `view`.
- **Batch questions.** If blocked, ask all open questions in one message, then proceed.
- **One source of truth per concept.** Schema lives in `schema.sql` only; don't duplicate column lists into code comments that drift.
- **Seed data as data, not code.** Put seed rows in CSV/JSON ingested by one script — cheaper to edit and review than inline literals.
- **Stop at "works + tested."** No speculative abstraction, no `// FUTURE` code, no refactors not requested. Smaller diffs = fewer review tokens.
- **Prefer SQLite + stdlib.** Avoid dependencies that require install/debug round-trips. No ORM in v1.
- **Deterministic output.** CLI prints stable, sorted results so diffs and test assertions stay small.

## 10. Suggested layout

```
pattern-atlas/
  schema.sql          # single source of truth for the model
  seed/
    patterns.csv
    problems.csv
    clues.csv
    edges.csv
  ingest.py           # builds atlas.db from schema.sql + seed/
  query.py            # the two queries from §8
  test_query.py       # asserts both queries on seed data
  README.md           # run instructions only
```

## 11. Acceptance criteria (v1 done when)

- `python ingest.py` builds `atlas.db` from `schema.sql` + `seed/`.
- `query.py next` returns a valid topological-respecting recommendation.
- `query.py recognize "contiguous subarray"` ranks Sliding Window first.
- `test_query.py` passes both queries.
- No unrequested files, deps, or `// FUTURE` code committed.

## 12. UI design

### 12.1 Feel (the target)

Borrow Duolingo's **structure**, not its loudness. Take from it: a single clear path you move along, obvious "where am I / what's next," and small satisfying feedback when you complete something. Reject from it: candy-bright saturation, mascot energy, busy screens. The end state is **calm and quietly playful** — a surface someone is happy to have open beside their editor for an hour. When "playful" and "at ease" conflict, **at ease wins**: lower the stimulation, never the clarity.

### 12.2 Visual language

- **Layout:** two modes. **Detail/Recognize views** stay calm and narrow — one column, ~720px max, generous whitespace. **The Atlas (the graph canvas)** is full-bleed and uses the whole viewport; calm here comes from muted color, soft nodes, and slow motion, not from cramping it into a column. Breathing room is still the goal — space nodes generously, don't let edges tangle.
- **Shape:** soft rounded corners (12–16px) on panels and cards; graph nodes are soft circles/rounded pills, no hard rectangles, no heavy borders. Separate with spacing and faint elevation, not lines.
- **Palette:** muted and low-saturation. One warm neutral background (off-white / warm grey, near-paper), one calm accent (sage, dusty blue, or muted teal — pick one, use sparingly for the current node + primary action only), plus success/locked states. Edges are faint. No more than ~4 colors total. Support a dark mode that is warm-dark, not pure black.
- **Typography:** one humanist sans (e.g. Inter), two sizes for body + heading, comfortable line-height (1.5+). Type does the hierarchy work, not color or weight pileups.
- **Density on the canvas:** the graph shows the whole atlas at once *by design* — but tame it. Locked/distant nodes recede (lower opacity, smaller); the current node and its immediate neighbors are emphasized. The eye should always know where "now" is.

### 12.3 Screens (v1 — exactly three)

1. **The Atlas** (home — this is a knowledge graph, NOT a linear list): a single force-directed graph canvas that renders the real graph from §3–§4. **This is the centerpiece; do not flatten it into a vertical path.** It layers two things on one canvas:
   - **Concept layer (the spine):** the two **Primitives** (contiguous / referenced) as root nodes. Data **structures** branch off their primitive (array→hash table, heap, matrix; linked list→tree, trie, graph). This makes the "everything reduces to arrays or linked lists" thesis literally visible.
   - **Prerequisite layer (the curriculum):** **pattern** nodes attached to the structure(s) they use, with directed **prerequisite edges** (`pattern_prereq`, §4) flowing between patterns. Convergence and branching are shown honestly — Two Pointers and Sliding Window both descend from arrays; DP has many parents. No fake single-file line.
   - **Visual encoding:** node type (primitive / structure / pattern) by shape or size; mastery state (done / current / locked, via §8 query 1) by fill and opacity; prerequisite edges directed (subtle arrowheads or taper), concept edges plain. A legend, quiet, in a corner.
   - **Interaction:** **fully draggable nodes with physics** — force simulation (link + charge + collision), nodes settle naturally, drag a node and the graph eases around it, release and it re-stabilizes. Pan and zoom the canvas. Click a node → Pattern detail (§12.3.2). Hovering a node gently highlights its edges and dims the rest so structure is readable. Pinning (drag-and-hold to fix a node) is a nice-to-have, not required.
2. **Pattern detail:** opens as a side panel or overlay over the dimmed canvas (don't navigate fully away — keep the graph as context). Shows the pattern's invariant + complexity signature (§4), then its six progression stages (§6) as a checklist with problem links. Marking a stage done updates `progress` and the node restyles on the canvas behind it.
3. **Recognize:** a calm single input — type clues, get ranked patterns back (§8 query 2), each with the constraint-check caveat shown plainly. Selecting a result highlights/flies to that node on the Atlas. Feels like a quiet search box, not a quiz.

### 12.4 Motion

Animation is **confirmation and continuity**, never decoration. Use Framer Motion for UI transitions; the graph's physics is its own thing (see exception).

- **Allowed:** gentle layout transitions between views (fade + 4–8px rise), a node filling/checking when a stage completes, list/panel items staggering in on first paint, smooth pan/zoom and fly-to-node on the canvas.
- **Banned (for UI chrome):** bounce/spring overshoot loud enough to read as "toy," confetti, looping ambient motion in peripheral vision, parallax, UI transitions over ~300ms.
- **Graph-physics exception:** the force simulation on The Atlas is allowed to run continuously while the user is interacting (dragging, after a click) and must then **settle to rest** — it does not loop forever once stable. Keep forces gentle (low velocity, generous damping) so motion reads as calm drifting-into-place, not jitter. When idle and settled, the graph is still. This satisfies the "no perpetual peripheral motion" intent.
- **Timing:** UI transitions 150–250ms, ease-out. **Honor `prefers-reduced-motion`** — UI transitions become instant, and the graph renders in its pre-computed settled layout with physics/drag-animation disabled (dragging snaps rather than springs).
- One-line test for any animation: *does it make the app calmer to use, or just busier?* If busier, cut it.

### 12.5 Stack & honest cost

**Stack (required, not optional):** Vite + React + **TypeScript (`.tsx`)** + Tailwind CSS + Framer Motion, plus a **force-graph / physics library** for The Atlas — use `d3-force` (with React for rendering) or `react-force-graph`; do not hand-roll a physics engine. All components are `.tsx`; no plain `.jsx`, no untyped JS. **This is a deliberate exception to §9's "prefer stdlib, avoid install round-trips."** A daily-use, motion-rich, graph-based UI justifies the dependencies and build step; the §9 spirit (small diffs, scoped reads, no speculative abstraction) still holds inside the frontend. Keep it a static SPA that reads from the existing `atlas.db` via a thin read-only JSON endpoint or a pre-exported JSON build artifact — the graph nodes/edges come straight from the §4 tables (`Primitive`, `Pattern`, structures, `pattern_prereq`). **No new backend framework, no auth, no server state** beyond serving data. Do not let the UI duplicate query logic: the §8 queries stay the source of truth, the UI calls them.

### 12.6 UI acceptance criteria

- The home view is **The Atlas: a force-directed knowledge graph, not a vertical list or single-column path.** A linear-list home view fails acceptance.
- The Atlas shows **both layers on one canvas**: the concept spine (2 primitives → structures → patterns) AND directed prerequisite edges between patterns, with branching/convergence visible.
- Nodes are **draggable with physics**; the simulation settles to rest when idle; canvas pans and zooms.
- Node styling reflects real `progress` state (locked / current / done) from §8 query 1; clicking a node opens Pattern detail over the dimmed graph.
- Recognize returns the same ranking as the CLI for the same input (no divergent logic) and can highlight/fly-to the matching node.
- `prefers-reduced-motion` disables UI transitions and graph physics (settled layout, snap-drag).
- No color outside the ~4-color palette; no UI transition over 300ms; no new backend framework.
- Built with Vite + React + TypeScript (`.tsx`) + Tailwind + Framer Motion + a force-graph library (`d3-force` / `react-force-graph`); no `.jsx` or untyped JS files.
