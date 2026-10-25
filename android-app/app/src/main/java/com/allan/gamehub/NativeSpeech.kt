package com.allan.gamehub

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import org.json.JSONObject
import java.util.Locale

/** 只保留最近一句，切游戏、失焦和暂停取消；每条回调绑定原请求。 */
class NativeSpeech(context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private var ready = false
    private var unavailable = false
    private var engine: TextToSpeech? = null
    private var pending: Pair<String, (String) -> Unit>? = null
    private var currentId: String? = null
    private var utteranceId: String? = null
    private var reply: ((String) -> Unit)? = null
    private var closed = false
    private val initializationTimeout = Runnable {
        if (!ready && !closed) {
            unavailable = true
            engine?.stop()
            engine?.shutdown()
            engine = null
            val request = pending
            pending = null
            if (request != null) speak(request.first, request.second)
        }
    }

    init {
        main.postDelayed(initializationTimeout, 8_000L)
        engine = TextToSpeech(context.applicationContext) { status ->
            main.post {
                if (!closed && !unavailable) {
                    main.removeCallbacks(initializationTimeout)
                    unavailable = status != TextToSpeech.SUCCESS
                    ready = !unavailable
                    val request = pending
                    pending = null
                    if (request != null) speak(request.first, request.second)
                }
            }
        }
        engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) { deliver(utteranceId, "started") }
            override fun onDone(utteranceId: String?) { deliver(utteranceId, "done") }
            @Deprecated("Android callback")
            override fun onError(utteranceId: String?) { deliver(utteranceId, "error") }
            override fun onError(utteranceId: String?, errorCode: Int) { deliver(utteranceId, "error") }
        })
    }

    fun speak(payload: String, callback: (String) -> Unit) {
        stop()
        if (closed) return
        val data = JSONObject(payload)
        val id = data.optString("id").take(100)
        val text = data.optString("text").trim().take(300)
        if (!ready && !unavailable) {
            pending = payload to callback
            return
        }
        currentId = id
        reply = callback
        if (unavailable || id.isBlank() || text.isBlank()) { finishError("系统英语朗读尚未就绪"); return }
        val tts = engine ?: run { finishError("系统朗读不可用"); return }
        val language = tts.setLanguage(Locale.US)
        if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
            finishError("系统缺少英语语音，请安装英语文字转语音数据")
            return
        }
        tts.setSpeechRate(0.85f)
        utteranceId = java.util.UUID.randomUUID().toString()
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId) == TextToSpeech.ERROR) finishError("系统朗读未能启动")
    }

    private fun finishError(message: String) {
        val id = currentId ?: return
        val callback = reply
        currentId = null
        reply = null
        callback?.invoke(JSONObject().put("type", "speech").put("id", id).put("status", "error").put("message", message).toString())
    }

    private fun deliver(id: String?, status: String) {
        main.post {
            if (closed || id == null || id != utteranceId) return@post
            reply?.invoke(JSONObject().put("type", "speech").put("id", currentId).put("status", status).toString())
            if (status != "started") { currentId = null; reply = null }
        }
    }

    fun stop() {
        pending = null
        utteranceId = null
        currentId = null
        reply = null
        engine?.stop()
    }

    fun close() {
        closed = true
        stop()
        engine?.shutdown()
        main.removeCallbacksAndMessages(null)
    }
}
