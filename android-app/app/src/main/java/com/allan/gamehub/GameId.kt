package com.allan.gamehub

enum class GameId(val directory: String) {
    ENGLISH("english-air-combat"),
    CAR("car-game"),
    FLIGHT("low-altitude-flight");

    val origin: String get() = "https://$directory.appassets.androidplatform.net"
    val entryUrl: String get() = "$origin/assets/games/$directory/index.html"
}
