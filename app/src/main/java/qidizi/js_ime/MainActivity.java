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
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends AppCompatActivity {

    @RequiresApi(api = Build.VERSION_CODES.N)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView tv = new TextView(this);
        tv.setClickable(true);
        tv.setPadding(50, 50, 50, 50);
        String app_name = getString(R.string.app_name);
        tv.setTypeface(Typeface.MONOSPACE, Typeface.NORMAL);
        String html = getString(R.string.help).replace("{{app_name}}", app_name);
        tv.setText(Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY));
        tv.setMovementMethod(LinkMovementMethod.getInstance());
        setContentView(tv);

        // 复制非常慢，需要在另线程处理
        new Thread() {
            @Override
            public void run() {
                copy_web();
            }
        }.start();
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
                toast("请授予本输入法sdcard读取权限");
                return;
            }

            int can_write = checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE);

            if (PackageManager.PERMISSION_DENIED == can_write) {
                toast("请授予本输入法sdcard写入权限");
                return;
            }
        }

        // /sdcard/Android/包名/files,如果不存在，会在调用本方法时自动创建
        // 注意存到这，在应用删除时，也会被删除，否则需要放到sdcard根目录下
        File sd_dir = this.getExternalFilesDir(null);

        if (null == sd_dir) {
            toast("无法获取sdcard");
            return;
        }

        if (!sd_dir.exists() || !sd_dir.canRead()) {
            toast("无法读取" + sd_dir.getAbsolutePath());
            return;
        }

        File sd_default_html = new File(sd_dir, SoftKeyboard.DEFAULT_HTML);

        if (sd_default_html.exists())
            // 已经存在
            return;

        File sd_web = sd_default_html.getParentFile();

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

        AssetManager am = getResources().getAssets();
        String[] files;

        try {
            files = am.list(SoftKeyboard.PUBLIC_DIR);
        } catch (Exception e) {
            toast("无法读取默认html：" + e.getMessage());
            return;
        }

        if (null == files) {
            toast("读取html出错");
            return;
        }

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

                toast("文件复制成功(" + index + "/" + count + "个)：" + fn + " -> " + sd_file.getAbsolutePath());
            }
        } catch (Exception e) {
            toast("复制默认html失败：" + e.getMessage());
        } finally {
            try {
                if (null != is) is.close();
            } catch (Exception ignored) {

            }

            try {
                if (null != fos) fos.close();
            } catch (Exception ignored) {

            }
        }
    }

    private void toast(final String str) {
        final Context av = this;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(av, str, Toast.LENGTH_LONG).show();
            }
        });
    }
}
