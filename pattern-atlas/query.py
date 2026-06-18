import pathlib
import sqlite3
import sys

DEFAULT_DB = pathlib.Path(__file__).parent / "atlas.db"

_NEXT_SQL = """
SELECT p.id, p.name, p.difficulty_tier,
       COALESCE(SUM(cp.weight), 0.0) AS clue_score
FROM pattern p
JOIN progress pr ON p.id = pr.pattern_id
LEFT JOIN clue_pattern cp ON cp.pattern_id = p.id
WHERE pr.status != 'mastered'
  AND NOT EXISTS (
      SELECT 1
      FROM pattern_prereq pp
      JOIN progress pr2 ON pp.prereq_id = pr2.pattern_id
      WHERE pp.pattern_id = p.id
        AND pr2.status != 'mastered'
  )
GROUP BY p.id, p.name, p.difficulty_tier
ORDER BY clue_score DESC, p.id ASC
"""


def open_db(db_path=DEFAULT_DB):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def next_pattern(con):
    return [dict(r) for r in con.execute(_NEXT_SQL).fetchall()]


def recognize(con, text):
    words = [w.strip().lower() for w in text.split() if len(w.strip()) >= 3]
    if not words:
        return []
    conditions = " OR ".join("c.text LIKE ?" for _ in words)
    params = [f"%{w}%" for w in words]
    sql = f"""
    SELECT p.name AS pattern,
           SUM(cp.weight) AS score,
           GROUP_CONCAT(DISTINCT c.text) AS matched_clues,
           MAX(CASE WHEN c.signal_type = 'constraint' THEN 1 ELSE 0 END) AS has_constraint
    FROM clue c
    JOIN clue_pattern cp ON c.id = cp.clue_id
    JOIN pattern p ON cp.pattern_id = p.id
    WHERE {conditions}
    GROUP BY p.id, p.name
    ORDER BY score DESC, pattern ASC
    """
    return [dict(r) for r in con.execute(sql, params).fetchall()]


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: query.py next | recognize <clue text>")

    cmd = sys.argv[1]
    con = open_db()

    if cmd == "next":
        rows = next_pattern(con)
        if not rows:
            print("No patterns available (all mastered or no prereqs met).")
            return
        for r in rows:
            print(f"{r['name']:<25} tier={r['difficulty_tier']}  clue_score={r['clue_score']:.2f}")

    elif cmd == "recognize":
        text = " ".join(sys.argv[2:])
        if not text:
            sys.exit("usage: query.py recognize <clue text>")
        rows = recognize(con, text)
        if not rows:
            print("No patterns matched.")
            return
        for r in rows:
            note = "  [constraint clue: verify n bounds]" if r["has_constraint"] else ""
            print(f"{r['pattern']:<25} score={r['score']:.2f}  clues: {r['matched_clues']}{note}")

    else:
        sys.exit(f"unknown command: {cmd!r}")


if __name__ == "__main__":
    main()
