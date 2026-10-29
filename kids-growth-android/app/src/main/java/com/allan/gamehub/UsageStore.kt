package com.allan.gamehub

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.AtomicFile
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.util.concurrent.Executors

/** 按提交顺序原子落盘，应用重启、账号切换不重发当天额度。 */
class UsageStore(context: Context, private val onFailure: () -> Unit) {
    private val file = AtomicFile(File(context.filesDir, "child-usage.json"))
    private val writer = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var closed = false
    private var failed = false
    private var lastQueued: DailyUsage? = null

    fun load(): DailyUsage {
        if (!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) return DailyUsage(LocalDate.now())
        val json = JSONObject(file.openRead().bufferedReader().use { it.readText() })
        check(json.getInt("format") == 1)
        val usage = DailyUsage(LocalDate.parse(json.getString("date")), json.getLong("studyMillis"), json.getLong("carUsedMillis"), json.getLong("flightUsedMillis"))
        check(usage.studyMillis in 0..UsageLedger.STUDY_TARGET)
        check(usage.carUsedMillis in 0..usage.allowanceMillis && usage.flightUsedMillis in 0..usage.allowanceMillis)
        lastQueued = usage
        return usage
    }

    fun save(usage: DailyUsage) {
        if (closed || failed || usage == lastQueued) return
        lastQueued = usage
        val bytes = JSONObject().put("format", 1).put("date", usage.date.toString())
            .put("studyMillis", usage.studyMillis).put("carUsedMillis", usage.carUsedMillis)
            .put("flightUsedMillis", usage.flightUsedMillis).toString().toByteArray(Charsets.UTF_8)
        writer.execute {
            var stream: java.io.FileOutputStream? = null
            try {
                stream = file.startWrite()
                stream.write(bytes)
                file.finishWrite(stream)
            } catch (error: Exception) {
                file.failWrite(stream)
                Log.e("UsageStore", "Usage persistence failed", error)
                main.post { if (!closed && !failed) { failed = true; onFailure() } }
            }
        }
    }

    fun close() {
        closed = true
        writer.shutdown()
        main.removeCallbacksAndMessages(null)
    }
}
