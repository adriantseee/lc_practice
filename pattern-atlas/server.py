"""HTTP API server for Pattern Atlas: exposes patterns, prerequisite graph, next-pattern picks, clue recognition, and progress updates to the web UI."""
import http.server
import json
import pathlib
import sqlite3
import sys
import urllib.parse
from collections import deque

ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT))
import query as _q

PORT = 8765


def _db():
    return _q.open_db()


def _toposort(con):
    patterns = con.execute(
        "SELECT id FROM pattern ORDER BY id"
    ).fetchall()
    ids = [r["id"] for r in patterns]
    adj = {i: [] for i in ids}
    in_deg = {i: 0 for i in ids}
    for r in con.execute("SELECT pattern_id, prereq_id FROM pattern_prereq").fetchall():
        adj[r["prereq_id"]].append(r["pattern_id"])
        in_deg[r["pattern_id"]] += 1
    q = deque(sorted(i for i in ids if in_deg[i] == 0))
    order = []
    while q:
        node = q.popleft()
        order.append(node)
        for nb in sorted(adj[node]):
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                q.append(nb)
    return order


def api_patterns():
    con = _db()
    rows = con.execute("""
        SELECT p.id, p.name, prim.name AS primitive,
               p.invariant, p.complexity_signature, p.difficulty_tier,
               prog.status
        FROM pattern p
        JOIN primitive prim ON p.primitive_id = prim.id
        JOIN progress prog ON p.id = prog.pattern_id
    """).fetchall()
    by_id = {r["id"]: dict(r) for r in rows}

    locked_prereqs = con.execute("""
        SELECT pp.pattern_id
        FROM pattern_prereq pp
        JOIN progress prog ON pp.prereq_id = prog.pattern_id
        WHERE prog.status != 'mastered'
    """).fetchall()
    has_unmet = {r["pattern_id"] for r in locked_prereqs}

    order = _toposort(con)
    con.close()
    result = []
    for pid in order:
        p = by_id[pid]
        p["locked"] = pid in has_unmet
        result.append(p)
    return result


def api_pattern(pattern_id):
    con = _db()
    row = con.execute("""
        SELECT p.id, p.name, prim.name AS primitive,
               p.invariant, p.template_code, p.complexity_signature,
               p.difficulty_tier, prog.status
        FROM pattern p
        JOIN primitive prim ON p.primitive_id = prim.id
        JOIN progress prog ON p.id = prog.pattern_id
        WHERE p.id = ?
    """, (pattern_id,)).fetchone()
    if not row:
        con.close()
        return None
    result = dict(row)
    probs = con.execute("""
        SELECT prob.id, prob.leetcode_id, prob.url, prob.difficulty,
               prob.disguise_level, pp.role, pp.composition_type
        FROM problem prob
        JOIN problem_pattern pp ON prob.id = pp.problem_id
        WHERE pp.pattern_id = ?
        ORDER BY pp.role DESC, prob.disguise_level ASC
    """, (pattern_id,)).fetchall()
    result["problems"] = [dict(p) for p in probs]
    con.close()
    return result


def api_next():
    con = _db()
    rows = _q.next_pattern(con)
    con.close()
    return rows


def api_recognize(text):
    con = _db()
    rows = _q.recognize(con, text)
    id_map = {r["name"]: r["id"] for r in con.execute("SELECT id, name FROM pattern").fetchall()}
    enriched = [{**r, "pattern_id": id_map.get(r["pattern"])} for r in rows]
    con.close()
    return enriched


def api_graph():
    con = _db()
    primitives = [dict(r) for r in con.execute("SELECT id, name FROM primitive ORDER BY id").fetchall()]
    patterns = [dict(r) for r in con.execute("""
        SELECT p.id, p.name, p.primitive_id, p.invariant, p.complexity_signature,
               p.difficulty_tier, prog.status
        FROM pattern p
        JOIN progress prog ON p.id = prog.pattern_id
        ORDER BY p.id
    """).fetchall()]

    locked_set = {r["pattern_id"] for r in con.execute("""
        SELECT pp.pattern_id FROM pattern_prereq pp
        JOIN progress prog ON pp.prereq_id = prog.pattern_id
        WHERE prog.status != 'mastered'
    """).fetchall()}
    for p in patterns:
        p["locked"] = p["id"] in locked_set

    prereqs = [dict(r) for r in con.execute(
        "SELECT pattern_id, prereq_id FROM pattern_prereq ORDER BY pattern_id, prereq_id"
    ).fetchall()]
    con.close()
    return {"primitives": primitives, "patterns": patterns, "prereqs": prereqs}


def api_set_progress(pattern_id, status):
    con = _db()
    con.execute(
        "UPDATE progress SET status = ? WHERE pattern_id = ?",
        (status, pattern_id),
    )
    con.commit()
    con.close()


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        path = parsed.path
        try:
            if path == "/api/graph":
                self._json(api_graph())
            elif path == "/api/patterns":
                self._json(api_patterns())
            elif path == "/api/pattern":
                pid = int(qs["id"][0])
                data = api_pattern(pid)
                self._json(data) if data else self._json({"error": "not found"}, 404)
            elif path == "/api/next":
                self._json(api_next())
            elif path == "/api/recognize":
                q = qs.get("q", [""])[0]
                self._json(api_recognize(q))
            else:
                self._json({"error": "not found"}, 404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_POST(self):
        if self.path == "/api/progress":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            api_set_progress(body["pattern_id"], body["status"])
            self._json({"ok": True})
        else:
            self._json({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"API on http://localhost:{PORT}")
    http.server.HTTPServer(("", PORT), Handler).serve_forever()
