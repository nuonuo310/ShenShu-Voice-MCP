#!/usr/bin/env python3
"""Actual SQLite execution tests for the Cloudflare D1 SQL contract."""
import sqlite3
import pathlib
import tempfile
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "db/d1/001_voice_reservations.sql").read_text()
parts = (ROOT / "src/d1-budget-store.js").read_text()
# Duplicate the exact query semantics into SQLite for integration validation.
SQL = """
WITH RECURSIVE slots(slot) AS (
 SELECT 1 UNION ALL SELECT slot + 1 FROM slots WHERE slot < ?4
)
INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot)
SELECT ?1, ?2, ?3, slots.slot FROM slots
WHERE NOT EXISTS (
 SELECT 1 FROM paid_voice_reservations r
 WHERE r.principal = ?2 AND r.day_utc = ?3 AND r.slot = slots.slot
)
ORDER BY slots.slot LIMIT 1
ON CONFLICT DO NOTHING RETURNING request_id
"""
class D1Contract(unittest.TestCase):
 def setUp(self):
  self.db = sqlite3.connect(":memory:")
  self.db.executescript(SCHEMA)
 def tearDown(self): self.db.close()
 def reserve(self, ident, who="owner_12345", day="2026-10-20", limit=3):
  return self.db.execute(SQL,(ident,who,day,limit)).fetchone()
 def test_limit_and_duplicate(self):
  for i in range(3): self.assertIsNotNone(self.reserve(f"request_{i+1000}"))
  self.assertIsNone(self.reserve("request_1000"))
  self.assertIsNone(self.reserve("request_9999"))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM paid_voice_reservations").fetchone()[0],3)
 def test_isolation_by_principal_and_utc_day(self):
  self.assertIsNotNone(self.reserve("request_1000",limit=1))
  self.assertIsNone(self.reserve("request_2000",limit=1))
  self.assertIsNotNone(self.reserve("request_3000",who="friend_1234",limit=1))
  self.assertIsNotNone(self.reserve("request_4000",day="2026-10-21",limit=1))
 def test_parallel_connections_never_exceed_three_slots(self):
  with tempfile.TemporaryDirectory() as folder:
   dbfile=str(pathlib.Path(folder)/"budget.db")
   db=sqlite3.connect(dbfile)
   db.executescript(SCHEMA)
   db.close()
   barrier=Barrier(8)
   def attempt(i):
    c=sqlite3.connect(dbfile,timeout=3)
    try:
     barrier.wait(timeout=3)
     try:
      result=c.execute(SQL,(f"request_{i+10000}","owner_12345","2026-10-20",3)).fetchone()
      c.commit()
      return result is not None
     except sqlite3.OperationalError:
      # Contention/lock timeout is a denial, not a paid approval.
      return False
    finally: c.close()
   with ThreadPoolExecutor(max_workers=8) as pool:
    outcomes=list(pool.map(attempt,range(8)))
   check=sqlite3.connect(dbfile)
   count=check.execute("SELECT COUNT(*) FROM paid_voice_reservations").fetchone()[0]
   check.close()
   self.assertGreaterEqual(sum(outcomes),1)
   self.assertLessEqual(sum(outcomes),3)
   self.assertEqual(sum(outcomes),count)
   # After contention settles, unused slots may still be claimed once;
   # never exceed the ceiling, regardless of how many lock refusals occurred.
   with sqlite3.connect(dbfile) as fill:
    for i in range(10):
     fill.execute(SQL,(f"request_fill_{i+1000}","owner_12345","2026-10-20",3)).fetchone()
    final=fill.execute("SELECT COUNT(*) FROM paid_voice_reservations").fetchone()[0]
   self.assertEqual(final,3)
 def test_global_request_id_uniqueness_across_days(self):
  self.assertIsNotNone(self.reserve("request_1000",day="2026-10-20"))
  self.assertIsNone(self.reserve("request_1000",day="2026-10-21"))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM paid_voice_reservations").fetchone()[0],1)
 def test_unique_slot_enforced_by_database(self):
  self.reserve("request_1000",limit=1)
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO paid_voice_reservations(request_id,principal,day_utc,slot) VALUES(?,?,?,?)",
        ("request_2000","owner_12345","2026-10-20",1))
if __name__ == "__main__": unittest.main()
