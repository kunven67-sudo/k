package main

import (
	"os"
	"strings"
	"unicode/utf16"
)

// readIni reads windhawk.ini like Windhawk does: UTF-16LE when it starts with FF FE, else UTF-8.
func readIni(p string) map[string]map[string]string {
	out := map[string]map[string]string{}
	raw, err := os.ReadFile(p)
	if err != nil {
		return out
	}
	text := string(raw)
	if len(raw) >= 2 && raw[0] == 0xFF && raw[1] == 0xFE {
		u := make([]uint16, (len(raw)-2)/2)
		for i := range u {
			u[i] = uint16(raw[2+2*i]) | uint16(raw[3+2*i])<<8
		}
		text = string(utf16.Decode(u))
	}
	text = strings.TrimPrefix(text, "\uFEFF")
	sec := ""
	for _, line := range strings.Split(text, "\n") {
		l := strings.TrimSpace(line)
		if l == "" || l[0] == ';' || l[0] == '#' {
			continue
		}
		if l[0] == '[' && strings.HasSuffix(l, "]") {
			sec = strings.ToLower(strings.TrimSpace(l[1 : len(l)-1]))
			continue
		}
		if i := strings.IndexByte(l, '='); i > 0 {
			if out[sec] == nil {
				out[sec] = map[string]string{}
			}
			v := strings.TrimSpace(l[i+1:])
			if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' {
				v = v[1 : len(v)-1]
			}
			out[sec][strings.ToLower(strings.TrimSpace(l[:i]))] = v
		}
	}
	return out
}
