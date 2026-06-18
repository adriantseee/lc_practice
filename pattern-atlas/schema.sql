CREATE TABLE primitive (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE
);

CREATE TABLE pattern (
    id                   INTEGER PRIMARY KEY,
    name                 TEXT    NOT NULL UNIQUE,
    primitive_id         INTEGER NOT NULL REFERENCES primitive(id),
    invariant            TEXT    NOT NULL,
    template_code        TEXT    NOT NULL,
    complexity_signature TEXT    NOT NULL,
    difficulty_tier      INTEGER NOT NULL
);

CREATE TABLE problem (
    id             INTEGER PRIMARY KEY,
    leetcode_id    INTEGER NOT NULL UNIQUE,
    url            TEXT    NOT NULL,
    difficulty     TEXT    NOT NULL CHECK(difficulty IN ('Easy','Medium','Hard')),
    disguise_level INTEGER NOT NULL CHECK(disguise_level BETWEEN 1 AND 5),
    decomposition  TEXT    NOT NULL
);

CREATE TABLE clue (
    id          INTEGER PRIMARY KEY,
    text        TEXT    NOT NULL,
    signal_type TEXT    NOT NULL CHECK(signal_type IN ('linguistic','structural','constraint'))
);

CREATE TABLE pattern_prereq (
    pattern_id INTEGER NOT NULL REFERENCES pattern(id),
    prereq_id  INTEGER NOT NULL REFERENCES pattern(id),
    PRIMARY KEY (pattern_id, prereq_id)
);

CREATE TABLE problem_pattern (
    problem_id       INTEGER NOT NULL REFERENCES problem(id),
    pattern_id       INTEGER NOT NULL REFERENCES pattern(id),
    role             TEXT    NOT NULL CHECK(role IN ('primary','auxiliary')),
    composition_type TEXT    NOT NULL CHECK(composition_type IN ('sequential','nested','choice','none')),
    PRIMARY KEY (problem_id, pattern_id)
);

CREATE TABLE clue_pattern (
    clue_id    INTEGER NOT NULL REFERENCES clue(id),
    pattern_id INTEGER NOT NULL REFERENCES pattern(id),
    weight     REAL    NOT NULL,
    PRIMARY KEY (clue_id, pattern_id)
);

CREATE TABLE progress (
    pattern_id INTEGER NOT NULL PRIMARY KEY REFERENCES pattern(id),
    status     TEXT    NOT NULL DEFAULT 'unseen'
                       CHECK(status IN ('unseen','learning','mastered'))
);
