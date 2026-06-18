# Pattern Atlas

## Setup

```
cd pattern-atlas
python ingest.py        # builds atlas.db from schema.sql + seed/
```

## Queries

```
python query.py next
python query.py recognize "contiguous subarray"
python query.py recognize "kth largest"
```

Mark a pattern mastered directly:

```
sqlite3 atlas.db "UPDATE progress SET status='mastered' WHERE pattern_id=(SELECT id FROM pattern WHERE name='Arrays_Strings')"
```

## Tests

```
python test_query.py
```

## UI (§12)

```
# terminal 1 — API server
python server.py

# terminal 2 — Vite dev
cd ui && npm install && npm run dev
```

Open http://localhost:5173. Three screens: **The Path**, **Pattern Detail**, **Recognize**.

Mark a pattern mastered by completing all 6 progression stages in the detail screen.
