"""How each of the blueprint's 100 rules is handled, and which test proves it.

mode "real"   = built in code + proven by the listed self-test(s)
mode "guided" = Claude is told + the checker looks, but code can't fully prove it (never counted green)
mode "later"  = belongs to a later stage (the stage number says which)
"""
from __future__ import annotations

STAGE_NAMES = {
    1: "Core (engine + safety)",
    2: "Memory",
    3: "PC control + sandbox",
    4: "Planning + task execution",
    5: "Research + browsing + documents",
    6: "Agent teams",
    7: "Images, audio, video",
    8: "Curiosity + scheduled work",
    9: "Identity + personality",
    10: "Benchmarks",
}


def _r(how, *tests):
    return {"stage": 1, "mode": "real", "how": how, "tests": list(tests)}


def _g(how, *tests):
    return {"stage": 1, "mode": "guided", "how": how, "tests": list(tests)}


def _l(stage, how=""):
    return {"stage": stage, "mode": "later", "how": how or f"Stage {stage}: {STAGE_NAMES[stage]}", "tests": []}


COVERAGE: dict[int, dict] = {
    1: _r("Every task must start with task_plan (goal + success criteria); other tools are blocked until then.",
          "test_plan_required_before_tools", "test_checker_rules"),
    2: _l(4, "Stage 4: splitting big jobs into testable sub-tasks"),
    3: _r("The plan lists the tools/permissions it needs; the gate checks each tool against your policy.",
          "test_plan_required_before_tools", "test_permission_decisions"),
    4: _l(4, "Stage 4: time/compute estimates before starting"),
    5: _g("The report keeps 'verified', 'assumptions' and 'unknowns' apart.", "test_checker_rules"),
    6: _g("The report must give a confidence level (high/medium/low).", "test_checker_rules"),
    7: _l(4), 8: _l(4), 9: _l(4), 10: _l(4), 11: _l(4), 12: _l(4), 13: _l(4),
    14: _r("Claude can ask you a question (Yes/No and choice cards in the window) before acting.",
           "test_e2e_question_card"),
    15: _r("The checker compares the report with the journal + your files; a fresh Claude double-checks file changes.",
           "test_checker_rules", "test_e2e_write_task_done"),
    16: _r("Every change is listed on the task and re-checked on disk.", "test_checker_verifies_changes_on_disk"),
    17: _r("Before a file is replaced, the old copy is saved.", "test_replace_keeps_old_copy"),
    18: _r("Each task's outcome (and optional lessons) is saved as a task record.", "test_task_record_saved"),
    19: _r("Task records keep request, model, settings, Claude Code version and every tool call.",
           "test_task_record_saved", "test_e2e_write_task_done"),
    20: _r("Each task ends with a short summary and a clear status line.", "test_checker_rules"),
    21: _r("Append-only audit log with a hash chain; tampering is detected.", "test_audit_chain_and_tamper"),
    22: _l(5), 23: _l(5), 24: _l(5), 25: _l(5),
    26: _g("Observation vs inference vs guess: the report separates them.", "test_checker_rules"),
    27: _g("The checker flags claims about files that don't exist and goals marked met without proof.",
           "test_checker_rules"),
    28: _g("Claude is told never to invent details.", "test_system_prompt_static"),
    29: _r("Refused tools can't be bypassed: no permission slip = the tool refuses to run; Claude is told to ask.",
           "test_grants_one_time", "test_e2e_approval_no"),
    30: _g("Claude is told to respect copyright, licenses and terms.", "test_system_prompt_static"),
    31: _r("Secrets are blanked in logs; API-key variables are removed so runs stay on your plan.",
           "test_redact_secrets", "test_env_api_vars_removed"),
    32: _r("Only OVERDRIVE's own tools exist; file tools are locked to the workspace folder.",
           "test_workspace_blocks_escape", "test_permission_decisions", "test_e2e_only_overdrive_tools"),
    33: _r("Change/replace/delete is locked to ask-or-block.", "test_permission_decisions", "test_e2e_destructive_asks"),
    34: _r("Sending anything off your PC is locked to ask-or-block.", "test_permission_decisions"),
    35: _r("Spending money is locked to ask-or-block (block by default).", "test_permission_decisions"),
    36: _l(3, "Stage 3: sandbox for running code"),
    37: _r("Inputs are checked against each tool's schema before it runs.", "test_invalid_input_rejected"),
    38: _r("Saves are atomic; broken files are moved aside, never overwritten.", "test_atomic_write_and_broken_json"),
    39: _r("Retries are bounded (file locks: 4 tries; Claude Code: its own capped retries, shown live).",
           "test_retry_bounded", "test_e2e_api_retry"),
    40: _r("An action that already succeeded in a task is not done again.", "test_journal_duplicates_and_loops"),
    41: _r("Duplicates and loops are detected (same refused call 3x = stopped; identical save = no-op).",
           "test_journal_duplicates_and_loops", "test_identical_replace_is_noop"),
    42: _r("The audit log never stores secrets.", "test_audit_redacts"),
    43: _r("Export: one zip of plain JSON/JSONL with a README of the format.", "test_export_zip"),
    44: _r("Memory backup writes a sha256 per row + an overall sha256; restore refuses a tampered file.",
          "test_memory_backup_and_restore_verify", "test_memory_backup_tamper_rejected"),
    45: _r("Your files, OVERDRIVE's records, old versions and experiments live in separate folders.",
           "test_paths_separate"),
    46: _r("Caps: steps per task, minutes per task, usage per task/day, pause at your Claude usage %.",
           "test_usage_caps", "test_e2e_step_limit", "test_e2e_time_limit"),
    47: _r("Blocked tasks always say why (limit hit, not signed in, refused...).", "test_checker_rules",
           "test_cli_missing_fallback"),
    48: _r("When something is unavailable, OVERDRIVE says what still works (e.g. local tools offline).",
           "test_cli_missing_fallback", "test_offline_tools"),
    49: _l(3, "Stage 3: test changes before replacing a working version"),
    50: _r("Undo puts back every change a task made (never deletes: moves into versions).", "test_undo_restores"),
    51: _r("SETUP.md lists every dependency and setup step.", "test_docs_present"),
    52: _r("Tasks record time-to-first-word, total time and each tool's time.", "test_e2e_write_task_done"),
    53: _r("Self-tests: repeatable, runnable from the window on your PC.", "test_selftest_regressions"),
    54: _l(10, "Stage 10: compare against a saved baseline"),
    55: _r("Self-test results are compared with the last run; new failures are flagged as regressions.",
           "test_selftest_regressions"),
    56: _r("Status shows versions: OVERDRIVE, Python, Windows, Claude Code, SDK.", "test_compat_info"),
    57: _r("Memory is organized into 5 kinds (fact/experience/instruction/project/relationship) + tags + "
          "related ids, and indexed with FTS5 so OVERDRIVE can search it.", "test_memory_kinds_and_search"),
    58: _r("Recall returns only rows that match the query within the chosen kinds, at a bounded limit.",
          "test_memory_recall_matches", "test_memory_recall_limit_and_kind_filter"),
    59: _r("memory_update supersedes the stale row with a new active row; the old row is kept with "
          "status=superseded and superseded_by pointing at the new id.", "test_memory_update_keeps_history"),
    60: _r("Every row carries provenance + created + updated timestamps; nothing is written without them.",
          "test_memory_row_has_provenance_and_dates"),
    61: _r("Writing a new row with the same kind + title as an active one surfaces the clash to the human "
          "instead of silently overwriting.", "test_memory_contradiction_surfaces"),
    62: _r("The human can list, search and patch any row through memory_list / memory_recall / memory_update.",
          "test_memory_list_ordering", "test_memory_update_keeps_history"),
    63: _r("memory.forget() permanently removes a row (human-only path via the UI; Claude's tools can only "
          "archive, which keeps the row).", "test_memory_forget_actually_deletes"),
    64: _r("File text reaches Claude inside an untrusted-data box with a random id.", "test_shield_wraps_untrusted",
           "test_e2e_injection_in_file"),
    65: _r("Order-like text in files is detected and flagged to you.", "test_shield_flags_injection",
           "test_e2e_injection_in_file"),
    66: _r("Tool output never goes into OVERDRIVE's instructions (fixed system prompt).", "test_system_prompt_static",
           "test_shield_wraps_untrusted"),
    67: _l(6), 68: _l(6), 69: _l(6), 70: _l(6), 71: _l(6),
    72: _r("Each task records the exact model, Claude Code version and tools that produced it.",
           "test_e2e_write_task_done"),
    73: _g("Claude is told to check with tools instead of guessing.", "test_system_prompt_static"),
    74: _l(6), 75: _l(6),
    76: _r("Re-reading an unchanged file inside a task reuses the earlier result.", "test_read_cache"),
    77: _r("No Stage 1 tool uses the internet; Claude Code's extra traffic is switched off.",
           "test_no_network_tools_stage1"),
    78: _r("Offline: the window, logs, status and local tools still work without Claude.", "test_offline_tools"),
    79: _r("Network use is logged, and a Network switch in Settings turns Claude off.", "test_e2e_network_off"),
    80: _r("Claude's usage limits are tracked; OVERDRIVE pauses before you hit them.", "test_usage_caps"),
    81: _l(8), 82: _r("STOP ends the task right away and closes open cards.", "test_e2e_stop",
                      "test_e2e_stop_during_card"),
    83: _l(4, "Stage 4: resume from checkpoints"),
    84: _r("Cards (approvals/questions) pop up live and flash the window title.", "test_events_and_cards",
           "test_e2e_question_card"),
    85: _g("Claude is told not to claim feelings; the checker flags it.", "test_checker_rules"),
    86: _l(9), 87: _l(9), 88: _l(9),
    89: _g("Claude replies in the language you write in.", "test_system_prompt_static"),
    90: _g("Settings: explanation detail simple / normal / deep.", "test_system_prompt_static"),
    91: _r("'create' never overwrites; replacing needs your Yes.", "test_create_never_overwrites",
           "test_e2e_destructive_asks"),
    92: _r("Replacing saves the old version first.", "test_replace_keeps_old_copy"),
    93: _r("Every tool must have a self-test, and each one can be run on its own.", "test_tool_registry_rules"),
    94: _r("Tools show working / experimental / off; off tools refuse with the reason.", "test_tool_registry_rules"),
    95: _r("Yes/No cards show what, why (Claude's reason), risk and if it can be undone.",
           "test_e2e_destructive_asks"),
    96: _r("Every tool lists known limitations; LIMITATIONS.md lists the rest.", "test_tool_registry_rules",
           "test_docs_present"),
    97: _l(4), 98: _l(8), 99: _g("Claude is told to keep simulated states apart from verified facts.",
                                 "test_system_prompt_static"),
    100: _r("If Claude or a tool is unavailable: clear message + what still works.", "test_cli_missing_fallback"),
}

# Areas that run on the Stage 1/2 core. A point turns green only for these areas.
STARTED_AREAS = {
    1: "Started: goals before work, report + checker after.",
    45: "Started: permission gates, locked risk classes, secret blanking, injection shield.",
    46: "Started: atomic saves, versions, undo, bounded retries, fallbacks.",
    47: "Started: steps/time/usage caps, Claude usage-limit tracking, STOP.",
    50: "Started: audit log with hash chain, honest status page, limitations list.",
    # Stage 2 memory areas
    11: "Started: long-term memory store (5 kinds, FTS5, provenance, supersede-not-overwrite).",
    13: "Started: episodic memory via the 'experience' kind (timestamped events OVERDRIVE did or saw).",
    14: "Started: semantic memory via the 'fact' kind (verifiable claims with confidence).",
    15: "Started: procedural memory via the 'instruction' kind (standing orders from the human).",
    16: "Started: memory maintenance (verified backup + restore, archive, forget, contradictions).",
}
