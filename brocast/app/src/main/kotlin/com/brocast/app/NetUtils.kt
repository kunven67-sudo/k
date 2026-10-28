package com.brocast.app

import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.SocketException

object NetUtils {
    // Mobile data, VPN and other links a TV on your Wi-Fi can't reach.
    private val SKIP_PREFIXES = listOf(
        "rmnet", "r_rmnet", "ccmni", "pdp", "v4-", "clat", "dummy", "tun", "ppp", "ipsec", "seth", "uwbr", "ifb",
    )

    /**
     * The phone's local network addresses, best guess first: Wi-Fi, then hotspot, then anything
     * else that looks like a home network (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
     */
    fun lanAddresses(): List<String> {
        val interfaces = try {
            NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
        } catch (e: SocketException) {
            emptyList()
        } catch (e: SecurityException) {
            emptyList()
        }
        val found = mutableListOf<Pair<Int, String>>()
        for (ni in interfaces) {
            val usable = try {
                ni.isUp && !ni.isLoopback
            } catch (e: SocketException) {
                false
            }
            if (!usable) continue
            val name = ni.name.lowercase()
            if (SKIP_PREFIXES.any { name.startsWith(it) }) continue
            val rank = when {
                name.startsWith("wlan") -> 0
                name.startsWith("swlan") || name.startsWith("ap") || name.contains("softap") -> 1
                name.startsWith("eth") -> 2
                else -> 3
            }
            for (address in ni.inetAddresses.toList()) {
                if (address is Inet4Address && address.isSiteLocalAddress) {
                    address.hostAddress?.let { found += rank to it }
                }
            }
        }
        return found.sortedBy { it.first }.map { it.second }.distinct()
    }
}
