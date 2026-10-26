package com.brocast.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object BroColors {
    val Background = Color(0xFF0B0F1A)
    val Glow = Color(0xFF2A1F5C)
    val Surface = Color(0xFF141A2A)
    val SurfaceHigh = Color(0xFF1C2438)
    val Outline = Color(0xFF2A3350)
    val Primary = Color(0xFF7C5CFF)
    val Lilac = Color(0xFFA78BFA)
    val Cyan = Color(0xFF22D3EE)
    val Text = Color(0xFFEEF2FF)
    val Muted = Color(0xFF9AA4BF)
    val Live = Color(0xFFFF4D6D)
    val Good = Color(0xFF34D399)
    val Warn = Color(0xFFFBBF24)
}

@Composable
fun BroCastTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = BroColors.Primary,
            onPrimary = Color.White,
            secondary = BroColors.Cyan,
            onSecondary = BroColors.Background,
            background = BroColors.Background,
            onBackground = BroColors.Text,
            surface = BroColors.Surface,
            onSurface = BroColors.Text,
            surfaceVariant = BroColors.SurfaceHigh,
            onSurfaceVariant = BroColors.Muted,
            outline = BroColors.Outline,
            error = BroColors.Live,
        ),
        content = content,
    )
}
