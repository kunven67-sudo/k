import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Pure Kotlin/JVM module: the web server + viewer page. No Android code here, so it can be
// unit-tested and run on a laptop (see runDevServer) exactly as it runs on the phone.
plugins {
    id("org.jetbrains.kotlin.jvm")
    // Lets Android lint check this module too (e.g. no Java APIs newer than the app's minSdk).
    id("com.android.lint")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    useJUnit()
}

// Fake phone for testing the TV page in a desktop browser:
//   gradle :core:runDevServer --args="--port 8080 --pin 1234"
tasks.register<JavaExec>("runDevServer") {
    group = "application"
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.brocast.core.DevServerKt")
    systemProperty("java.awt.headless", "true")
}

tasks.register("writeTestClasspath") {
    val cp = sourceSets["test"].runtimeClasspath
    dependsOn(tasks.named("testClasses"))
    doLast {
        layout.buildDirectory.file("test-classpath.txt").get().asFile.writeText(cp.asPath)
    }
}
