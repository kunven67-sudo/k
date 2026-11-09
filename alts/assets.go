package main

import "embed"

// Shared by ALTS (the chat-box emoji picker) and ALTS Clipboard. (Meme stickers aren't inside the
// app: ALTS Clipboard downloads them onto your PC, see memes.go.)

//go:embed ui/clip.html ui/emoji.txt
var clipUI embed.FS
