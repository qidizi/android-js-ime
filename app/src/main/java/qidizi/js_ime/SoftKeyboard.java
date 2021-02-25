package qidizi.js_ime;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.inputmethodservice.InputMethodService;
import android.os.*;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.text.TextUtils;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.*;
import android.widget.Toast;
import androidx.annotation.RequiresApi;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class SoftKeyboard extends InputMethodService {
    final static String LOG_TAG = "js_ime";
    static String js_listener = null;
    // java方法提供给js的命名空间
    private final static String JS_NAME = "JAVA";
    // web文件目录
    final static String PUBLIC_DIR = "web";
    // 内置默认html
    final static String DEFAULT_HTML = PUBLIC_DIR + "/index.html";
    // 访问assets目录下的web文件使用的协议
    private final static String ASSET_PROTO = "file:///android_asset/";
    private WebView webView = null;
    private Intent speechIntent = null;
    private SpeechRecognizer speech_recognizer = null;

    private void send_key_event(int action, int key_code, int repeat, int meta_state) {
        // 向当前绑定到键盘的应用发送键盘事件
        InputConnection ic = getCurrentInputConnection();
        long down_time = SystemClock.uptimeMillis();
        long event_happen_time = SystemClock.uptimeMillis();
        // 可以组合，表示控制键是否按下了,meta_state是按bit运算，只有指定位为1才表示on
        // 这些常量是经过精心设计的，所有不会出现bit位冲突问题

        // 如

        // META_ALT_LEFT_ON bit 为 10000
        // META_ALT_ON bit 10
        // META_ALT_RIGHT_ON bit 100000
        // META_ALT_MASK bit 为110010

        // META_ALT_LEFT_ON | META_ALT_ON | META_ALT_RIGHT_ON == META_ALT_MASK
        // 如查询3个键状态时表示所有键都按下了，若只查询某个键即表示该键是按下状态

        // 如查询 右 alt是否按下，作 META_ALT_MASK & META_ALT_RIGHT_ON == META_ALT_RIGHT_ON
        // 如查询 左和右alt是否按下，作 META_ALT_MASK & META_ALT_RIGHT_ON ＆ META_ALT_LEFT_ON
        // == META_ALT_RIGHT_ON ＆ META_ALT_LEFT_ON

        // 其它以此类推
        // 来源：0 表示是来自虚拟设备（不是物理设备），其它值表示是物理设备如蓝牙耳机
        int device_id = 0;
        // 硬件层面处理码，如打印机对于1，不同字体对应不同打印字
        int scan_code = 0;
        // 表示长按时，定时自动发送按下事件序号，比如长按中共发送3次0、1、2，那么某些应用就可以选择只处理首次，其它忽视
        // 比如防止用户放开时手慢本意按一次却变长按发送n次按下事件而执行多次操作
        if (KeyEvent.ACTION_DOWN != action || repeat < 0) repeat = 0;
        // 控制键像alt、shift、ctrl是否按下了
        if (meta_state < 0) meta_state = 0;
        // 击键来自虚拟键盘
        int flags = KeyEvent.FLAG_SOFT_KEYBOARD;
        // 表示击键来自键盘，还有屏幕触摸，游戏柄之类
        int source = InputDevice.SOURCE_KEYBOARD;
        KeyEvent ke = new KeyEvent(
                down_time,
                event_happen_time,
                action,
                key_code,
                // 像按下后，第几次自动发送的按下事件，比如给某些长按下只当一次处理的程序使用，那么它就可以只使用0这个后面都忽视
                // 还有就是多个按键事件的事件数
                repeat,
                meta_state,
                device_id,
                scan_code,
                flags,
                source
        );
        ic.sendKeyEvent(ke);
    }

    //--------------供js调用方法-------

    //    // TODO 注意暴露给js的方法必须是public，包内是不行的
    //    @JavascriptInterface
    //    public void send_key_down(int key_code, int repeat, int meta_state) {
    //        send_key_event(KeyEvent.ACTION_DOWN, key_code, repeat, meta_state);
    //    }
    //
    //    @JavascriptInterface
    //    public void send_key_up(int key_code, int meta_state) {
    //        send_key_event(KeyEvent.ACTION_UP, key_code, 0, meta_state);
    //    }

    @JavascriptInterface
    public void send_key_press(int key_code, int meta_state) {
        // 不熟悉的人可能很难做到按合理逻辑处理好down与up成对出现问题，最后导致出现意外效果，
        // 所以，建议只给web提供这个即可
        send_key_event(KeyEvent.ACTION_DOWN, key_code, 0, meta_state);
        send_key_event(KeyEvent.ACTION_UP, key_code, 0, 0);
    }

    @JavascriptInterface
    public void send_text(String text) {
        // 发送的是字符串，非android支持的KEYCODE
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) return;
        ic.beginBatchEdit();// 提示输入框，只有收到end事件才代表本次输入结束
        // 指针移动到最后,1表示插入字符并移动到最后
        ic.commitText(text, 1);
        ic.endBatchEdit();
    }

    @JavascriptInterface
    public void reload() {
        // 重新加载，比如载入html;因为这个类是运行在其它线程，需要操作ui要把处理扔给ui线程处理
        webView.post(new Runnable() {
            @Override
            public void run() {
                reload_webview();
            }
        });
    }

    /**
     * js 加载ok后给java通知，并注册回调方法
     *
     * @param js_listener_fn js function name
     */
    @JavascriptInterface
    public void js_onload(String js_listener_fn) {
        js_listener = js_listener_fn;
    }

    @JavascriptInterface
    public void stop_speech_recognizer() {
        if (null == speech_recognizer) return;

        Handler mainHandler = new Handler(getMainLooper());
        Runnable myRunnable = new Runnable() {
            @Override
            public void run() {
                speech_recognizer.stopListening();
            }
        };
        mainHandler.post(myRunnable);
    }

    @JavascriptInterface
    public void cancel_speech_recognizer() {
        if (null == speech_recognizer) return;

        Handler mainHandler = new Handler(getMainLooper());
        Runnable myRunnable = new Runnable() {
            @Override
            public void run() {
                speech_recognizer.cancel();
            }
        };
        mainHandler.post(myRunnable);
    }

    @JavascriptInterface
    public void open_speech_recognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            dbg("没有可用的语音引擎");
            SoftKeyboard.emit_js_str(webView,
                    "speech_recognizer_on_error", "没有可用的语音引擎");
            return;
        }

        if (!can_use_internet()) {
            SoftKeyboard.emit_js_str(webView,
                    "speech_recognizer_on_error", "请授予本输入法网络权限才能使用语音识别功能");
            return;
        }

        if (PackageManager.PERMISSION_DENIED == checkCallingOrSelfPermission(Manifest.permission.RECORD_AUDIO)) {
            SoftKeyboard.emit_js_str(webView,
                    "speech_recognizer_on_error", "请授予本输入法录音权限才能使用语音识别功能");
            return;
        }

        Handler mainHandler = new Handler(getMainLooper());
        Runnable myRunnable = new Runnable() {
            @Override
            public void run() {
                if (null == speech_recognizer)
                    create_speech_recognizer();

                if (null == speech_recognizer) {
                    SoftKeyboard.emit_js_str(webView,
                            "speech_recognizer_on_error", "无法创建语音识别服务");
                    return;
                }

                if (null == speechIntent) create_intent();

                // 小米9设置语音输入为小爱同学时，会出现无法绑定的异常，需要去掉勾选成讯飞语记才能使用；
                // 且没有错误提示

                // 2021-02-25 00:32:06.949 20528-20528/qidizi.js_ime E/SpeechRecognizer: bind to recognition service failed
                speech_recognizer.startListening(speechIntent);
                SoftKeyboard.emit_js_str(webView,
                        "speech_recognizer_on_tip", "讯飞语记启动中...本提示久未消失请先打开语记试用确保可以语音识别成文字,如允许录音、联网等权限");
            }
        };
        mainHandler.post(myRunnable);
    }

    private void create_intent() {
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        // 识别结束用途，如网络查找，可能要提炼关键字
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        // 不支持边说边识别，只能说完再识别
        speechIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        // 只要一个识别结果
        speechIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
    }

    private void create_speech_recognizer() {
        ComponentName componentName = null;
        // 如果是小米,默认是小爱; 就算是在输入法语音引擎中首先其它,这个方法返回的也是小爱
        // 目前无法调用小米的小爱,会被链式启动规则禁用
//        String serviceComponent = Settings.Secure.getString(getContentResolver(),
//                "voice_recognition_service");
//
//        if (TextUtils.isEmpty(serviceComponent)) {
//            dbg("没有可用的语音引擎");
//            SoftKeyboard.emit_js_str(webView,
//                    "speech_recognizer_on_error", "没有可用的语音引擎");
//            return;
//        }
//        componentName = ComponentName.unflattenFromString(serviceComponent);


     //   dbg("当前默认语音引擎:" + serviceComponent);

        final List<ResolveInfo> list = getPackageManager().queryIntentServices(
                new Intent(RecognitionService.SERVICE_INTERFACE), 0);

        dbg("语音识别引擎个数:" + list.size());
        String pn ;

        for (ResolveInfo item : list) {
            pn = item.serviceInfo.packageName + "/" + item.serviceInfo.name;
            dbg("语音识别引擎:" + pn);

            if (!"com.iflytek.vflynote".equals(item.serviceInfo.packageName)) {
                continue;
            }

            dbg("已安装讯飞语记");
            componentName = ComponentName.unflattenFromString(pn);
            break;
        }

        if (componentName == null) {
            SoftKeyboard.emit_js_str(webView,
                    "speech_recognizer_on_error", "请安装讯飞语记");
            dbg("未安装讯飞语记");
            return;
        }

        // 还要讯飞语记能使用网络,mic等权限,才能使用,建议先用它试一下正常了再试
        speech_recognizer = SpeechRecognizer.createSpeechRecognizer(this, componentName);
        speech_recognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onError(int i) {
                String error;
                switch (i) {
                    case SpeechRecognizer.ERROR_AUDIO:
                        error = "录制异常";
                        break;
                    case SpeechRecognizer.ERROR_CLIENT:
                        error = "tts组件异常";
                        break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                        error = "请授予讯飞语记录音权限";
                        break;
                    case SpeechRecognizer.ERROR_NETWORK:
                        error = "tts网络异常";
                        break;
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                        error = "tts网络超时";
                        break;
                    case SpeechRecognizer.ERROR_NO_MATCH:
                        error = "无法识别";
                        break;
                    case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                        error = "tts正被使用，请稍候";
                        break;
                    case SpeechRecognizer.ERROR_SERVER:
                        error = "tts服务异常";
                        break;
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                        error = "等待语音输入超时";
                        break;
                    default:
                        error = "未明错误代号：" + i;
                        break;
                }
                // 如小米9，设置语音识别为小爱同学时，收不到这个错误： 11059-11059/qidizi.js_ime E/SpeechRecognizer: bind to recognition service failed
                dbg("出错了（" + error + "）");
                SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_error", "出错了（" + error + "）");
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String result = "";

                if (null != matches && matches.size() > 0) {
                    // 识别出文字，异步通知给js
                    result = matches.get(0);
                }

                SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_result", result);
            }

            @Override
            public void onPartialResults(Bundle bundle) {
                // 必须重写
                // SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_tip", "部分识别...");
            }

            @Override
            public void onEvent(int i, Bundle bundle) {
                // 必须重写
                dbg("onEvent（" + i + "）");
            }

            @Override
            public void onBufferReceived(byte[] bytes) {
                // 必须重写
                dbg("onBufferReceived " + bytes.length);
            }

            @Override
            public void onEndOfSpeech() {
                SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_recognizing", "识别中...");
            }

            @Override
            public void onBeginningOfSpeech() {
                // 必须重写
                SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_tip", "监听到声音...");
            }

            @Override
            public void onRmsChanged(float v) {
                // 必须重写
                dbg("onRmsChanged " + v);
            }

            @Override
            public void onReadyForSpeech(Bundle bundle) {
                SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_listening", "请说话...");
            }
        });
        dbg("创建语音实例");
    }


    @Override
    public void onCreate() {
        // 必须调用super
        super.onCreate();
    }

    private void dbg(String msg) {
        Log.d(LOG_TAG, msg);
    }

    /**
     * 方法用于用户界面初始化，主要用于service运行过程中配置信息发生改变的情况（横竖屏转换等）。
     */
    @Override
    public void onInitializeInterface() {
        super.onInitializeInterface();
        create_webview();
    }

    /**
     * 方法用于创建并返回（input area）输入区域的层次视图，该方法只被调用一次（输入区域第一次显示时），
     * 该方法可以返回null，此时输入法不存在输入区域，InputMethodService的默认方法实现返回值为空，
     * 想要改变已经创建的输入区域视图，我们可以调用setInputView(View)方法，想要控制何时显示输入视图，
     * 我们可以实现onEvaluateInputViewShown方法，该方法用来判断输入区域是否应该显示，
     * 在updateInputViewShown方法中会调用onEvaluateInputViewShown方法来判断是否显示输入区域。
     *
     * @return View
     */
    @Override
    public View onCreateInputView() {
        if (null != webView && null != webView.getParent()) {
            // 可能会重复添加，比如屏幕翻转时会出现；目前不想重新创建webview
            // 防止出现 java.lang.IllegalStateException:
            // The specified child already has a parent.
            // You must call removeView() on the child's parent first.
            ((ViewGroup) webView.getParent()).removeAllViews();
        }

        return webView;
    }

    private String get_user_html_path() {
        // 检测用户自定义html是否存在
        if (!Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState()) &&
                !Environment.MEDIA_MOUNTED_READ_ONLY.equals(Environment.getExternalStorageState()))
            return null;

        File use_index = new File(getExternalFilesDir(null), "index.html");


        if (!use_index.exists())
            return null;

        // 优先使用用户的文件
        return "file://" + use_index.getAbsolutePath();
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface", "AddJavascriptInterface"})
    private void create_webview() {
        // 防止重复创建，以内存换html启动时间
        if (null != webView) return;
        String tmp = get_user_html_path();
        // 优先使用用户文件
        final String url = tmp == null ? ASSET_PROTO + DEFAULT_HTML : tmp;
        final SoftKeyboard skb = this;
        webView = new WebView(this);

        WebSettings webSettings = webView.getSettings();
        // 要允许，否则无法加入js等
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setAppCacheEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE); // 无缓存
        webSettings.setDatabaseEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setUserAgentString(webSettings.getUserAgentString() + " in_android js_ime");

        if (Build.VERSION.SDK_INT >= 26)
            // 检查网址是否安全
            webSettings.setSafeBrowsingEnabled(false);

        if (Build.VERSION.SDK_INT >= 21)
            // http+https是否允许
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // web允许执行js
        webSettings.setJavaScriptEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        // 可能需要更小的字体来显示键盘文字，值范围1～72
        webSettings.setMinimumFontSize(1);
        webSettings.setMinimumLogicalFontSize(1);
        // 支持 <meta name="viewport" content="width=device-width,
        webSettings.setUseWideViewPort(true);

        // 区域适应内容
        //webView.setLayoutMode(ViewGroup.LayoutParams.WRAP_CONTENT);
        // 把指定java方法暴露给js
        webView.addJavascriptInterface(this, JS_NAME);
        // 一般键盘会把输入的app界面上推，如果透明时就会看到桌面背景
        webView.setBackgroundColor(Color.TRANSPARENT);
        WebView.setWebContentsDebuggingEnabled(true);//允许调试web

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                // 总是弹出给用户，防止自定义时空白页不知道原因
                SoftKeyboard.emit_js_str(
                        webView,
                        "console_log",
                        consoleMessage.lineNumber() + "#" + consoleMessage.message()
                );
                return super.onConsoleMessage(consoleMessage);
            }
        });
        // webview内部不允许通过触摸或是物理键盘切换焦点
        webView.setFocusable(false);
        // logcat要设置成info级别才能看到异常，像：
        // 10842-10842/qidizi.js_ime I/chromium: [INFO:CONSOLE(0)]
        // "Failed to load module script: The server responded with a non-JavaScript MIME type of "".
        // Strict MIME type checking is enforced for module scripts per HTML spec.",
        // source: file:///android_asset/web/index.js?1569008605055 (0)
        can_use_internet();
        webView.loadUrl(url);
    }

    private boolean can_use_internet() {
        if (PackageManager.PERMISSION_DENIED == checkCallingOrSelfPermission(Manifest.permission.INTERNET)) {
            Toast.makeText(this, "请授予本输入法网络权限,否则无法访问录音或是网络资源", Toast.LENGTH_SHORT).show();
            return false;
        }

        // todo 小米9,没有授权,也返回了0;其实是不正确的
        return true;
    }

    void reload_webview() {
        // 重新走：优先使用存在的自定义html，否则使用默认
        if (null == webView) return;

        can_use_internet();
        String url = get_user_html_path();

        if (null == url) {
            // 优先使用用户html
            url = ASSET_PROTO + DEFAULT_HTML;
        }

        webView.loadUrl(url);
    }

    /**
     * onStartInputView方法 输入视图正在显示并且编辑框输入已经开始的时候回调该方法，
     * onStartInputView方法总会在onStartInput方法之后被调用，普通的设置可以在onStartInput方法中进行，
     * 在onStartInputView方法中进行视图相关的设置，开发者应该保证onCreateInputView方法在该方法被调用之前调用。
     *
     * @param info       输入框的信息
     * @param restarting 是否重新启动
     */
    @Override
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        // 给web通知当前绑定的输入框信息，如可输入类型
        emit_js(info, restarting);
    }

    private void destroy_webview() {
        if (webView != null) {
            // 这样处理防止有内存问题
            // 因为本方法运行在其它线程，不能直接调用webview的方法，否则将引起
            // java.lang.Throwable: A WebView method was called on thread 'JavaBridge'.
            // All WebView methods must be called on the same thread
            // 所以，把待执行方法放入它的队列
            // 如切换到其它输入法再切回来，webview被destroy但是JsInterface并没有重置
            js_listener = null;
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.loadUrl("about:blank");
                    webView.clearHistory();
                    ((ViewGroup) webView.getParent()).removeView(webView);
                    webView.destroy();
                    webView = null;
                }
            });
        }
    }


    @Override
    public void onDestroy() {
        destroy_webview();
        super.onDestroy();
    }

    private void emit_js(EditorInfo info, boolean restarting) {
        // 把输入框信息传递给web
        JSONObject js = new JSONObject();
        String str = null;
        String type = "text";

        switch (info.inputType & EditorInfo.TYPE_MASK_CLASS) {
            case EditorInfo.TYPE_CLASS_NUMBER:
            case EditorInfo.TYPE_CLASS_DATETIME:
            case EditorInfo.TYPE_CLASS_PHONE:
                type = "number";
        }

        try {
            js.put("inputType", type);
            js.put("restarting", restarting);
            str = js.toString();
        } catch (Exception e) {
            e.printStackTrace();
        }

        emit_js(
                webView,
                Thread.currentThread().getStackTrace()[3].getMethodName(),
                str
        );
    }

    static void emit_js_str(WebView wv, @SuppressWarnings("SameParameterValue") String event_type, String str) {
        // 给web发送参数为字符串的通知
        JSONObject js = new JSONObject();

        try {
            js.put("text", str);
            str = js.toString();
        } catch (Exception e) {
            e.printStackTrace();
        }

        emit_js(
                wv,
                event_type,
                str
        );
    }

    /**
     * 通知js
     *
     * @param event_type  事件类型
     * @param json_encode 事件数据
     */
    private static void emit_js(final WebView webView, final String event_type, final String json_encode) {
        // 如果web并没有向java注册接听者，不通知
        if (null == js_listener) return;

        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                String js = "if ('function' === typeof " + js_listener + ") {\n"
                        + js_listener + ".call("
                        + JS_NAME
                        + ",'" + event_type + "'"
                        + "," + (null == json_encode ? "null" : json_encode)
                        + ");\n"
                        + "}";
                webView.evaluateJavascript(
                        js,
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String str) {
                            }
                        }
                );
            }
        });
    }
}
