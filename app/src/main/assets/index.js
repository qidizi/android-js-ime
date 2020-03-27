// 加载html使用的是file://协议，无法使用<script type="module"，否则将会触发以下错误
// "Failed to load module script: The server responded with a non-JavaScript MIME type of "".
// Strict MIME type checking is enforced for module scripts per HTML spec.",
// source: file:///android_asset/web/index.js?1569008605055 (0)
// 键盘来的浏览器userAgent添加了自定义标志 js_ime
function debug() {
    let dom = document.querySelector('#debug_box');
    dom.style.display = 'block';
    let str = [];

    for (let i = 0; i < arguments.length; i++) {
        let type = Object.prototype.toString.call(arguments[i])
            .toLowerCase().substr(8).replace(']', '');
        str.push('[' + type + ']' + JSON.stringify(arguments[i]));
    }

    dom.prepend(str.join('\t'), document.createElement('br'));
}

window.addEventListener('error', function (ev) {
    debug.call(window, 'js异常：' + ev.message + ' @ ' + ev.filename
        + ' ' + ev.lineno + ':' + ev.colno);
});

function ajax(src, cb, method, body) {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (200 === xhr.status) {
            'function' === typeof cb && cb.call(xhr, xhr.responseText);
        }
    };
    xhr.open(method || 'GET', src);
    xhr.send(body);
}

function load_js(src, onload) {
    let js = document.createElement('script');
    js.src = src + '?' + +new Date;
    if ('function' === typeof onload)
        js.onload = function cb() {
            this.onload = null;
            this.remove();
            onload();
        };
    document.getElementsByTagName('head')[0].appendChild(js);
}

function load_css(href, onload) {

    let css = document.createElement('LINK');
    css.setAttribute('rel', 'stylesheet');
    css.setAttribute('type', 'text/css');
    css.href = href + '?' + +new Date;
    if ('function' === typeof onload)
        css.onload = function cb() {
            this.onload = null;
            this.remove();
            onload();
        };
    document.getElementsByTagName('head')[0].appendChild(css);
}

function id(the_id) {
    return document.getElementById(the_id);
}

function has_class(dom, cls) {
    if (!dom || !dom.className) return false;
    let tmp = ',' + dom.className.toLowerCase().replace(/\s+/g, ',') + ',';
    cls = cls.toLowerCase().replace(/\s+/g, ',');
    cls = cls.split(',');
    let match_count = 0;
    cls.forEach(function (c, i) {
        if (tmp.indexOf(',' + c + ',') > -1) match_count++;
    });
    return match_count === cls.length;
}

+function index() {
    const USER_JS = 'user_js';
    const DEFAULT_JS = 'http://js-ime.qidizi.com/android-js-ime/app/src/main/assets/wu_bi.js';
    let load = localStorage.getItem(USER_JS) || DEFAULT_JS;
    java.load_url(load,
        (DEFAULT_JS === load ? USER_JS : 'default_js') + '.js',
        function (json) {
        }, false);
}();