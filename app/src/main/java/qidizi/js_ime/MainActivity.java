package qidizi.js_ime;

import android.graphics.*;
import android.os.*;
import android.text.*;
import android.text.method.*;
import android.view.Gravity;
import android.widget.*;
import androidx.appcompat.app.*;

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
        EditText et = new EditText(this);
        et.setHint("输入测试框");
        et.setFocusable(true);
        FrameLayout.LayoutParams layoutParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_VERTICAL
        );
        et.setTextColor(Color.RED);
        et.setText("测试输入框");
        addContentView(et, layoutParams);
        et.performClick();
    }
}
