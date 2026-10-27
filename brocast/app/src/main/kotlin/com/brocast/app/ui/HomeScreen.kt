package com.brocast.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.brocast.app.Quality
import com.brocast.app.R
import com.brocast.app.ShareStatus
import com.brocast.app.SoundStatus

private val BrandGradient = Brush.linearGradient(listOf(BroColors.Primary, BroColors.Cyan))

@Composable
fun HomeScreen(
    status: ShareStatus,
    wifiAddresses: List<String>,
    quality: Quality,
    pinEnabled: Boolean,
    pin: String,
    soundEnabled: Boolean,
    soundSupported: Boolean,
    onSoundEnabledChange: (Boolean) -> Unit,
    onFixSoundPermission: () -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onQualityChange: (Quality) -> Unit,
    onPinEnabledChange: (Boolean) -> Unit,
    onNewPin: () -> Unit,
    onCopy: (String) -> Unit,
    oldAppInstalled: Boolean = false,
    onRemoveOldApp: () -> Unit = {},
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(BroColors.Background)
            .background(
                Brush.radialGradient(
                    colors = listOf(BroColors.Glow, Color.Transparent),
                    center = Offset(0f, 0f),
                    radius = 1400f,
                ),
            ),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            Modifier
                .widthIn(max = 560.dp)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 20.dp, vertical = 16.dp),
        ) {
            Header()
            Spacer(Modifier.height(22.dp))
            if (oldAppInstalled) {
                OldAppCard(onRemoveOldApp)
                Spacer(Modifier.height(14.dp))
            }

            val sharing = status is ShareStatus.Live || status is ShareStatus.Starting
            when (status) {
                is ShareStatus.Idle -> {
                    status.note?.let { NoteCard(it) }
                    StartCard(wifiAddresses.isEmpty(), onStart)
                }
                is ShareStatus.Failed -> {
                    ErrorCard(status.message)
                    StartCard(wifiAddresses.isEmpty(), onStart)
                }
                ShareStatus.Starting -> StartingCard()
                is ShareStatus.Live -> LiveCard(status, onStop, onCopy, onFixSoundPermission)
            }

            Spacer(Modifier.height(14.dp))
            SoundCard(soundEnabled, soundSupported, locked = sharing, onSoundEnabledChange)
            Spacer(Modifier.height(14.dp))
            QualityCard(quality, live = status is ShareStatus.Live, onQualityChange)
            Spacer(Modifier.height(14.dp))
            PinCard(pinEnabled, pin, locked = sharing, onPinEnabledChange, onNewPin)
            Spacer(Modifier.height(14.dp))
            if (!sharing) {
                HowToCard()
                Spacer(Modifier.height(14.dp))
            }
            TipsCard()
            Text(
                "Made for you, bro 🤙",
                color = BroColors.Muted,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 22.dp, bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun Header() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(17.dp))
                .background(BrandGradient),
        ) {
            Image(
                painter = painterResource(R.drawable.ic_launcher_foreground),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(
                "BroCast",
                style = TextStyle(
                    brush = Brush.linearGradient(listOf(BroColors.Lilac, BroColors.Cyan)),
                    fontSize = 32.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                modifier = Modifier.semantics { heading() },
            )
            Text("Your phone screen → your TV or PC", color = BroColors.Muted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun BroCard(
    modifier: Modifier = Modifier,
    border: BorderStroke = BorderStroke(1.dp, BroColors.Outline),
    content: @Composable () -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = BroColors.Surface.copy(alpha = 0.92f),
        border = border,
    ) {
        Column(Modifier.padding(20.dp)) { content() }
    }
}

@Composable
private fun CardTitle(text: String) {
    Text(
        text,
        color = BroColors.Text,
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.semantics { heading() },
    )
}

@Composable
private fun Body(text: String, color: Color = BroColors.Muted, size: Int = 15) {
    Text(text, color = color, fontSize = size.sp, lineHeight = (size + 6).sp)
}

@Composable
private fun StartCard(noWifi: Boolean, onStart: () -> Unit) {
    BroCard {
        CardTitle("Ready when you are 😎")
        Spacer(Modifier.height(6.dp))
        Body("Put your phone and your TV or PC on the same Wi-Fi, then hit the big button.")
        AnimatedVisibility(noWifi) {
            Column {
                Spacer(Modifier.height(12.dp))
                WarnBox(
                    "📶 You're not on Wi-Fi right now. Connect to the same Wi-Fi as your TV/PC " +
                        "(or turn on your hotspot and connect the TV/PC to it).",
                )
            }
        }
        Spacer(Modifier.height(18.dp))
        BigButton("▶  Start sharing", BrandGradient, onStart)
    }
}

@Composable
private fun BigButton(text: String, brush: Brush, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        color = Color.Transparent,
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(brush),
            contentAlignment = Alignment.Center,
        ) {
            Text(text, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OldAppCard(onRemove: () -> Unit) {
    BroCard(border = BorderStroke(1.dp, BroColors.Cyan.copy(alpha = 0.5f))) {
        CardTitle("👋 The old BroCast is still on your phone")
        Spacer(Modifier.height(6.dp))
        Body(
            "This new one sends real video, so it doesn't freeze on videos anymore. Remove the old one so " +
                "you don't open it by mistake (Android asks you to confirm).",
        )
        Spacer(Modifier.height(16.dp))
        BigButton("🧹  Remove the old BroCast", BrandGradient, onRemove)
    }
}

@Composable
private fun StartingCard() {
    BroCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.size(28.dp), color = BroColors.Cyan, strokeWidth = 3.dp)
            Spacer(Modifier.width(16.dp))
            CardTitle("Warming up… 🔥")
        }
    }
}

@Composable
private fun NoteCard(text: String) {
    BroCard {
        Body(text, color = BroColors.Text)
    }
    Spacer(Modifier.height(14.dp))
}

@Composable
private fun ErrorCard(message: String) {
    BroCard(border = BorderStroke(1.dp, BroColors.Live.copy(alpha = 0.6f))) {
        CardTitle("Ugh, that didn't work 😩")
        Spacer(Modifier.height(6.dp))
        Body(message, color = BroColors.Text)
    }
    Spacer(Modifier.height(14.dp))
}

@Composable
private fun WarnBox(text: String) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(BroColors.Warn.copy(alpha = 0.12f))
            .padding(12.dp),
    ) {
        Body(text, color = BroColors.Warn, size = 14)
    }
}

@Composable
private fun PulsingDot() {
    val transition = rememberInfiniteTransition(label = "pulse")
    val alpha by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0.25f,
        animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
        label = "pulseAlpha",
    )
    Box(
        Modifier
            .size(12.dp)
            .alpha(alpha)
            .clip(CircleShape)
            .background(BroColors.Live),
    )
}

@Composable
private fun LiveCard(
    live: ShareStatus.Live,
    onStop: () -> Unit,
    onCopy: (String) -> Unit,
    onFixSoundPermission: () -> Unit,
) {
    BroCard(border = BorderStroke(1.5.dp, BroColors.Live.copy(alpha = 0.55f))) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PulsingDot()
            Spacer(Modifier.width(8.dp))
            Text("LIVE", color = BroColors.Live, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.5.sp)
            Spacer(Modifier.weight(1f))
            Text(
                if (live.fps > 0) "⚡ ${live.fps} fps" else "😴 screen is still",
                color = BroColors.Muted,
                fontSize = 13.sp,
            )
        }
        Spacer(Modifier.height(16.dp))

        val main = live.addresses.firstOrNull()
        if (main == null) {
            CardTitle("📶 No Wi-Fi!")
            Spacer(Modifier.height(6.dp))
            Body(
                "Your phone isn't on Wi-Fi, so your TV can't find it. Connect to the same Wi-Fi as " +
                    "your TV or PC. BroCast keeps running and the address shows up here.",
            )
        } else {
            Body("On your TV or PC, open the web browser and type this in the address bar 👇", color = BroColors.Text)
            Spacer(Modifier.height(12.dp))
            val address = "$main:${live.port}"
            Surface(
                onClick = { onCopy("http://$address") },
                shape = RoundedCornerShape(18.dp),
                color = BroColors.SurfaceHigh,
                border = BorderStroke(1.dp, BroColors.Cyan.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(vertical = 16.dp, horizontal = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    // Shrinks to fit so the whole address is always readable, even on small phones.
                    BasicText(
                        address,
                        style = TextStyle(
                            color = BroColors.Cyan,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            textAlign = TextAlign.Center,
                        ),
                        maxLines = 1,
                        softWrap = false,
                        autoSize = TextAutoSize.StepBased(minFontSize = 14.sp, maxFontSize = 32.sp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("tap to copy", color = BroColors.Muted, fontSize = 12.sp)
                }
            }
            if (live.addresses.size > 1) {
                Spacer(Modifier.height(8.dp))
                Body(
                    "Doesn't load? Try: " + live.addresses.drop(1).joinToString { "$it:${live.port}" },
                    size = 13,
                )
            }
            Spacer(Modifier.height(8.dp))
            Body("💡 Bookmark that page on your TV/PC. Next time, just open the bookmark.", size = 13)
        }

        if (live.pin != null) {
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Body("🔒 PIN for the TV:", color = BroColors.Text)
                Spacer(Modifier.width(10.dp))
                Text(
                    live.pin,
                    color = BroColors.Text,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 6.sp,
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        if (live.viewers == 0) {
            Body("👀 Waiting for a screen to connect…")
        } else {
            Body(
                if (live.viewers == 1) "📺 1 screen is watching" else "📺 ${live.viewers} screens are watching",
                color = BroColors.Good,
            )
            Body(live.viewerAddresses.joinToString(), size = 12)
        }
        Spacer(Modifier.height(10.dp))
        Body(
            if (live.video) {
                "🎬 Sending smooth video"
            } else {
                "🖼️ Sending pictures (a screen that can't play the video is watching)"
            },
            size = 13,
        )
        Spacer(Modifier.height(4.dp))
        SoundLine(live.sound, onFixSoundPermission)
        if (live.noPicture) {
            Spacer(Modifier.height(10.dp))
            WarnBox("😶 Android hasn't sent any picture yet. If your TV is stuck on \"Loading\", stop and start again.")
        }

        Spacer(Modifier.height(18.dp))
        BigButton("■  Stop sharing", Brush.linearGradient(listOf(BroColors.Live, Color(0xFFE11D48))), onStop)
    }
}

@Composable
private fun SoundLine(sound: SoundStatus, onFixPermission: () -> Unit) {
    when (sound) {
        SoundStatus.ON -> Body("🔊 Sound is on. On the TV/PC, press OK or click once to hear it.", color = BroColors.Good)
        SoundStatus.OFF -> Body("🔇 Sound is off (you can turn it on below, after stopping).")
        SoundStatus.UNSUPPORTED -> Body("🔇 No sound: that needs Android 10 or newer 😢")
        SoundStatus.FAILED -> Body("🔇 Android wouldn't hand over the sound this time. Stop and start again.", color = BroColors.Warn)
        SoundStatus.NO_PERMISSION -> Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) {
                Body("🔇 No sound: Android's \"record audio\" permission is off.", color = BroColors.Warn)
            }
            TextButton(onClick = onFixPermission) { Text("Fix it") }
        }
    }
}

@Composable
private fun SoundCard(enabled: Boolean, supported: Boolean, locked: Boolean, onEnabledChange: (Boolean) -> Unit) {
    BroCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                CardTitle("🔊 Sound on the TV")
                Spacer(Modifier.height(4.dp))
                Body(
                    if (supported) {
                        "Sends what your phone is playing (videos, games, music) along with the picture."
                    } else {
                        "Needs Android 10 or newer, sorry 😢 The picture still works."
                    },
                    size = 14,
                )
            }
            Spacer(Modifier.width(12.dp))
            Switch(
                checked = enabled && supported,
                onCheckedChange = onEnabledChange,
                enabled = supported && !locked,
                colors = SwitchDefaults.colors(checkedTrackColor = BroColors.Primary),
            )
        }
        if (supported && enabled && !locked) {
            Spacer(Modifier.height(8.dp))
            Body(
                "Android will ask to \"record audio\". That's just its name for this: BroCast only grabs " +
                    "the sound your phone plays and never uses your microphone 🎤🚫",
                size = 13,
            )
        }
        if (locked && supported) Body("Stop sharing to change this.", size = 12)
    }
}

@Composable
private fun QualityCard(quality: Quality, live: Boolean, onChange: (Quality) -> Unit) {
    BroCard {
        CardTitle("🎚️ Picture quality")
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Quality.entries.forEach { q ->
                val selected = q == quality
                Surface(
                    selected = selected,
                    onClick = { onChange(q) },
                    shape = RoundedCornerShape(16.dp),
                    color = if (selected) BroColors.Primary.copy(alpha = 0.22f) else BroColors.SurfaceHigh,
                    border = if (selected) BorderStroke(2.dp, BroColors.Primary) else BorderStroke(1.dp, BroColors.Outline),
                    modifier = Modifier
                        .weight(1f)
                        .semantics { this.role = Role.RadioButton },
                ) {
                    Column(
                        Modifier.padding(vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(q.emoji, fontSize = 22.sp)
                        Spacer(Modifier.height(2.dp))
                        Text(
                            q.label,
                            color = if (selected) Color.White else BroColors.Text,
                            fontSize = 14.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Body(quality.description, size = 14)
        if (live) Body("Changes apply instantly ✨", size = 13)
    }
}

@Composable
private fun PinCard(
    enabled: Boolean,
    pin: String,
    locked: Boolean,
    onEnabledChange: (Boolean) -> Unit,
    onNewPin: () -> Unit,
) {
    BroCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                CardTitle("🔒 Require a PIN")
                Spacer(Modifier.height(4.dp))
                Body("Only screens that type the PIN can watch. Smart on shared Wi-Fi (dorms, cafés, work).", size = 14)
            }
            Spacer(Modifier.width(12.dp))
            Switch(
                checked = enabled,
                onCheckedChange = onEnabledChange,
                enabled = !locked,
                colors = SwitchDefaults.colors(checkedTrackColor = BroColors.Primary),
            )
        }
        if (enabled) {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Body("Your PIN:", color = BroColors.Text)
                Spacer(Modifier.width(8.dp))
                Text(
                    pin,
                    color = BroColors.Text,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 4.sp,
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onNewPin, enabled = !locked) { Text("🎲 New PIN") }
            }
        }
        if (locked) Body("Stop sharing to change this.", size = 12)
    }
}

@Composable
private fun HowToCard() {
    BroCard {
        CardTitle("🧭 How it works")
        Spacer(Modifier.height(10.dp))
        Step("1", "Phone and TV/PC on the same Wi-Fi 📶")
        Step("2", "Tap Start sharing and allow it ▶️ (if Android asks, pick \"Entire screen\")")
        Step("3", "On the TV/PC, open the web browser 🌐 and type the address BroCast shows you")
        Step("4", "Hit Full screen (or press F on a keyboard) and enjoy 🍿")
        Spacer(Modifier.height(6.dp))
        Body(
            "TV browser names: Samsung → \"Internet\", LG → \"Web Browser\", Fire TV → \"Silk\". " +
                "On a PC, any browser works (Chrome, Edge, Firefox, Safari).",
            size = 13,
        )
    }
}

@Composable
private fun Step(number: String, text: String) {
    Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.Top) {
        Box(
            Modifier
                .size(26.dp)
                .clip(CircleShape)
                .background(BrandGradient),
            contentAlignment = Alignment.Center,
        ) {
            Text(number, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Body(text, color = BroColors.Text)
    }
}

@Composable
private fun TipsCard() {
    BroCard {
        CardTitle("💡 Good to know")
        Spacer(Modifier.height(8.dp))
        Tip("🔉", "Your phone plays the sound too. Turn its volume down to avoid an echo. (If the TV goes quiet too, keep the phone just a little louder.)")
        Tip("🔇", "Some apps don't share their sound, and phone calls never do.")
        Tip("🕶️", "Netflix, Disney+, banking apps and a few others block screen sharing, so they show up black. That's them, not BroCast.")
        Tip("🔄", "Turn your phone sideways for videos and games. The TV picture turns too.")
        Tip("🐢", "Laggy? Pick 🔋 Saver, or move closer to your Wi-Fi router.")
        Tip("🔋", "Sharing uses extra battery, so plug in for long sessions.")
    }
}

@Composable
private fun Tip(emoji: String, text: String) {
    Row(Modifier.padding(vertical = 5.dp)) {
        Text(emoji, fontSize = 16.sp, modifier = Modifier.width(30.dp))
        Body(text, size = 14)
    }
}
