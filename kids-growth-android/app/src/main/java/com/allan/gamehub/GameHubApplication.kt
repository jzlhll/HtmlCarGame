package com.allan.gamehub

import android.app.Application
import android.os.SystemClock
import android.util.Log
import java.time.LocalDate

/** 账本和写入队列跟随应用，旋转和Activity重建复用同一份内存状态。 */
class GameHubApplication : Application() {
    lateinit var ledger: UsageLedger
        private set
    lateinit var store: UsageStore
        private set
    var storageBroken = false
        private set
    var onPersistenceFailure: (() -> Unit)? = null

    override fun onCreate() {
        super.onCreate()
        store = UsageStore(this) {
            storageBroken = true
            ledger.state(false, SystemClock.elapsedRealtime())
            onPersistenceFailure?.invoke()
        }
        val daily = try { store.load() } catch (error: Exception) {
            Log.e("GameHub", "Usage record could not be loaded", error)
            storageBroken = true
            DailyUsage(LocalDate.now())
        }
        ledger = UsageLedger(daily)
        ledger.refreshDate(LocalDate.now(), SystemClock.elapsedRealtime())
        if (!storageBroken) store.save(ledger.daily)
    }
}
