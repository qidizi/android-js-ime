/*
 * Copyright (C) 2008-2009 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package qidizi.js_ime;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.inputmethodservice.InputMethodService;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONObject;

import java.io.File;

public class SoftKeyboard extends InputMethodService {
    // java方法提供给js的命名空间
    private final static String JS_NAME = "JAVA";
    // web文件目录
    final static String PUBLIC_DIR = "web";
    // sdcard若存在该文件（用户自定义html），优先使用
    private final static String USER_HTML = PUBLIC_DIR + "/user.html";
    // 内置默认html
    final static String DEFAULT_HTML = PUBLIC_DIR + "/index.html";
    // 加载html出错提示html
    private final static String ERROR_HTML = PUBLIC_DIR + "/error.html";
    // 访问assets目录下的web文件使用的协议
    private final static String ASSET_PROTO = "file:///android_asset/";
    private WebView webView = null;

    @Override
    public void onCreate() {
        // 必须调用super
        super.onCreate();
    }

    /**
     * 跟踪调用顺序
     */
    @SuppressWarnings("unused")
    static void method_call_order_debug() {
        // if (true) return;// 暂停测试
        // 换行前要有内容，否则idea中logcat显示时不换行
        StringBuilder str = new StringBuilder(" \n");

        try {
            StackTraceElement[] prev_method = Thread.currentThread().getStackTrace();
            String to = "";

            // 0～2都是没用信息 ->0#getThreadStackTrace:-2->1#getStackTrace:1720->2#print_method:227
            for (int i = 3; i <= 4 && i < prev_method.length; i++) {
                str.append(to)
                        .append(prev_method[i].getMethodName())
                        .append(" ")
                        .append(i)
                        .append("#")
                        .append(prev_method[i].getLineNumber())
                ;
                to = " <- ";
            }
        } catch (Exception e) {
            str.append("异常").append(e.getMessage());
        }
        Log.e("StackTrace", str.toString());
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
        // 路径是/storage/emulated/0/Android/data/qidizi.js_ime/files
        File sd_dir = this.getExternalFilesDir(null);

        if (null == sd_dir) {
            return null;
        }

        final File user_html = new File(sd_dir, USER_HTML);

        if (user_html.exists()) {
            // 优先使用用户的文件
            return "file://" + user_html.getAbsolutePath();
        }
        return null;
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface", "AddJavascriptInterface"})
    private void create_webview() {
        // 防止重复创建，以内存换html启动时间
        if (null != webView) return;
        final String url, user_html;
        String tmp = get_user_html_path();

        if (null != tmp) {
            // 优先使用用户html
            url = tmp;
            user_html = tmp;
        } else {
            url = ASSET_PROTO + DEFAULT_HTML;
            user_html = "";
        }

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
        webView.addJavascriptInterface(new JsInterface(this, webView), JS_NAME);
        // 一般键盘会把输入的app界面上推，如果透明时就会看到桌面背景
        webView.setBackgroundColor(Color.TRANSPARENT);
        WebView.setWebContentsDebuggingEnabled(true);//允许调试web

        final SoftKeyboard ct = this;
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

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Uri.Builder b = new Uri.Builder();

                if (Build.VERSION.SDK_INT < 23) {
                    b.appendQueryParameter("error_code", "0");
                    b.appendQueryParameter("error_msg", "无法加载html");
                } else {
                    b.appendQueryParameter("error_code", error.getErrorCode() + "");
                    b.appendQueryParameter("error_msg", error.getDescription().toString());
                }

                if (Build.VERSION.SDK_INT < 21)
                    b.appendQueryParameter("error_url", webView.getUrl() + "#real_url=unknown");
                else
                    b.appendQueryParameter("error_url", request.getUrl().toString());

                b.appendQueryParameter("default_path", ASSET_PROTO + DEFAULT_HTML);
                b.appendQueryParameter("user_path", user_html);
                String url = ASSET_PROTO + ERROR_HTML + "?" + b.toString();
                Log.e("WebView.onReceivedError", url);
                webView.loadUrl(url);
            }
        });
        // webview内部不允许通过触摸或是物理键盘切换焦点
        webView.setFocusable(false);
        // logcat要设置成info级别才能看到异常，像：
        // 10842-10842/qidizi.js_ime I/chromium: [INFO:CONSOLE(0)]
        // "Failed to load module script: The server responded with a non-JavaScript MIME type of "".
        // Strict MIME type checking is enforced for module scripts per HTML spec.",
        // source: file:///android_asset/web/index.js?1569008605055 (0)
        webView.loadUrl(url);
    }

    void reload_webview() {
        // 重新走：优先使用存在的自定义html，否则使用默认
        if (null == webView) return;

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
            JsInterface.js_listener = null;
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
        if (null == JsInterface.js_listener) return;

        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                String js = JsInterface.js_listener +
                        ".call(" + SoftKeyboard.JS_NAME
                        + ",'" + event_type + "'";
                if (null != json_encode) js += "," + json_encode;
                js += ")";
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
