//go:build !windows

package main

import "fmt"

func main() { fmt.Println("OVERCLICK is a Windows app. Build it with GOOS=windows.") }
