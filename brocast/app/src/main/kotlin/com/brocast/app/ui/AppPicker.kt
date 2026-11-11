package com.brocast.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

/** An app on the phone that can be opened (for "which app do you watch on?"). */
class WatchApp(val label: String, val packageName: String, val icon: ImageBitmap?)

/**
 * "Which app do you watch on?": one tap picks it, BroCast remembers it and opens it from then on.
 * [apps] null = still loading the list.
 */
@Composable
fun AppPicker(apps: List<WatchApp>?, onPick: (WatchApp) -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(24.dp), color = BroColors.Surface) {
            Column(Modifier.padding(vertical = 20.dp)) {
                Text(
                    "Which app do you watch on? 🍿",
                    color = BroColors.Text,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
                Text(
                    "Tap it once. BroCast opens it for you from now on.",
                    color = BroColors.Muted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 10.dp),
                )
                if (apps == null) {
                    CircularProgressIndicator(
                        color = BroColors.Cyan,
                        modifier = Modifier
                            .padding(24.dp)
                            .align(Alignment.CenterHorizontally),
                    )
                } else {
                    LazyColumn(Modifier.heightIn(max = 460.dp)) {
                        items(apps, key = { it.packageName }) { app ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(role = Role.Button) { onPick(app) }
                                    .padding(horizontal = 20.dp, vertical = 10.dp),
                            ) {
                                if (app.icon != null) {
                                    Image(app.icon, contentDescription = null, modifier = Modifier.size(40.dp))
                                } else {
                                    Spacer(Modifier.size(40.dp))
                                }
                                Spacer(Modifier.width(14.dp))
                                Text(app.label, color = BroColors.Text, fontSize = 17.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
