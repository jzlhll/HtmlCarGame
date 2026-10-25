import org.gradle.api.tasks.PathSensitivity

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val gameProjects = listOf("car-game", "low-altitude-flight", "english-air-combat")
val repositoryDirectory = rootProject.layout.projectDirectory.dir("..")
val generatedGameAssets = layout.buildDirectory.dir("generated/gameAssets")

// 只在 Android 资源任务前整理网页；不依赖任何工程的 Pages 发布副作用。
val prepareGames by tasks.registering(Exec::class) {
    group = "game assets"
    description = "Prepare offline web games for the Android app"
    workingDir(rootProject.projectDir)
    executable = providers.gradleProperty("gameNodeExecutable").orElse("node").get()
    args("scripts/prepare-games.mjs", "--output=${generatedGameAssets.get().asFile.absolutePath}")
    inputs.property("gameProjects", gameProjects)
    inputs.files(rootProject.fileTree("scripts") { include("**/*.mjs") })
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.files(rootProject.fileTree("web") { include("**/*") })
        .withPathSensitivity(PathSensitivity.RELATIVE)
    gameProjects.forEach { game ->
        inputs.files(fileTree(repositoryDirectory.dir(game)) {
            include("index.html", "package.json", "package-lock.json", "src/**", "scripts/**", "third-party/**")
            exclude("src/resource-sources.js")
        }).withPathSensitivity(PathSensitivity.RELATIVE)
    }
    outputs.dir(generatedGameAssets)
}

android {
    namespace = "com.allan.gamehub"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.allan.gamehub"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }
    sourceSets.getByName("main").assets.srcDir(generatedGameAssets)
    buildFeatures { buildConfig = true }
    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    androidResources { noCompress += listOf("gz", "wav") }
}

// assemble、bundle 与独立 mergeAssets 均经过同一资源准备入口。
tasks.named("preBuild").configure { dependsOn(prepareGames) }
tasks.configureEach {
    if (name.startsWith("merge") && name.endsWith("Assets")) dependsOn(prepareGames)
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.webkit:webkit:1.14.0")
}
