package qidizi.js_ime;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.Html;
import android.text.method.LinkMovementMethod;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 创建用来显示帮助说明html的text view
        TextView tv = new TextView(this);
        // 允许点击链接
        tv.setClickable(true);
        tv.setPadding(50, 50, 50, 50);
        String app_name = getString(R.string.app_name);
        tv.setTypeface(Typeface.MONOSPACE, Typeface.NORMAL);
        String html = getString(R.string.help).replace("{{app_name}}", app_name);

        // 兼容低版本
        if (Build.VERSION.SDK_INT < 24) //noinspection deprecation
            tv.setText(Html.fromHtml(html));
        else tv.setText(Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY));

        // 长内容允许滚动
        tv.setMovementMethod(LinkMovementMethod.getInstance());
        setContentView(tv);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 不放到onCreate是因为可能无权限授权后再切换回来也可以开始复制
        // 这个界面使用比较少，浪费点性能无所谓
        copy_web();
    }

    private void copy_web() {
        // 把默认web复制到sd中

        if (!Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
            toast("sdcard未准备好");
            return;
        }

        if (23 <= Build.VERSION.SDK_INT) {
            int can_read = checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE);

            if (PackageManager.PERMISSION_DENIED == can_read) {
                toast("请授予读取文件权限");
                return;
            }

            int can_write = checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE);

            if (PackageManager.PERMISSION_DENIED == can_write) {
                toast("请授予写入文件权限");
                return;
            }
        }

        // /sdcard/Android/包名/files,如果不存在，会在调用本方法时自动创建
        // 注意存到这，在应用删除时，也会被删除，否则需要放到sdcard根目录下
        File file = this.getExternalFilesDir(null);

        if (null == file) {
            toast("获取sdcard失败");
            return;
        }

        if (!file.exists() || !file.canRead()) {
            toast("无法读取" + file.getAbsolutePath());
            return;
        }

        //  TODO 注意，copy后，发现模拟器中文件管理器app Files从SDCARD入口进入时不把这些文件列出来，
        //   但是从Android SDK built for x..进入却能看到
        //   所以，就算显示没有文件，然后这时你看到代码中逻辑却总是返回exists＝＝＝true，拼命找原因，
        //   可能是一种错觉，这时应该使用权限最高的adb shell进去ls一下即可明确谁是对的，或是使用代码list一下文件tree
        //   这里面讨论的方向可能是错误的，https://stackoverflow.com/questions/32821426/android-file-exists-is-always-true
        String full_path = file.getAbsolutePath() + File.separator + SoftKeyboard.DEFAULT_HTML;

        file = new File(full_path);

        if (file.exists())
            // 已经存在
            return;

        final File sd_web = file.getParentFile();

        if (null == sd_web) {
            toast("无法读取sd路径");
            return;
        }

        if (!sd_web.exists()) {
            if (!sd_web.mkdir()) {
                toast("创建目录失败：" + sd_web.getAbsolutePath());
                return;
            }
        }

        final AssetManager am = getResources().getAssets();
        final String[] files;

        try {
            files = am.list(SoftKeyboard.PUBLIC_DIR);
        } catch (Exception e) {
            toast("无法读取默认html：" + e.getMessage());
            return;
        }

        if (null == files) {
            toast("无法列举内置html");
            return;
        }

        // 复制非常慢，需要在另线程处理
        new Thread() {
            @Override
            public void run() {
                InputStream is = null;
                FileOutputStream fos = null;

                try {
                    int count = files.length;
                    int index = 0;
                    for (String fn : files) {
                        // 注意fn是不带目录的
                        index++;
                        File sd_file = new File(sd_web, fn);
                        fos = new FileOutputStream(sd_file);
                        fn = SoftKeyboard.PUBLIC_DIR + File.separator + fn;
                        is = am.open(fn);
                        int bit;

                        while (-1 != (bit = is.read())) {
                            fos.write(bit);
                        }

                        toast("复制进度：" + index + "/" + count + "个 " + fn + " -> " + sd_file.getAbsolutePath());
                    }
                } catch (Exception e) {
                    toast("复制默认html失败：" + e.getMessage());
                } finally {
                    try {
                        if (null != fos) fos.close();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }

                    try {
                        if (null != is) is.close();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

            }
        }.start();
    }

    private void toast(final String str) {
        final Context av = this;
        // 子线程调用toast必须使用ui线程
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(av, str, Toast.LENGTH_LONG).show();
            }
        });
    }
}
