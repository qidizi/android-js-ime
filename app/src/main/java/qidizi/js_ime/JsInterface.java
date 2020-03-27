package qidizi.js_ime;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.TextUtils;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.inputmethod.InputConnection;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.net.URL;

class JsInterface {
    static String js_listener = null;
    private SoftKeyboard context;
    private WebView webView;
    private Speech_recognizer speech_recognizer;

    JsInterface(SoftKeyboard ct, WebView wv) {
        context = ct;
        webView = wv;
        speech_recognizer = new Speech_recognizer(webView, context);
    }

    private void send_key_event(int action, int key_code, int meta_state) {
        // 向当前绑定到键盘的应用发送键盘事件
        InputConnection ic = context.getCurrentInputConnection();
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
        int repeat = 0;
        // 表示长按时，定时自动发送按下事件序号，比如长按中共发送3次0、1、2，那么某些应用就可以选择只处理首次，其它忽视
        // 比如防止用户放开时手慢本意按一次却变长按发送n次按下事件而执行多次操作
//        if (KeyEvent.ACTION_DOWN != action) {
//        }
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

//    // 注意暴露给js的方法必须是public，包内是不行的
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
        send_key_event(KeyEvent.ACTION_DOWN, key_code, meta_state);
        send_key_event(KeyEvent.ACTION_UP, key_code, 0);
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

    public static void js_callback(WebView wv, String callback, JSONObject json) {
        String str = "";

        try {
            str = json.toString();
        } catch (Exception e) {
            e.printStackTrace();
        }

        str = callback + "(" + str + ");";
        Log.e("qidizi", str);
        wv.evaluateJavascript(
                str,
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String str) {
                    }
                }
        );
    }

    /**
     * 读取远程url的内容，因为ajax需要跨域能力
     *
     * @param url         网址
     * @param local_name  保存本地的名字，如果为空|null，将直接返回
     * @param callback    回调js方法，如 "window.get_callback"
     * @param from_remote true 总是从远程获取忽略本地；false 优先使用本地内容
     */
    @JavascriptInterface
    public void load_url(
            final String url,
            String local_name,
            final String callback,
            final boolean from_remote
    ) {
        // file:///data/data/com.example.example/files/file.html
        Log.e("qidizi", url + " " + local_name + " " + callback);
        // 必须提供js回调
        if (TextUtils.isEmpty(callback)) return;
        final String file_name = "load_url." + local_name;
        final String save_path = context.getFilesDir() + File.pathSeparator + local_name;
        final JSONObject json = new JSONObject();

        try {
            File fp = new File(save_path);
            final boolean is_local_name = !TextUtils.isEmpty(local_name);

            if (!from_remote && is_local_name) {
                if (fp.isFile()) {
                    // 优先本地文件，且存在，立即返回
                    json.put("code", 200);
                    json.put("msg", "来自本地文件");
                    json.put("data", "");
                    json.put("url", "file://" + save_path);
                    js_callback(webView, callback, json);
                    return;
                }
            }

            if (TextUtils.isEmpty(url)) {
                json.put("code", 404);
                json.put("msg", "远程url无效");
                js_callback(webView, callback, json);
                return;
            }

            // 其它情况都要从远程获取，区别只在是否要存入本地
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    // callback(text,http_code)
                    StringBuilder text = new StringBuilder();

                    try {
                        BufferedReader in = new BufferedReader(
                                new InputStreamReader(new URL(url).openStream())
                        );

                        String inputLine;

                        while ((inputLine = in.readLine()) != null)
                            text.append(inputLine);

                    } catch (Exception e) {
                        try {
                            json.put("code", 501);
                            json.put("msg", "error " + e.getMessage());
                            js_callback(webView, callback, json);
                        } catch (Exception je) {
                            je.printStackTrace();
                        }
                        return;
                    }


                    try {
                        json.put("msg", "远程读取成功");
                        json.put("code", 200);

                        if (is_local_name) {
                            FileOutputStream outputStream;

                            try {
                                outputStream = context.openFileOutput(file_name, Context.MODE_PRIVATE);
                                outputStream.write(text.toString().getBytes());
                                outputStream.close();
                            } catch (Exception e) {
                                e.printStackTrace();
                            }

                            json.put("url", "file://" + save_path);
                        } else {
                            json.put("data", text.toString());
                        }

                        js_callback(webView, callback, json);
                    } catch (Exception je) {
                        je.printStackTrace();
                    }
                }
            });
        } catch (Exception e) {
            if (TextUtils.isEmpty(url)) {
                try {
                    json.put("code", 500);
                    json.put("msg", e.getMessage());
                    js_callback(webView, callback, json);
                } catch (Exception je) {
                    je.printStackTrace();
                }
            }
        }
    }

    @JavascriptInterface
    public void open_speech_recognizer() {
        speech_recognizer.open_speech_recognizer();
    }

    @JavascriptInterface
    public void stop_speech_recognizer() {
        speech_recognizer.stop_speech_recognizer();
    }

    @JavascriptInterface
    public void cancel_speech_recognizer() {
        speech_recognizer.cancel_speech_recognizer();
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
