package com.allan.gamehub

import java.time.DayOfWeek
import java.time.LocalDate

/** 原生持有每日额度；网页只上报阶段，不拥有计时、奖励和余额。 */
data class DailyUsage(
    val date: LocalDate,
    val studyMillis: Long = 0,
    val carUsedMillis: Long = 0,
    val flightUsedMillis: Long = 0
) {
    val allowanceMillis: Long get() = if (date.dayOfWeek == DayOfWeek.SATURDAY || date.dayOfWeek == DayOfWeek.SUNDAY) 18 * 60_000L else 12 * 60_000L
    val unlocked: Boolean get() = studyMillis >= UsageLedger.STUDY_TARGET
    fun remaining(game: GameId): Long {
        if (game == GameId.ENGLISH) return if (unlocked) 0 else UsageLedger.STUDY_TARGET - studyMillis
        if (!unlocked) return 0
        val used = if (game == GameId.CAR) carUsedMillis else flightUsedMillis
        return if (used >= allowanceMillis) 0 else allowanceMillis - used
    }
}

enum class UsageStop { NONE, IDLE, DISCONNECTED, EXHAUSTED, NEW_DAY, CLOCK_CHANGED }

class UsageLedger(var daily: DailyUsage) {
    companion object {
        const val STUDY_TARGET = 15 * 60_000L
        const val IDLE_LIMIT = 30_000L
        const val HEARTBEAT_LIMIT = 2_500L
    }
    var game: GameId? = null
        private set
    var eligible = false
        private set
    var foreground = false
        private set
    var clockInvalid = false
        private set
    private var lastTick = 0L
    private var lastInteraction = 0L
    private var lastHeartbeat = 0L

    fun select(selected: GameId?, now: Long) {
        game = selected
        eligible = false
        lastTick = now
        lastInteraction = now
        lastHeartbeat = now
    }

    fun setForeground(value: Boolean, now: Long) {
        foreground = value
        lastTick = now
        if (!value) eligible = false
    }

    fun interaction(now: Long) { lastInteraction = now }

    fun state(active: Boolean, now: Long) {
        eligible = active
        lastHeartbeat = now
        lastTick = now
    }

    fun canOpen(selected: GameId): Boolean = !clockInvalid && (selected == GameId.ENGLISH || daily.remaining(selected) > 0)

    fun refreshDate(today: LocalDate, now: Long): UsageStop {
        clockInvalid = today < daily.date
        if (clockInvalid) {
            eligible = false
            lastTick = now
            return UsageStop.CLOCK_CHANGED
        }
        if (today > daily.date) {
            daily = DailyUsage(today)
            eligible = false
            lastTick = now
            return UsageStop.NEW_DAY
        }
        return UsageStop.NONE
    }

    fun tick(now: Long, today: LocalDate): UsageStop {
        val dayChange = refreshDate(today, now)
        if (dayChange != UsageStop.NONE) return dayChange
        val selected = game
        if (!foreground || !eligible || selected == null) { lastTick = now; return UsageStop.NONE }
        var end = now
        val idleAt = lastInteraction + IDLE_LIMIT
        val disconnectedAt = lastHeartbeat + HEARTBEAT_LIMIT
        if (end > idleAt) end = idleAt
        if (end > disconnectedAt) end = disconnectedAt
        val elapsed = if (end > lastTick) end - lastTick else 0
        lastTick = now
        if (selected == GameId.ENGLISH) {
            val total = daily.studyMillis + elapsed
            daily = daily.copy(studyMillis = if (total > STUDY_TARGET) STUDY_TARGET else total)
        } else {
            if (!daily.unlocked) { eligible = false; return UsageStop.EXHAUSTED }
            val used = (if (selected == GameId.CAR) daily.carUsedMillis else daily.flightUsedMillis) + elapsed
            val bounded = if (used > daily.allowanceMillis) daily.allowanceMillis else used
            daily = if (selected == GameId.CAR) daily.copy(carUsedMillis = bounded) else daily.copy(flightUsedMillis = bounded)
            if (daily.remaining(selected) == 0L) { eligible = false; return UsageStop.EXHAUSTED }
        }
        if (now >= idleAt) { eligible = false; return UsageStop.IDLE }
        if (now >= disconnectedAt) { eligible = false; return UsageStop.DISCONNECTED }
        return UsageStop.NONE
    }
}
