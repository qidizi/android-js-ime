package qidizi.js_ime;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.inputmethod.InputConnection;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import java.util.ArrayList;

class JsInterface {
    static String js_listener = null;
    private SoftKeyboard context;
    private WebView webView;

    JsInterface(SoftKeyboard ct, WebView wv) {
        context = ct;
        webView = wv;
    }

    private void send_key_event(int action, String key_code_str, int repeat, int meta_state) {
        // 向当前绑定到键盘的应用发送键盘事件
        InputConnection ic = context.getCurrentInputConnection();
        long down_time = SystemClock.uptimeMillis();
        long event_happen_time = SystemClock.uptimeMillis();
        int key_code = KeyEvent.keyCodeFromString(key_code_str);
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

    // TODO 注意暴露给js的方法必须是public，包内是不行的
    @JavascriptInterface
    public void send_key_down(String key_code_str, int repeat, int meta_state) {
        send_key_event(KeyEvent.ACTION_DOWN, key_code_str, repeat, meta_state);
    }

    @JavascriptInterface
    public void send_key_up(String key_code_str, int meta_state) {
        send_key_event(KeyEvent.ACTION_UP, key_code_str, 0, meta_state);
    }

    @JavascriptInterface
    public void send_key_press(String key_code_str, int meta_state) {
        // 不熟悉的人可能很难做到按合理逻辑处理好down与up成对出现问题，最后导致出现意外效果，
        // 所以，建议只给web提供这个即可
        send_key_event(KeyEvent.ACTION_DOWN, key_code_str, 0, meta_state);
        send_key_event(KeyEvent.ACTION_UP, key_code_str, 0, 0);
    }

    @JavascriptInterface
    public void send_text(String text) {
        // 发送的是字符串，非android支持的KEYCODE
        InputConnection ic = context.getCurrentInputConnection();
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
                context.reload_webview();
            }
        });
    }

    @JavascriptInterface
    public void speech_to_text() {
        // 语音识别出文本
        Handler mainHandler = new Handler(context.getMainLooper());

        Runnable myRunnable = new Runnable() {
            @Override
            public void run() {
                // 语音到文本，必须运行在main thread中

                // 不能直接new，只能这样用
                // TODO 需要修改成不重复new
                SpeechRecognizer sr = SpeechRecognizer.createSpeechRecognizer(context);
                sr.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (null == matches) return;
                        if (matches.size() > 0) {
                            // 识别出文字，异步通知给js
                            SoftKeyboard.emit_js_str(webView, "speech_to_text_result", matches.get(0));
                        }
                    }

                    @Override
                    public void onError(int i) {
                        String error = "";
                        switch (i) {
                            case SpeechRecognizer.ERROR_AUDIO:
                                error = "录制异常";
                                break;
                            case SpeechRecognizer.ERROR_CLIENT:
                                error = "tts组件异常";
                                break;
                            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                                error = "请授予录音权限";
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
                        }
                        Toast.makeText(context, error, Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onPartialResults(Bundle bundle) {
                        // 必须重写
                    }

                    @Override
                    public void onEvent(int i, Bundle bundle) {
                        // 必须重写
                    }

                    @Override
                    public void onBufferReceived(byte[] bytes) {
                        // 必须重写
                    }

                    @Override
                    public void onEndOfSpeech() {
                        Toast.makeText(context, "识别中...", Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        // 必须重写
                    }

                    @Override
                    public void onRmsChanged(float v) {
                        // 必须重写
                    }

                    @Override
                    public void onReadyForSpeech(Bundle bundle) {
                        Toast.makeText(context, "请开始说话...", Toast.LENGTH_LONG).show();
                    }
                });

                Intent speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                // 识别结束用途，如网络查找，可能要提炼关键字
                speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                // 不支持边说边识别，只能说完再识别
                speechIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
                sr.startListening(speechIntent);
            }
        };
        mainHandler.post(myRunnable);

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
}
