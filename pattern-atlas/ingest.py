import csv
import json
import pathlib
import sqlite3
import sys

ROOT = pathlib.Path(__file__).parent
SCHEMA = ROOT / "schema.sql"
SEED = ROOT / "seed"
DEFAULT_DB = ROOT / "atlas.db"


def build(db_path=DEFAULT_DB):
    db_path = pathlib.Path(db_path)
    if db_path.exists():
        db_path.unlink()

    con = sqlite3.connect(db_path)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(SCHEMA.read_text())

    con.executemany(
        "INSERT INTO primitive VALUES (?,?)",
        [(1, "Contiguous"), (2, "Referenced")],
    )

    _load_patterns(con)
    _load_problems(con)
    _load_clues(con)
    _load_edges(con)

    con.execute("INSERT INTO progress SELECT id, 'unseen' FROM pattern")
    con.commit()
    con.close()
    return db_path


def _load_patterns(con):
    with open(SEED / "patterns.csv", newline="") as f:
        for row in csv.DictReader(f):
            con.execute(
                "INSERT INTO pattern VALUES (?,?,?,?,?,?,?)",
                (
                    int(row["id"]),
                    row["name"],
                    int(row["primitive_id"]),
                    row["invariant"],
                    row["template_code"].replace("|", "\n"),
                    row["complexity_signature"],
                    int(row["difficulty_tier"]),
                ),
            )


def _load_problems(con):
    with open(SEED / "problems.csv", newline="") as f:
        for row in csv.DictReader(f):
            decomp = json.dumps({"chain": row["decomposition"]})
            con.execute(
                "INSERT INTO problem VALUES (?,?,?,?,?,?)",
                (
                    int(row["id"]),
                    int(row["leetcode_id"]),
                    row["url"],
                    row["difficulty"],
                    int(row["disguise_level"]),
                    decomp,
                ),
            )


def _load_clues(con):
    with open(SEED / "clues.csv", newline="") as f:
        for row in csv.DictReader(f):
            con.execute(
                "INSERT INTO clue VALUES (?,?,?)",
                (int(row["id"]), row["text"], row["signal_type"]),
            )


def _load_edges(con):
    with open(SEED / "edges.csv", newline="") as f:
        for row in csv.DictReader(f):
            t = row["type"]
            if t == "pattern_prereq":
                con.execute(
                    "INSERT INTO pattern_prereq VALUES (?,?)",
                    (int(row["from_id"]), int(row["to_id"])),
                )
            elif t == "problem_pattern":
                con.execute(
                    "INSERT INTO problem_pattern VALUES (?,?,?,?)",
                    (
                        int(row["from_id"]),
                        int(row["to_id"]),
                        row["attr1"],
                        row["attr2"],
                    ),
                )
            elif t == "clue_pattern":
                con.execute(
                    "INSERT INTO clue_pattern VALUES (?,?,?)",
                    (int(row["from_id"]), int(row["to_id"]), float(row["attr1"])),
                )


def main():
    db_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DB
    build(db_path)
    print(f"Built {db_path}")


if __name__ == "__main__":
    main()
