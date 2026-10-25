package com.allan.gamehub

import android.annotation.SuppressLint
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebResourceErrorCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.time.LocalDate

/** 平板竖屏入口与受控容器；只有当前受信网页能连接原生能力。 */
class MainActivity : ComponentActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private lateinit var ledger: UsageLedger
    private lateinit var store: UsageStore
    private lateinit var speech: NativeSpeech
    private var webView: WebView? = null
    private var gameHost: FrameLayout? = null
    private var pausePanel: View? = null
    private var statusLabel: TextView? = null
    private var studyLabel: TextView? = null
    private var studyProgress: ProgressBar? = null
    private var dayLabel: TextView? = null
    private val quotaLabels = mutableMapOf<GameId, TextView>()
    private lateinit var hub: GameHubApplication
    private val persistenceListener: () -> Unit = { persistenceFailed() }
    private var resumed = false
    private var hostPaused = false
    private var storageBroken = false
    private var lastTrustedInput = -10_000L
    private var bridgeReady = false
    private var lastBridgeAt = 0L
    private var loadingPanel: View? = null
    private val pageBackground = Color.rgb(245, 247, 251)
    private val ink = Color.rgb(23, 43, 65)
    private val muted = Color.rgb(95, 115, 134)
    private val accent = Color.rgb(0, 119, 110)
    private val ticker = object : Runnable {
        override fun run() {
            if (isFinishing || isDestroyed) return
            advance()
            updateLabels()
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        root = FrameLayout(this).apply { setBackgroundColor(pageBackground) }
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        WindowCompat.getInsetsController(window, root).isAppearanceLightStatusBars = true
        hub = application as GameHubApplication
        store = hub.store
        ledger = hub.ledger
        storageBroken = hub.storageBroken
        hub.onPersistenceFailure = persistenceListener
        speech = NativeSpeech(this)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView != null) showHome() else finish()
            }
        })
        showHome()
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        if (!::ledger.isInitialized) return
        ledger.setForeground(hasWindowFocus(), now())
        webView?.onResume()
        handler.removeCallbacks(ticker)
        handler.post(ticker)
    }

    override fun onPause() {
        if (::ledger.isInitialized) {
            advance()
            if (webView != null) pauseGame(UsageStop.NONE, R.string.pause_background)
            ledger.setForeground(false, now())
            persistUsage()
            speech.stop()
            webView?.onPause()
        }
        resumed = false
        handler.removeCallbacks(ticker)
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!::ledger.isInitialized || !resumed) return
        advance()
        ledger.setForeground(hasFocus, now())
        if (!hasFocus && webView != null) pauseGame(UsageStop.NONE, R.string.pause_background)
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (webView != null && !hostPaused && event.actionMasked in listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_MOVE)) {
            noteInput()
        }
        return super.dispatchTouchEvent(event)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (webView != null && !hostPaused && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0 && !event.isAltPressed && !event.isCtrlPressed && !event.isMetaPressed) noteInput()
        return super.dispatchKeyEvent(event)
    }

    private fun noteInput() {
        advance()
        lastTrustedInput = now()
        ledger.interaction(lastTrustedInput)
    }

    private fun advance() {
        if (!::ledger.isInitialized) return
        val event = ledger.tick(now(), LocalDate.now())
        persistUsage()
        if (webView != null && !hostPaused && now() - lastBridgeAt > (if (bridgeReady) UsageLedger.HEARTBEAT_LIMIT else 15_000L)) {
            pauseGame(UsageStop.DISCONNECTED, R.string.pause_connection)
        }
        if (webView != null && event != UsageStop.NONE && !hostPaused) {
            val message = when (event) {
                UsageStop.IDLE -> R.string.pause_idle
                UsageStop.DISCONNECTED -> R.string.pause_connection
                UsageStop.EXHAUSTED -> R.string.pause_quota
                UsageStop.NEW_DAY -> R.string.pause_new_day
                UsageStop.CLOCK_CHANGED -> R.string.pause_clock
                else -> R.string.pause_background
            }
            pauseGame(event, message)
        }
    }

    private fun persistUsage() {
        if (!storageBroken && !hub.storageBroken) store.save(ledger.daily)
    }

    private fun persistenceFailed() {
        storageBroken = true
        ledger.state(false, now())
        if (webView != null) pauseGame(UsageStop.NONE, R.string.storage_failure) else showHome()
    }

    private fun showHome() {
        if (::ledger.isInitialized) { advance(); ledger.select(null, now()); persistUsage() }
        speech.stop()
        destroyWebView()
        root.removeAllViews()
        gameHost = null
        pausePanel = null
        statusLabel = null
        hostPaused = false
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        quotaLabels.clear()
        val scroll = ScrollView(this).apply { isFillViewport = true; clipToPadding = false }
        val centered = FrameLayout(this)
        val content = column().apply { setPadding(dp(24), dp(30), dp(24), dp(30)) }
        centered.addView(content, FrameLayout.LayoutParams(if (resources.configuration.screenWidthDp > 760) dp(760) else -1, -2, Gravity.TOP or Gravity.CENTER_HORIZONTAL))
        scroll.addView(centered)
        root.addView(scroll, FrameLayout.LayoutParams(-1, -1))
        content.addView(text(getString(R.string.app_name), 15f, accent, true))
        content.addView(text(getString(R.string.home_title), 30f, ink, true), spaced(10))
        content.addView(text(getString(R.string.home_subtitle), 16f, muted), spaced(10))
        val progressCard = card()
        dayLabel = text("", 14f, accent, true)
        progressCard.addView(dayLabel)
        studyLabel = text("", 23f, ink, true)
        progressCard.addView(studyLabel, spaced(12))
        studyProgress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = UsageLedger.STUDY_TARGET.toInt()
            progressTintList = android.content.res.ColorStateList.valueOf(accent)
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(223, 237, 234))
        }
        progressCard.addView(studyProgress, LinearLayout.LayoutParams(-1, dp(9)).apply { topMargin = dp(18) })
        progressCard.addView(text(getString(R.string.daily_rule), 14f, muted), spaced(14))
        content.addView(progressCard, spaced(24))
        content.addView(text(getString(R.string.games_title), 20f, ink, true), spaced(28))
        for (game in GameId.entries) {
            val gameCard = card()
            val color = when (game) { GameId.ENGLISH -> accent; GameId.CAR -> Color.rgb(169, 96, 35); GameId.FLIGHT -> Color.rgb(55, 100, 160) }
            gameCard.addView(text(gameTitle(game), 23f, color, true))
            val description = when (game) { GameId.ENGLISH -> R.string.english_description; GameId.CAR -> R.string.car_description; GameId.FLIGHT -> R.string.flight_description }
            gameCard.addView(text(getString(description), 15f, muted), spaced(8))
            val quota = text("", 15f, ink, true)
            quotaLabels[game] = quota
            gameCard.addView(quota, spaced(16))
            val label = if (game == GameId.ENGLISH) R.string.open_english else R.string.open_game
            gameCard.addView(button(getString(label), color) {
                if (game != GameId.ENGLISH && !ledger.daily.unlocked) openGame(GameId.ENGLISH) else openGame(game)
            }, spaced(16))
            content.addView(gameCard, spaced(16))
        }
        content.addView(text(getString(R.string.idle_rule), 14f, muted), spaced(22))
        updateLabels()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun openGame(game: GameId) {
        advance()
        if (storageBroken || !ledger.canOpen(game)) {
            android.app.AlertDialog.Builder(this).setMessage(if (storageBroken) getString(R.string.storage_failure) else getString(if (ledger.clockInvalid) R.string.pause_clock else R.string.pause_quota)).setPositiveButton(R.string.close, null).show()
            return
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            android.app.AlertDialog.Builder(this).setMessage(R.string.webview_upgrade).setPositiveButton(R.string.close, null).show()
            return
        }
        speech.stop()
        destroyWebView()
        ledger.select(game, now())
        ledger.setForeground(resumed && hasWindowFocus(), now())
        hostPaused = false
        bridgeReady = false
        lastBridgeAt = now()
        root.removeAllViews()
        studyLabel = null; studyProgress = null; dayLabel = null; quotaLabels.clear()
        val layout = column()
        val toolbar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), dp(4), dp(12), dp(4)); setBackgroundColor(Color.WHITE) }
        toolbar.addView(button(getString(R.string.home), accent) { showHome() }, LinearLayout.LayoutParams(dp(86), dp(48)))
        toolbar.addView(text(gameTitle(game), 17f, ink, true), LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dp(14) })
        statusLabel = text("", 14f, accent, true)
        toolbar.addView(statusLabel)
        layout.addView(toolbar, LinearLayout.LayoutParams(-1, dp(60)))
        val host = FrameLayout(this)
        gameHost = host
        val view = WebView(this)
        webView = view
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = true
            setSupportMultipleWindows(false)
        }
        view.setBackgroundColor(Color.rgb(13, 23, 37))
        val loader = WebViewAssetLoader.Builder().setDomain(Uri.parse(game.origin).host!!)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        view.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (!allowedResource(game, request.url)) return blockedResponse()
                return loader.shouldInterceptRequest(request.url) ?: blockedResponse()
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = request.url.toString().substringBefore('?').substringBefore('#') != game.entryUrl
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceErrorCompat) {
                if (request.isForMainFrame && view === webView) pauseGame(UsageStop.NONE, R.string.page_error)
            }
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                if (view === webView) {
                    ledger.state(false, now()); speech.stop(); destroyWebView(); showHome()
                    android.app.AlertDialog.Builder(this@MainActivity).setMessage(R.string.renderer_error).setPositiveButton(R.string.close, null).show()
                }
                return true
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                if (BuildConfig.DEBUG) android.util.Log.d("GameWebView", "${message.message()} (${message.lineNumber()})")
                return true
            }
        }
        WebViewCompat.addWebMessageListener(view, "AndroidHost", setOf(game.origin)) { sender, message, sourceOrigin, mainFrame, reply ->
            if (!mainFrame || sender !== webView || sourceOrigin.toString().trimEnd('/') != game.origin || ledger.game != game) return@addWebMessageListener
            val payload = message.data ?: return@addWebMessageListener
            if (payload.length > 4096) return@addWebMessageListener
            try {
                val data = JSONObject(payload)
                when (data.optString("type")) {
                    "state" -> {
                        advance()
                        bridgeReady = true
                        lastBridgeAt = now()
                        loadingPanel?.let { gameHost?.removeView(it) }
                        loadingPanel = null
                        val requestedActive = data.optBoolean("eligible", false)
                        if (hostPaused && requestedActive) sender.evaluateJavascript("window.AndroidShell?.pause('native')", null)
                        val active = requestedActive && !hostPaused && !storageBroken
                        ledger.state(active, now())
                    }
                    "activity" -> if (!hostPaused && now() - lastTrustedInput <= 1_000L) ledger.interaction(now())
                    "speak" -> if (!hostPaused && resumed && hasWindowFocus()) speech.speak(payload) { result ->
                        if (sender === webView && !hostPaused && resumed && ledger.game == game) reply.postMessage(result)
                    }
                    "stopSpeech" -> speech.stop()
                }
            } catch (error: Exception) { android.util.Log.w("GameHub", "Invalid game bridge message", error) }
        }
        host.addView(view, FrameLayout.LayoutParams(-1, -1))
        layout.addView(host, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(layout, FrameLayout.LayoutParams(-1, -1))
        val loading = FrameLayout(this).apply { setBackgroundColor(pageBackground); isClickable = true }
        val loadingContent = column().apply { gravity = Gravity.CENTER; setPadding(dp(24), dp(24), dp(24), dp(24)) }
        loadingContent.addView(ProgressBar(this))
        loadingContent.addView(text(getString(R.string.connecting_game), 18f, ink), spaced(18))
        loadingContent.addView(button(getString(R.string.back_home), accent) { showHome() }, spaced(18))
        loading.addView(loadingContent, FrameLayout.LayoutParams(-1, -2, Gravity.CENTER))
        host.addView(loading, FrameLayout.LayoutParams(-1, -1))
        loadingPanel = loading
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        view.loadUrl(game.entryUrl)
        updateLabels()
    }

    private fun allowedResource(game: GameId, uri: Uri): Boolean {
        if (uri.scheme != "https" || uri.host != Uri.parse(game.origin).host || uri.port !in listOf(-1, 443)) return false
        val path = uri.path ?: return false
        return path.startsWith("/assets/games/${game.directory}/") && !path.split('/').contains("..")
    }

    private fun blockedResponse() = WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    private fun pauseGame(reason: UsageStop, message: Int) {
        if (webView == null) return
        hostPaused = true
        ledger.state(false, now())
        speech.stop()
        webView?.evaluateJavascript("window.AndroidShell?.pause(${JSONObject.quote(reason.name.lowercase())})", null)
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        pausePanel?.let { gameHost?.removeView(it) }
        val overlay = FrameLayout(this).apply { setBackgroundColor(Color.argb(230, 241, 246, 250)); isClickable = true; isFocusable = true }
        val content = card()
        content.addView(text(getString(R.string.paused_title), 25f, ink, true))
        content.addView(text(getString(message), 17f, muted), spaced(14))
        val game = ledger.game
        if (!storageBroken && game != null && ledger.canOpen(game)) {
            content.addView(button(getString(R.string.continue_game), accent) { resumeGame() }, spaced(22))
        }
        content.addView(button(getString(R.string.back_home), muted) { showHome() }, spaced(10))
        overlay.addView(content, FrameLayout.LayoutParams(if (resources.configuration.screenWidthDp > 560) dp(480) else -1, -2, Gravity.CENTER).apply { leftMargin = dp(24); rightMargin = dp(24) })
        gameHost?.addView(overlay, FrameLayout.LayoutParams(-1, -1))
        pausePanel = overlay
        overlay.requestFocus()
    }

    private fun resumeGame() {
        advance()
        val game = ledger.game ?: return
        if (storageBroken || !ledger.canOpen(game)) { pauseGame(UsageStop.EXHAUSTED, R.string.pause_quota); return }
        if (!bridgeReady) { pauseGame(UsageStop.DISCONNECTED, R.string.pause_connection); return }
        lastBridgeAt = now()
        pausePanel?.let { gameHost?.removeView(it) }
        pausePanel = null
        hostPaused = false
        ledger.interaction(now())
        ledger.setForeground(resumed && hasWindowFocus(), now())
        ledger.state(false, now())
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        webView?.requestFocus()
        webView?.evaluateJavascript("window.AndroidShell?.resume()", null)
    }

    private fun destroyWebView() {
        loadingPanel = null
        webView?.let { view ->
            webView = null
            (view.parent as? ViewGroup)?.removeView(view)
            view.stopLoading()
            view.destroy()
        }
    }

    private fun updateLabels() {
        if (!::ledger.isInitialized) return
        val daily = ledger.daily
        dayLabel?.text = getString(if (daily.allowanceMillis == 18 * 60_000L) R.string.weekend_label else R.string.weekday_label)
        studyLabel?.text = when {
            storageBroken -> getString(R.string.storage_failure)
            ledger.clockInvalid -> getString(R.string.pause_clock)
            daily.unlocked -> getString(R.string.study_complete)
            else -> getString(R.string.study_progress, duration(daily.studyMillis))
        }
        studyProgress?.progress = daily.studyMillis.toInt()
        for ((game, label) in quotaLabels) label.text = when {
            storageBroken -> getString(R.string.unavailable)
            game == GameId.ENGLISH -> getString(if (daily.unlocked) R.string.english_unlimited else R.string.english_required)
            !daily.unlocked -> getString(R.string.locked)
            else -> getString(R.string.quota_remaining, duration(daily.remaining(game)))
        }
        ledger.game?.let { game -> statusLabel?.text = getString(if (game == GameId.ENGLISH) R.string.study_toolbar else R.string.quota_toolbar, duration(daily.remaining(game))) }
    }

    private fun gameTitle(game: GameId): String = getString(when (game) { GameId.ENGLISH -> R.string.game_english; GameId.CAR -> R.string.game_car; GameId.FLIGHT -> R.string.game_flight })
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun card() = column().apply { setPadding(dp(22), dp(22), dp(22), dp(22)); background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(22).toFloat() } }
    private fun text(value: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size; setTextColor(color); setLineSpacing(dp(4).toFloat(), 1f)
        if (bold) typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    private fun button(value: String, color: Int, action: () -> Unit) = Button(this).apply {
        text = value; isAllCaps = false; textSize = 16f; setTextColor(Color.WHITE); minHeight = dp(52)
        backgroundTintList = android.content.res.ColorStateList.valueOf(color)
        setOnClickListener { action() }
    }
    private fun spaced(top: Int) = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(top) }
    private fun dp(value: Int) = (resources.displayMetrics.density * value).toInt()
    private fun now() = SystemClock.elapsedRealtime()
    private fun duration(milliseconds: Long): String {
        val seconds = (milliseconds + 999) / 1000
        return String.format(java.util.Locale.ROOT, "%02d:%02d", seconds / 60, seconds % 60)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (::ledger.isInitialized) { ledger.state(false, now()); persistUsage() }
        if (::hub.isInitialized && hub.onPersistenceFailure === persistenceListener) hub.onPersistenceFailure = null
        if (::speech.isInitialized) speech.close()
        destroyWebView()
        super.onDestroy()
    }
}
