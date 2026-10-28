import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.brocast.app"
    compileSdk = 36

    defaultConfig {
        // 2.0 got a new id: 1.0 was signed with a key that's gone, so it can't be updated in place.
        applicationId = "com.brocast.live"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "2.1"
        // Phones are ARM. The subtitle reader + translator ship native code per chip type, so the
        // rest is left out (113 MB -> about half). An emulator build: -Pbrocast.abis=x86_64
        ndk {
            abiFilters += (findProperty("brocast.abis") as String? ?: "arm64-v8a,armeabi-v7a").split(',')
        }
    }

    // The release key is private and never goes in the repo: put brocast-release.jks and
    // release-key.properties (storePassword=...) in app/ to sign real releases (every update must use
    // the same key). Without them, release builds are signed with the debug key.
    val releaseKey = file("brocast-release.jks")
    val keyProps = Properties().apply {
        file("release-key.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
    }
    signingConfigs {
        val pass = keyProps.getProperty("storePassword")
        if (releaseKey.exists() && pass != null) {
            create("release") {
                storeFile = releaseKey
                storePassword = pass
                keyAlias = "brocast"
                keyPassword = pass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all {
                it.systemProperty("roborazzi.test.record", "true")
                it.systemProperty("robolectric.pixelCopyRenderMode", "hardware")
            }
        }
    }

    lint {
        checkDependencies = true
        abortOnError = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":core"))

    implementation(platform("androidx.compose:compose-bom:2025.12.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")

    // English subtitles on the phone: Google's on-device text readers + offline translator (ML Kit).
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("com.google.mlkit:text-recognition-japanese:16.0.1")
    implementation("com.google.mlkit:text-recognition-chinese:16.0.1")
    implementation("com.google.mlkit:text-recognition-korean:16.0.1")
    implementation("com.google.mlkit:translate:17.0.3")
    implementation("com.google.mlkit:language-id:17.0.6")

    // App tests run on a simulated Android (Robolectric) and take UI screenshots (Roborazzi).
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation(platform("androidx.compose:compose-bom:2025.12.00"))
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.52.0")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.52.0")
}
