package main

import "embed"

// Shared by ALTS (the chat-box emoji + sticker picker) and ALTS Clipboard.

//go:embed ui/clip.html ui/emoji.txt
var clipUI embed.FS

//go:embed ui/stickers
var builtinStickers embed.FS
