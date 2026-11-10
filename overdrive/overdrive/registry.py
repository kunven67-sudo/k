"""The 5,000-point tracker (rules 93, 94, 96).

A point (area x rule) is green ONLY when:
  1. its area runs on the core (started),
  2. the rule is "real" (not guided, not a later stage), and
  3. every self-test that proves that rule passed on THIS PC in the latest run.
No guessing, no fake 100%.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .coverage_map import COVERAGE, STAGE_NAMES, STARTED_AREAS

DATA = Path(__file__).resolve().parent / "data"


@lru_cache(maxsize=1)
def blueprint() -> dict:
    return json.loads((DATA / "blueprint.json").read_text(encoding="utf-8"))


def rule_state(rule_n: int, results: dict) -> str:
    """green / red / untested / guided / later for one rule (ignoring areas)."""
    cov = COVERAGE[rule_n]
    if cov["mode"] == "later":
        return "later"
    if cov["mode"] == "guided":
        return "guided"
    outcomes = [results.get(t) for t in cov["tests"]]
    if any(o is not None and o.get("ok") is False and not o.get("skipped") for o in outcomes):
        return "red"
    if all(o is not None and o.get("ok") is True for o in outcomes):
        return "green"
    return "untested"


def grid(results: dict) -> dict:
    bp = blueprint()
    rules = []
    states = {}
    for r in bp["rules"]:
        cov = COVERAGE[r["n"]]
        st = rule_state(r["n"], results)
        states[r["n"]] = st
        rules.append({"n": r["n"], "text": r["text"], "mode": cov["mode"], "stage": cov["stage"],
                      "stage_name": STAGE_NAMES[cov["stage"]], "how": cov["how"], "tests": cov["tests"],
                      "state": st,
                      "test_results": {t: results.get(t) for t in cov["tests"]}})
    areas = []
    totals = {"green": 0, "red": 0, "untested": 0, "guided": 0, "not_started": 0}
    for a in bp["areas"]:
        started = a["n"] in STARTED_AREAS
        cells = []
        for r in bp["rules"]:
            if not started:
                cell = "off"
                totals["not_started"] += 1
            else:
                s = states[r["n"]]
                cell = s if s in ("green", "red", "untested", "guided") else "off"
                if cell == "off":
                    totals["not_started"] += 1
                else:
                    totals[cell] += 1
            cells.append(cell)
        areas.append({"n": a["n"], "name": a["name"], "subject": a["subject"], "first": a["first"], "last": a["last"],
                      "started": started, "note": STARTED_AREAS.get(a["n"], "Not built yet."),
                      "green": cells.count("green"), "red": cells.count("red"), "guided": cells.count("guided"),
                      "cells": cells})
    real = sum(1 for c in COVERAGE.values() if c["mode"] == "real")
    guided = sum(1 for c in COVERAGE.values() if c["mode"] == "guided")
    return {"total": 5000, "totals": totals, "areas": areas, "rules": rules,
            "rules_summary": {"real": real, "guided": guided, "later": 100 - real - guided,
                              "green": sum(1 for s in states.values() if s == "green"),
                              "red": sum(1 for s in states.values() if s == "red")},
            "started_areas": len(STARTED_AREAS)}
