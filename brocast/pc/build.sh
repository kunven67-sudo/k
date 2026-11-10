#!/bin/sh
# Builds BroCast.exe (Windows 10/11, 64-bit) with MinGW-w64, plus the Linux test program.
#   apt install g++-mingw-w64-x86-64
set -e
cd "$(dirname "$0")"
mkdir -p build
x86_64-w64-mingw32-windres res/app.rc -O coff -o build/app.res.o
x86_64-w64-mingw32-g++ -std=c++17 -O2 -Wall -Wextra -Wno-cast-function-type -Wno-missing-field-initializers -municode -mwindows \
  -static -static-libgcc -static-libstdc++ -DUNICODE -D_UNICODE -D_WIN32_WINNT=0x0A00 -D__USE_MINGW_ANSI_STDIO=1 \
  src/app.cpp src/audio.cpp src/decoder.cpp src/fmp4.cpp src/gfx.cpp src/log.cpp src/net.cpp src/sync.cpp build/app.res.o \
  -o build/BroCast.exe \
  -ld3d11 -ldxgi -lmfplat -lmfuuid -lmf -lole32 -loleaut32 -luuid -lws2_32 -liphlpapi -lshell32 -luser32 -lgdi32
x86_64-w64-mingw32-strip build/BroCast.exe
g++ -std=c++17 -O2 -Wall -Wextra tests/test_main.cpp src/net.cpp src/fmp4.cpp src/sync.cpp -o build/pc_test
ls -la build/BroCast.exe build/pc_test
