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
import androidx.annotation.RequiresApi;
import org.json.JSONObject;

import java.io.File;


/**
 * InputMethodService提供了一个基本的UI元素架构（包括输入视图，候选词视图，全屏模式），
 * 但是开发者可以决定各个UI元素如何实现，
 * 例如，我们可以用键盘输入的方式实现一个输入视图，
 * 也可以用手写的方式来实现输入视图，
 * 所有的UI元素都被集成在了InputMethodService提供的窗口中，具体的UI元素包括：
 * soft input view（输入视图）：放置在屏幕底部
 * the candidates view（候选词视图）：放置在输入视图上面
 * extracted text view（提取文本视图）：存在于全屏模式，
 * 如果输入法没有运行在全屏模式，
 * 客户端会移动或重新调整大小以保证客户端视图在输入法视图的上面，
 * 如果输入法运行在全屏模式，输入法窗口会完全覆盖客户端窗口，此时，
 * 输入法窗口中会包含extracted text视图，
 * 该视图中包含客户端正在被编辑的文字信息。
 * <p>
 * IME最重要的部分就是对应用产生文本信息，
 * 这通过调用InputConnection接口来实现，
 * 我们可以通过getCurrentInputConnection方法来得到InputConnection接口，
 * 通过该接口可以产生raw key事件，如果目标编辑框支持，
 * 我们可以直接编辑候选词字符串并提交。
 * 我们可以从EditorInfo类中获得目标编辑框期望并支持的输入格式，
 * 通过调用getCurrentInputEditorInfo方法来获取EditorInfo类，
 * 其中最重要的是EditorInfo.inputType，
 * 如果inputType的值为EditorInfo.TYPE_NULL，
 * 则该目标编辑框不支持复杂的信息，
 * 只支持原始的按键信息（字母，数字，符号，不支持表情，汉字等合成信息），
 * Type类型可以是password（密码类型）、电话号码类型等。
 * 当用户在不同编辑框之间切换时，
 * 输入法框架会调用onFinishInput方法和onStartInput方法，
 * 你可以通过这两个方法来重置或初始化输入状态。
 * <p>
 * <p>
 * <p>
 * <p>
 * <p>
 * InputMethodService公有方法
 * 1、public boolean enableHardwareAcceleration()：
 * <p>
 * 该方法在API-21中被舍弃，从API-21开始，
 * 硬件加速功能在支持的设备上始终启用，
 * 该方法必须在onCreate方法之前被调用，所以，你可以在构造函数中调用该方法。
 * <p>
 * 2、public int getCandidatesHiddenVisibility（）：
 * <p>
 * 当候选词区域未显示时，调用该函数获取候选词区域的显示模式（INVISIBLE 或者 GONE），
 * 默认的实现会调用isExtractViewShown方法，若isExtractViewShown方法返回true，
 * getCandidatesHiddenVisibility方法返回值为GONE，否则返回值为INVISIBLE。
 * <p>
 * 3、public boolean isExtractViewShown（）：
 * <p>
 * 返回是否显示extract view视图，
 * 该方法只在isFullscreenMode方法返回true的情况下才有可能返回true。
 * 这种情况下，是否显示extract view主要决定于上次调用的setExtractViewShown（boolean）方法。
 * <p>
 * 4、public boolean isFullscreenMode（）：
 * <p>
 * 判断当前输入法是否运行在全屏模式，该方法的返回值决定于updateFullscreenMode（）。
 * <p>
 * 5、public void updateFullscreenMode（）：
 * <p>
 * 评估当前输入法是否应该运行在全屏模式，当模式改变时重画UI组件，
 * 该方法会调用onEvaluateFullscreenMode方法来决定是否开启全屏模式，
 * 用户可以通过isFullscreenMode方法来判断当前是否运行在全屏模式。
 * <p>
 * 6、public InputBinding getCurentInputBinding ()：
 * <p>
 * 返回当前活跃的InputBinding，不存在返回null。
 * <p>
 * 7、public InputConnection getCurrentInputConnection()：
 * <p>
 * 返回当前活跃的InputConnection，不存在返回null。
 * <p>
 * 8、public EditorInfo getCurrentInputEditorInfo()：
 * <p>
 * 获取编辑框信息。
 * <p>
 * 9、public CharSequence getTextForImeAction（int imeOptions）：
 * <p>
 * 返回可以应用于EditorInfo.imeOptions的按钮标签。
 * <p>
 * 10、public boolean isShowInputRequested（）：
 * <p>
 * 如果输入法被请求显示输入视图，返回值为true。
 * <p>
 * 11、public void onConfigurationChaged（Configuration reconfigure）：
 * <p>
 * 用于处理配置信息改变，InputMethodService的子类一般不需要直接处理配置改变信息，
 * 在标准的实现中，当配置信息改变时，该方法会调用相关的UI方法，
 * 所以，你可以依靠onCreateInputView等方法来处理配置信息改变的情况。
 * <p>
 * 12、public void onDisplayCompletions（CompletionInfo[] completions）：
 * <p>
 * 当客户端报告auto-completion候选词需要输入法显示的时候回调该函数，
 * 典型应用于全屏模式，默认的实现不做任何事情。
 * <p>
 * 13、public boolean onEvaluateFullscreenMode()：
 * <p>
 * 重写该方法来控制输入法何时运行在全屏模式，
 * 默认的实现在landscape mode（横屏模式）时，输入法运行在全屏模式，
 * 如果你改变了该方法的返回值，
 * 那么你需要在该返回值可能改变时调用updateFullscreenMode()方法，
 * 该方法会调用onEvaluateFullscreenMode函数，
 * 并当返回值与上一次不同时重绘UI组建
 * <p>
 * 14、public boolean onEvaluateInputViewShown()：
 * <p>
 * 重写该方法来控制何时向用户显示输入区域，
 * 默认的实现在不存在硬键盘或键盘被遮盖时显示软件盘输入区域，
 * 你应该在该方法的返回值可能改变时调用updateInputViewShown()方法
 * <p>
 * 15、public boolean onExtractTextContextMenuItem（int id）：
 * <p>
 * This is called when the user has selected a context menu
 * from the extracted text view,when running in fullscreen mode.
 * The default implementation sends this action to the current
 * InputConnection’sperformContextMenuAction(int),for it to be processed in underlying “real” editor
 * <p>
 * 16、public void onExtractedCursorMovement（int dx，int dy）：
 * <p>
 * This is called when the user has performed a cursor movement
 * in the extracted text view, when it is running in fullscreen mode.
 * The default implementation hides the candidates view when a
 * vertical movement happens, but only if the extracted text editor
 * has a vertical scroll bar because its text doesn’t fit.
 * Re-implement this to provide whatever behavior you want.
 * <p>
 * 17、public void onExtractedSelectionChanged（int start，int end）：
 * <p>
 * 用户在extracted text视图中移动光标时调用该方法，默认的实现会把对应的信息传递给底层的编辑框。
 * <p>
 * 18、public void onExtractedTextClicked（）：
 * <p>
 * 当用户点击extracted text视图时调用该方法，默认的实现会隐藏候选词视图，当extracted text视图存在竖直滚动条时。
 * <p>
 * 19、public void onExtractingInputChanged（EditorInfo ei）：
 * <p>
 * 全屏模式时，输入对象改变时，调用该方法，默认的实现当新的对象 is not a full editor，自动隐藏IME。
 * onKeyDown、onKeyLongPress、onKeyMultiple、onKeyUp用于劫持按键信息，返回值为ture，则代表此消息已经被消费
 * <p>
 * 20、public void onUpdateExtractedText（int token，ExtractedText text）：
 * <p>
 * 当应用报告新的extracted text信息需要显示时调用该方法，默认的实现会把新的文本放到extract edit视图中。
 * <p>
 * 21、public void onUpdateExtractingViews（EditorInfo ei）：
 * <p>
 * 全屏模式下当editor信息改变时，回调该函数，用于更新UI信息，例如如何显示按钮等
 * <p>
 * 22、public void onUpdateExtractingVisibility（EditorInfo ei）：
 * <p>
 * 全屏模式下当editor信息改变时，回调该函数，用于判断extracting（extract text和candidates）是否显示。
 * <p>
 * 23、public void onUpdateSelection（int oldSelStart，int oldSelEnd，
 * int newSelStrat，int newSelEnd，int candidatesStart，int candidatesEnd）：
 * <p>
 * 当应用报告新的文本选择区域时回调该函数，无论输入法是否请求更新extracted text，
 * onUpdateSelection都会被调用，尽管如此，当extracted text也改变的时候，
 * 输入法不会调用onUpdateSelection，在该方法中要小心处理setComposingText、
 * commitText或者deleteSurroundingText方法，可能引起死循环。
 * <p>
 * 24、public void onWindowHidden（）：
 * <p>
 * 当输入法界面已经被隐藏时调用该方法
 * <p>
 * 25、public void onWindowShown（）：
 * <p>
 * 当输入法界面已经显示给用户时调用该方法
 * <p>
 * 26、public void requestHideSelf（int flags）：
 * <p>
 * 关闭输入法界面，输入法还在运行，但是用户不能通过触控屏幕来输入信息
 * <p>
 * 27、public void sendDownUpKeyEvents（int keyEventCode）：
 * 28、public void sendKeyChar（char charCode）：
 */
public class SoftKeyboard extends InputMethodService {
    private final static String JS_NAME = "JAVA";
    final static String PUBLIC_DIR = "web";
    private final static String USER_HTML = PUBLIC_DIR + "/user.html";
    final static String DEFAULT_HTML = PUBLIC_DIR + "/index.html";
    private final static String ASSET_PROTO = "file:///android_asset/";
    private WebView webView = null;

    /**
     * 务必要调用super的方法
     */
    @Override
    public void onCreate() {
        super.onCreate();
        // method_call_order_debug();
    }

    /**
     * 跟踪调用顺序
     */
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
     * 方法用于发现客户端的变化，当新的客户端绑定到输入法时，
     * 该方法会被调用，在输入法第一次启动时，
     * 会马上调用onStartInput方法获取编辑框数据，
     * 否则，先调用onFinishInput方法，而后调用onStartInput方法。
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onBindInput() {
        // method_call_order_debug();
        super.onBindInput();
    }


    /**
     * 方法用于用户界面初始化，主要用于service运行过程中配置信息发生改变的情况（横竖屏转换等）。
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onInitializeInterface() {
        //method_call_order_debug();
        super.onInitializeInterface();
        create_webview();
    }

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public boolean onEvaluateInputViewShown() {
        // method_call_order_debug();
        return super.onEvaluateInputViewShown();
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
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public View onCreateInputView() {
        // method_call_order_debug();

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

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface", "AddJavascriptInterface"})
    private void create_webview() {
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

        // 只有处理成功，才表示来过这个方法
        // method_call_order_debug();
        webView = new WebView(this);

        WebSettings webSettings = webView.getSettings();
        // 要允许，否则无法加入js等
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAppCacheEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE); // 无缓存
        webSettings.setDatabaseEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setJavaScriptEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        // 可能需要更小的字体来显示键盘文字，值范围1～72
        webSettings.setMinimumFontSize(1);
        webSettings.setMinimumLogicalFontSize(1);
        webSettings.setUseWideViewPort(true); // 支持 <meta name="viewport" content="width=device-width,

        webView.addJavascriptInterface(new JsInterface(this, webView), JS_NAME);
        // 一般键盘会把输入的app界面上推，如果透明时就会看到桌面背景
        webView.setBackgroundColor(Color.TRANSPARENT);
        WebView.setWebContentsDebuggingEnabled(true);//允许调试web
        webView.setWebViewClient(new WebViewClient() {
            @RequiresApi(api = Build.VERSION_CODES.M)
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Uri.Builder b = new Uri.Builder();
                b.appendQueryParameter("error_code", error.getErrorCode() + "");
                b.appendQueryParameter("error_msg", error.getDescription().toString());
                b.appendQueryParameter("error_url", request.getUrl().toString());
                b.appendQueryParameter("default_path", ASSET_PROTO + DEFAULT_HTML);
                b.appendQueryParameter("user_path", user_html);
                String url = DEFAULT_HTML.replace("default", "error")
                        + "?" + b.toString();
                Log.e("WebView.onReceivedError", url);
                webView.loadUrl(url);
            }


            @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP)
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // 页面点击或是跳转，是通过捕捉请求url重新处理来达成的，并不是自动redirect
                view.loadUrl(request.getUrl().toString());
                // true表示本webview能处理该url，允许load
                return true;
            }
        });
        // webview内部不允许通过触摸或是物理键盘切换焦点
        webView.setFocusable(false);
        webView.loadUrl(url);
        Log.e("WebView.loadUrl", url);
    }

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    void reload_webview() {
        if (null == webView) return;

        String url = get_user_html_path();

        if (null == url) {
            // 优先使用用户html
            url = ASSET_PROTO + DEFAULT_HTML;
        }

        webView.loadUrl(url);
    }

    /**
     * 方法用于处理客户端发起的输入会话，当编辑框已经开启了文字输入的时候回调该方法，
     * 输入法可以通过该回调函数获取编辑框信息，并通过编辑框信息初始化相关数据（显示的键盘类型等）。
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onStartInput(EditorInfo attribute, boolean restarting) {
        super.onStartInput(attribute, restarting);
    }

    /**
     * onCreateCandidatesView方法用于创建并返回（candidate view）候选词区域的层次视图，
     * 该方法只被调用一次（候选次区域第一次显示时），方法可以返回null，此时输入法不存在候选词区域，
     * InputMethodService的默认方法实现返回值为空。想要改变已经创建的候选词区域视图，
     * 我们可以调用setCandidatesView(View)方法，想要控制何时显示候选词视图，
     * 我们可以实现setCandidatesViewShown（boolean）方法。
     *
     * @return null或是view
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public View onCreateCandidatesView() {
        return super.onCreateCandidatesView();
    }

    /**
     * onCreateExtractTextView方法在输入法全屏模式下会调用，
     * 用于创建并返回用于显示（extracted text）文本信息的区域视图，
     * 返回的视图必须包含ExtractEditText，且ID值为inputExtractEditText，
     * 默认情况下横屏模式时，输入法为全屏效果。
     *
     * @return view
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public View onCreateExtractTextView() {
        return super.onCreateExtractTextView();
    }

    /**
     * onStartInputView方法 输入视图正在显示并且编辑框输入已经开始的时候回调该方法，
     * onStartInputView方法总会在onStartInput方法之后被调用，普通的设置可以在onStartInput方法中进行，
     * 在onStartInputView方法中进行视图相关的设置，开发者应该保证onCreateInputView方法在该方法被调用之前调用。
     *
     * @param info       输入框的信息
     * @param restarting 是否重新启动
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        emit_js(info, restarting);
    }

    /**
     * onStartCandidatesView方法 候选词视图已经显示时回调该函数，
     * 该方法会在onStartInput方法之后被回调，普通的设置可以在onStartInput方法中进行，
     * 在onStartCandidatesView方法中进行视图相关的设置，
     * 开发者应该保证onCreateCandidatesView方法在该方法被调用之前调用。
     *
     * @param info       info
     * @param restarting bool
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onStartCandidatesView(EditorInfo info, boolean restarting) {
        super.onStartCandidatesView(info, restarting);
    }

    /**
     * onFinishCandidatesView（boolean finishingInput）方法
     * 当候选词视图即将被隐藏或者切换到另外的编辑框时调用该方法，
     * finishingInput为true，onFinishInput方法会接着被调用。
     *
     * @param finishingInput bool
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onFinishCandidatesView(boolean finishingInput) {
        super.onFinishCandidatesView(finishingInput);
    }

    /**
     * onFinishInputView（boolean finishingInput）方法
     * 当候选词视图即将被隐藏或者切换到另外的编辑框时调用该方法，
     * finishingInput为true，onFinishInput方法会接着被调用。
     *
     * @param finishingInput bool
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onFinishInputView(boolean finishingInput) {
        super.onFinishInputView(finishingInput);
    }

    /**
     * onFinishInput方法 通知输入法上一个编辑框的文本输入结束，
     * 这时，输入法可能会接着调用onStartInput方法来在新的编辑框中进行输入，
     * 或者输入法处于闲置状态，当输入法在同一个编辑框中重启时不会调用该方法
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onFinishInput() {
        super.onFinishInput();
    }

    /**
     * onUnbindInput方法
     * 当绑定的客户端和当前输入法失去联系时调用该方法，
     * 通过调用getCurrentInputBinding方法和
     * getCurrentInputConnection方法来判断是否存在联系，
     * 若两个方法的返回值无效，则客户端与当前输入法失去联系。
     */
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @Override
    public void onUnbindInput() {
        super.onUnbindInput();
    }

    private void destroy_webview() {
        if (webView != null) {
            // 这样处理防止有内存问题
            // 因为本方法运行在其它线程，不能直接调用webview的方法，否则将引起
            // java.lang.Throwable: A WebView method was called on thread 'JavaBridge'.
            // All WebView methods must be called on the same thread
            // 所以，把待执行方法放入它的队列
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
        //  method_call_order_debug();
        destroy_webview();
        super.onDestroy();
    }

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    private void emit_js(EditorInfo info, boolean restarting) {
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

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    static void emit_js_str(WebView wv, String event_type, String str) {
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
    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    private static void emit_js(final WebView webView, final String event_type, final String json_encode) {
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
