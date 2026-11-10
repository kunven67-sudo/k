package main

// Claude's task list (notes/tasks.md in its memory): what it's doing, what's next, what's done.
// It lives in the memory, not the chat, so it never disappears when a chat stops.

import (
	"regexp"
	"strings"
)

type taskList struct {
	Job     string   `json:"job"`
	Updated string   `json:"updated"`
	Doing   []string `json:"doing"`
	Next    []string `json:"next"`
	Done    []string `json:"done"`
}

var taskLine = regexp.MustCompile(`^- \[.\] (.*)$`)

func parseTasks(md string) taskList {
	var t taskList
	var cur *[]string
	var job []string
	inJob := false
	for _, line := range strings.Split(strings.ReplaceAll(md, "\r", ""), "\n") {
		switch {
		case strings.HasPrefix(line, "Updated:"):
			t.Updated = strings.TrimSpace(strings.TrimPrefix(line, "Updated:"))
		case strings.HasPrefix(line, "Job:"):
			inJob = true
			job = append(job, strings.TrimSpace(strings.TrimPrefix(line, "Job:")))
		case strings.HasPrefix(line, "## "):
			inJob = false
			switch strings.ToLower(strings.TrimSpace(line[3:])) {
			case "doing":
				cur = &t.Doing
			case "next":
				cur = &t.Next
			case "done":
				cur = &t.Done
			default:
				cur = nil
			}
		case cur != nil && taskLine.MatchString(line):
			*cur = append(*cur, taskLine.FindStringSubmatch(line)[1])
		case cur != nil && strings.HasPrefix(line, "  ") && len(*cur) > 0:
			(*cur)[len(*cur)-1] += " " + strings.TrimSpace(line)
		case inJob && strings.TrimSpace(line) != "" && !strings.HasPrefix(line, "#"):
			job = append(job, strings.TrimSpace(line))
		default:
			inJob = false
		}
	}
	t.Job = strings.Join(job, " ")
	for _, l := range []*[]string{&t.Doing, &t.Next, &t.Done} {
		if *l == nil {
			*l = []string{}
		}
	}
	return t
}
