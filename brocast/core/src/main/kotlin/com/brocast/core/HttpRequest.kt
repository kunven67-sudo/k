package com.brocast.core

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URLDecoder

/** The tiny slice of HTTP/1.1 the viewer page needs: GET/HEAD with a path, query and headers. */
class HttpRequest(
    val method: String,
    val path: String,
    val query: Map<String, String>,
    private val headers: Map<String, String>,
) {
    fun header(name: String): String? = headers[name.lowercase()]

    fun cookie(name: String): String? {
        val raw = header("cookie") ?: return null
        for (part in raw.split(';')) {
            val trimmed = part.trim()
            val eq = trimmed.indexOf('=')
            if (eq > 0 && trimmed.substring(0, eq) == name) return trimmed.substring(eq + 1)
        }
        return null
    }

    companion object {
        const val MAX_HEAD_BYTES = 16 * 1024

        /** Reads one request head. Returns null if the client hung up or sent garbage. */
        fun read(input: InputStream): HttpRequest? {
            val head = readHead(input) ?: return null
            val lines = head.split("\r\n")
            val parts = lines[0].split(' ')
            if (parts.size != 3 || !parts[2].startsWith("HTTP/")) return null
            val target = parts[1]
            if (!target.startsWith("/")) return null

            val headers = HashMap<String, String>()
            for (line in lines.drop(1)) {
                val colon = line.indexOf(':')
                if (colon <= 0) continue
                headers[line.substring(0, colon).trim().lowercase()] = line.substring(colon + 1).trim()
            }
            val qIndex = target.indexOf('?')
            val path = if (qIndex < 0) target else target.substring(0, qIndex)
            val rawQuery = if (qIndex < 0) "" else target.substring(qIndex + 1)
            return HttpRequest(parts[0], path, parseQuery(rawQuery), headers)
        }

        fun parseQuery(raw: String): Map<String, String> {
            val result = HashMap<String, String>()
            for (pair in raw.split('&')) {
                if (pair.isEmpty()) continue
                val eq = pair.indexOf('=')
                val key = if (eq < 0) pair else pair.substring(0, eq)
                val value = if (eq < 0) "" else pair.substring(eq + 1)
                try {
                    result[URLDecoder.decode(key, "UTF-8")] = URLDecoder.decode(value, "UTF-8")
                } catch (e: IllegalArgumentException) {
                    // Malformed %-escape: ignore just this pair.
                }
            }
            return result
        }

        private fun readHead(input: InputStream): String? {
            // Every method starts with a capital letter. Anything else (like a browser trying
            // HTTPS first, which starts with byte 0x16) gets dropped right away so the browser
            // falls back to plain http instantly instead of waiting on us.
            val first = input.read()
            if (first !in 'A'.code..'Z'.code) return null
            val buf = ByteArrayOutputStream(512)
            buf.write(first)
            // Counts how much of "\r\n\r\n" we've matched so far.
            var matched = 0
            while (matched < 4) {
                val b = input.read()
                if (b == -1) return null
                buf.write(b)
                if (buf.size() > MAX_HEAD_BYTES) return null
                matched = when {
                    b == '\r'.code && (matched == 0 || matched == 2) -> matched + 1
                    b == '\n'.code && (matched == 1 || matched == 3) -> matched + 1
                    b == '\r'.code -> 1
                    else -> 0
                }
            }
            val text = buf.toString("ISO-8859-1")
            return text.substring(0, text.length - 4)
        }
    }
}
