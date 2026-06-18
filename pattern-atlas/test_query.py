import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import ingest
import query


def _fresh_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    ingest.build(path)
    return path


def test_next_initial():
    db = _fresh_db()
    try:
        con = query.open_db(db)
        rows = query.next_pattern(con)
        names = {r["name"] for r in rows}
        assert "Arrays_Strings" in names, f"Arrays_Strings missing from initial next: {names}"
        assert "Linked_Lists" in names, f"Linked_Lists missing from initial next: {names}"
        con.close()
    finally:
        os.unlink(db)


def test_next_respects_prereqs():
    db = _fresh_db()
    try:
        con = query.open_db(db)
        # Two_Pointers requires Arrays_Strings — should not appear yet
        rows = query.next_pattern(con)
        names = {r["name"] for r in rows}
        assert "Two_Pointers" not in names, "Two_Pointers should not appear before Arrays_Strings is mastered"

        # Master Arrays_Strings
        con.execute(
            "UPDATE progress SET status='mastered' WHERE pattern_id="
            "(SELECT id FROM pattern WHERE name='Arrays_Strings')"
        )
        con.commit()
        rows = query.next_pattern(con)
        names = {r["name"] for r in rows}
        assert "Two_Pointers" in names, f"Two_Pointers should appear after mastering Arrays_Strings: {names}"
        con.close()
    finally:
        os.unlink(db)


def test_recognize_sliding_window_first():
    db = _fresh_db()
    try:
        con = query.open_db(db)
        rows = query.recognize(con, "contiguous subarray")
        assert rows, "recognize returned no results for 'contiguous subarray'"
        assert rows[0]["pattern"] == "Sliding_Window", (
            f"Expected Sliding_Window first, got {rows[0]['pattern']} "
            f"(scores: {[(r['pattern'], r['score']) for r in rows]})"
        )
        con.close()
    finally:
        os.unlink(db)


def test_recognize_heap_for_kth():
    db = _fresh_db()
    try:
        con = query.open_db(db)
        rows = query.recognize(con, "kth largest")
        assert rows, "recognize returned no results for 'kth largest'"
        assert rows[0]["pattern"] == "Heaps", (
            f"Expected Heaps first for 'kth largest', got {rows[0]['pattern']}"
        )
        con.close()
    finally:
        os.unlink(db)


if __name__ == "__main__":
    test_next_initial()
    test_next_respects_prereqs()
    test_recognize_sliding_window_first()
    test_recognize_heap_for_kth()
    print("All tests passed.")
