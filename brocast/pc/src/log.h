// BroCast PC: a small log file (%LOCALAPPDATA%\BroCast\pc.log), so problems on a real PC can be read later.
#pragma once

void logOpen();
void logf(const char* fmt, ...)
#ifdef __GNUC__
    __attribute__((format(printf, 1, 2)))
#endif
    ;
