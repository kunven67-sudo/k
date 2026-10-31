package main

import "testing"

func TestParseTasks(t *testing.T) {
	md := "# Claude's tasks\nUpdated: 2026-10-31 03:10\nJob: the 6 picks\nall in one go.\n\n## Doing\n- [~] ALTS 1.3\n  with a Tasks box\n\n## Next\n- [ ] Tests\n- [ ] Send it\n\n## Done\n- [x] LINK\n"
	l := parseTasks(md)
	if l.Updated != "2026-10-31 03:10" || l.Job != "the 6 picks all in one go." {
		t.Fatalf("head: %+v", l)
	}
	if len(l.Doing) != 1 || l.Doing[0] != "ALTS 1.3 with a Tasks box" || len(l.Next) != 2 || len(l.Done) != 1 || l.Done[0] != "LINK" {
		t.Fatalf("lists: %+v", l)
	}
	if e := parseTasks(""); e.Doing == nil || e.Next == nil || e.Done == nil {
		t.Fatal("empty lists should be [] not null")
	}
}
