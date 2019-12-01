package qidizi.js_ime;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.WebView;
import androidx.annotation.RequiresApi;

import java.util.ArrayList;
import java.util.List;

public class Speech_recognizer implements RecognitionListener {
    private Intent speechIntent = null;
    private SpeechRecognizer speech_recognizer = null;
    private WebView webView;
    private SoftKeyboard context;

    public Speech_recognizer(WebView wv, SoftKeyboard skb) {
        webView = wv;
        context = skb;
    }

    void stop_speech_recognizer() {
        if (null == speech_recognizer) return;

        Handler mainHandler = new Handler(context.getMainLooper());
        Runnable myRunnable = new Runnable() {
            @Override
            public void run() {
                speech_recognizer.stopListening();
            }
        };
        mainHandler.post(myRunnable);
    }

    void cancel_speech_recognizer() {
        if (null == speech_recognizer) return;

        Handler mainHandler = new Handler(context.getMainLooper());
        Runnable myRunnable = new Runnable() {
            @Override
            public void run() {
                speech_recognizer.cancel();
            }
        };
        mainHandler.post(myRunnable);
    }

    void open_speech_recognizer() {
        Handler mainHandler = new Handler(context.getMainLooper());
        Runnable myRunnable = new Runnable() {
            @RequiresApi(api = Build.VERSION_CODES.M)
            @Override
            public void run() {
                if (null == speech_recognizer)
                    create_speech_recognizer();

                if (null == speech_recognizer) return;
                if (null == speechIntent) create_intent();

                // 小米9设置语音输入为小爱同学时，会出现无法绑定的异常，需要去掉勾选成讯飞语记才能使用；
                speech_recognizer.startListening(speechIntent);
            }
        };
        mainHandler.post(myRunnable);
    }

    private void create_intent() {
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        // 识别结束用途，如网络查找，可能要提炼关键字
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        // 不支持边说边识别，只能说完再识别
        speechIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        // 只要一个识别结果
        speechIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
    }

    @RequiresApi(api = Build.VERSION_CODES.M)
    private void create_speech_recognizer() {
        // 语音到文本，必须运行在main thread中
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_error", "语音不可用");
            return;
        }

        // 查找当前系统的内置使用的语音识别服务
        String voice_component = Settings.Secure.getString(context.getContentResolver(),
                "voice_recognition_service");

        Log.e("qidizi", "voice_recognition_service : " + voice_component);

        if (TextUtils.isEmpty(voice_component)) {
            SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_error", "未安装语音识别组件");
            return;
        }

        ComponentName component = ComponentName.unflattenFromString(voice_component);

        if (null == component) {
            SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_error",
                    "无法使用语音识别组件：" + voice_component);
            return;
        }

        boolean is_recognizer_installed = false;
        ComponentName last_recognition = null;

        // 查找得到的 "可用的" 语音识别服务
        List<ResolveInfo> list = context.getPackageManager().queryIntentServices(
                new Intent(RecognitionService.SERVICE_INTERFACE), PackageManager.MATCH_ALL
        );

        if (0 == list.size()) {
            SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_error",
                    "没有可用的语音识别组件");
            return;
        }

        for (ResolveInfo info : list) {
            Log.e("qidizi", "\t" + info.loadLabel(context.getPackageManager()) + ": "
                    + info.serviceInfo.packageName + "/" + info.serviceInfo.name);

            if (info.serviceInfo.packageName.equals(component.getPackageName())) {
                is_recognizer_installed = true;
                break;
            } else {
                last_recognition = new ComponentName(info.serviceInfo.packageName, info.serviceInfo.name);
            }
        }

        // 这个方法在小米9上，总是返回null,比如已经安装了讯飞语记
//        Intent intent = RecognizerIntent.getVoiceDetailsIntent(context);
//        Log.e("kk",intent.toString());
        // 不能直接new，只能这样用

        if (is_recognizer_installed) {
            speech_recognizer = SpeechRecognizer.createSpeechRecognizer(context);
        } else {
            speech_recognizer = SpeechRecognizer.createSpeechRecognizer(context, last_recognition);
        }

        speech_recognizer.setRecognitionListener(this);
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
            default:
                error = "未明错误代号：" + i;
                break;
        }
        // 如小米9，设置语音识别为小爱同学时，收不到这个错误： 11059-11059/qidizi.js_ime E/SpeechRecognizer: bind to recognition service failed
        Log.e("qidizi", "出错了（" + error + "）");
        SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_error", "出错了（" + error + "）");
    }

    @Override
    public void onPartialResults(Bundle bundle) {
        // 必须重写
    }

    @Override
    public void onEvent(int i, Bundle bundle) {
        // 必须重写
        Log.e("qidizi", "onEvent（" + i + "）");
    }

    @Override
    public void onBufferReceived(byte[] bytes) {
        // 必须重写
    }

    @Override
    public void onEndOfSpeech() {
        SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_recognizing", "识别中...");
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
        SoftKeyboard.emit_js_str(webView, "speech_recognizer_on_listening", "请说话...");
    }
}
