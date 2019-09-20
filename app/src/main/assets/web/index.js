// 需要手工改变怎么更新手机上chrome缓存
import Vue from './vue.js?v4';
import $ from './jquery.js?v3';
import java from './java.js?v1';
// 码表按26个字母分，减少查找字符大小，也方便手工编辑时编辑器不卡
import * as wu_bi from './wu_bi_a.js?v2';

console.log(wu_bi)
let JAVA = window.JAVA;

if (!JAVA) {
    JAVA = java;
}

// 小于这个毫秒就是按
const SMALL_IS_SHORT_PRESS_MS = 750;
// 小于这个才算按或长按，否则就属于pan
const SMALL_IS_PRESS_PX = 10;
// 长按激活后，多少毫秒发送一次按下事件
const LONG_PRESS_REPEAT_MS = 50;
// 用于方向判断：由于越近夹角弧度越小，就越不容易控制，所以，ab点连线长必须达到这个值以上才判断
const DIRECTION_MIN_PX = 50;
// 匹配中文，候选框只显示前面x个
const CANDIDATE_LIMIT = 15;
// 键盘是否显示命名前缀
const KEYBOARD_SHOW_PRE = 'keyboard_show_';
// 码表中码词之间分隔符
const CODE_LIST_KEY_WORD_SEPARATE = ' ';
// 码表中2组kw之间分隔
const CODE_LIST_SEPARATE = ',';
// 需要按下shift才能组合的键，如数字2上方的＠，那么<kbd data-android="^KEYCODE_2"
const WITH_SHIFT_SYMBOL = '⇧';
// ctrl控制键标志
const WITH_CTRL_SYMBOL = '^';
// 快捷短语保存在localStorage的key
const QUICK_INPUT_ITEM_NAME = 'quick_input_list';
// 默认键盘
const DEFAULT_KEYBOARD = 'wu_bi';
// 默认中文
const DEFAULT_KEYBOARD_CN = DEFAULT_KEYBOARD;
// 有什么键盘
const KEYBOARDS = DEFAULT_KEYBOARD + ',en,number,symbol,en,quick,other';

// 创建临时全局变量，不放到vue data中，防止刷新ui
// touch事件关系：
// 按：down与up小于x毫秒＋ab点线长小于m
// 长按: down与up不小于x毫秒＋ab点线长小于m
// pan：x毫秒内，ab点线长不小于m（因为需要跟长按分清）
let glb = {
    // 只响应几个手指的触摸
    touch: [],
    current_keyboard: DEFAULT_KEYBOARD
};

window.app = new Vue({
    el: '#app',
    name: "SimpleKeyboard",
    data: () => {
        let tmp = {
            // 几个控制键是否被按下
            shift_down: false,
            ctrl_down: false,
            alt_down: false,
            meta_down: false,

            // 快捷短语列表
            quick_input: [],

            // 候选词列表
            candidates: [],
            // 候选词键码
            keys: '',

            textarea_show: false,
            textarea_placeholder: '',
            textarea_value: '',
        };

        // 有什么键盘
        KEYBOARDS.split(',').forEach(function (v) {
            tmp[KEYBOARD_SHOW_PRE + v] = v === DEFAULT_KEYBOARD;
        });

        return tmp;
    },
    mounted() {
        // 初始化
        // 防止初始过程凌乱显示
        $(this.$el).removeClass('hide_body');
        // 向java注册接收通知的方法
        JAVA.js_onload("window.app.java_listener");

        // 加载快捷短语
        let quick_list = localStorage.getItem(QUICK_INPUT_ITEM_NAME);
        if (quick_list) this.quick_input = JSON.parse(quick_list);
    },
    methods: {
        "java_listener"(what, info) {
            // 接收java通知，比如输入框要求显示数字键盘
            // debug('java_listener', arguments);
            //
            // if ('onStartInputView' === what) {
            //     // 有些input type并不规范，所以，也就只处理number类型，像网址之类的其实是可以输入中文的
            //     this.show_keyboard('number' === info['inputType'] ? 'number' : DEFAULT_KEYBOARD);
            // }

            if ('speech_to_text_result' === what) {
                this.speech_to_text_on_result(info);
            }
        },

        "on_touch_cancel"(ev) {
            // 触摸事件被打断，如长按时，文本被选中了触发了右键菜单弹出
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];
            // 只需要取消延时触发长按定时
            clearTimeout(touch.long_press_timer);
        },
        "on_touch_start"(ev) {
            // 手指按下
            let ev_ct = ev.changedTouches[0];
            // 只取起始点的dom
            let target = $(ev.target);
            // 需要滚动的dom，不能启用手势判断,否则将本来想滚动，却触发了手势
            // 还有就是想使用click却由于这个判断出现异常
            let disable_gesture = target.hasClass('disable-gesture')
                || target.parents('.disable-gesture').length;
            // 如果明确禁用，不走
            if (disable_gesture) return;
            let identifier = ev_ct.identifier;
            if (identifier >= glb.touch.length) glb.touch.push({});
            let touch = glb.touch[identifier];
            touch.target = ev.target;
            let vm = this;
            // 初始该触摸点
            // 起点坐标与时间
            touch.start_x = touch.ax = ev_ct.screenX;
            touch.start_y = touch.ay = ev_ct.screenY;
            touch.start_time = ev.timeStamp;
            // 起点与b点最大线长
            touch.start_2_b_max_px = 0;
            // 达到长按毫秒数前，最大起点与b点线长，达到这个px才是手势；而按的手指抖动位移是不会超出该px的
            touch.before_long_press_start_2_b_max_px = 0;
            // 长按下后，重复发送down事件的次序（次数，从0开始）
            touch.long_press_repeat_index = 0;
            // 从按下到放开，全部移动方向
            touch.directions = [];
            // 要发送的字符串
            let text = target.attr('data-text');
            touch.text = 'string' === typeof text ? text : '';
            let android_key_code = target.attr('data-android');
            android_key_code = android_key_code ? android_key_code : '';
            touch.with_shift = 0;
            touch.with_ctrl = 0;

            // 是否属于按下shift才能出现的键
            if (-1 < android_key_code.indexOf(WITH_SHIFT_SYMBOL)) {
                android_key_code = android_key_code.replace(WITH_SHIFT_SYMBOL, '');
                touch.with_shift = 1;
            }

            // 是否属于按下ctrl才能出现的键
            if (-1 < android_key_code.indexOf(WITH_CTRL_SYMBOL)) {
                android_key_code = android_key_code.replace(WITH_CTRL_SYMBOL, '');
                touch.with_ctrl = 1;
            }

            // android完成keyCode字符串
            touch.android_code = android_key_code;
            // 防止意外编程，先清空
            clearTimeout(touch.long_press_timer);
            // 超过多少毫秒不放就启动长按处理
            // 长按只处理android的keyCode单个键码，不处理字符串
            // 不处理组合键
            function lp_timer() {
                if (touch.start_2_b_max_px > SMALL_IS_PRESS_PX) {
                    // 只要有一次最大位移超过，就取消长按
                    return;
                }
                vm.on_long_press(ev);
                //debug('repeat,', touch.long_press_repeat_index);
                // 多久自动重复
                touch.long_press_repeat_index++;
                // 使用相同的方式，方便清理
                touch.long_press_timer = setTimeout(lp_timer, LONG_PRESS_REPEAT_MS);
            }

            touch.long_press_timer = setTimeout(lp_timer, SMALL_IS_SHORT_PRESS_MS);
        },
        "on_touch_move"(ev) {
            // 触摸中移动
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];

            if (!touch || touch.target !== ev.target)
            // 比如子dom触发start，但是禁止start冒泡就会出现异常
                return;

            let ax = touch.ax;
            let sx = touch.start_x;
            let sy = touch.start_y;
            let ay = touch.ay;
            let time = ev.timeStamp;
            let bx = ev_ct.screenX;
            let by = ev_ct.screenY;
            // 计算与起点连线长
            // https://baike.baidu.com/item/%E4%B8%A4%E7%82%B9%E9%97%B4%E8%B7%9D%E7%A6%BB%E5%85%AC%E5%BC%8F
            let sb_px = Math.sqrt(Math.pow(sx - bx, 2) + Math.pow(sy - by, 2));
            // 计算ab连线长
            let ab_px = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
            // 当前为止起点到b的最大连线长
            touch.start_2_b_max_px = Math.max(
                touch.start_2_b_max_px, sb_px
            );

            // 判断在长按前是否已经达到手势的起点到b连线长
            if (time - touch.start_time < SMALL_IS_SHORT_PRESS_MS) {
                touch.before_long_press_start_2_b_max_px = Math.max(
                    touch.before_long_press_start_2_b_max_px, sb_px
                );
            }

            if (ab_px >= DIRECTION_MIN_PX) {
                // 弧度太小时，手指不好控制，容易误操作，
                // 只有划超出最小值才计算夹角，且超过最小ab连线长，就使用新的起点来计算
                // 2个坐标点计算角度;正x为0，正y为90，负x为180，负y为270
                // 即与绕0点与正x的夹角
                let angle = Math.atan2(ay - by, bx - ax) * (180 / Math.PI);

                if (angle < 0) {
                    // 用360度表示法
                    angle += 360;
                }

                let direction;

                // 这里判断统一使用等于大于起值，小于终值
                if (angle >= 45 && angle < 135) {
                    // 向上
                    direction = 'up';
                } else if (angle >= 135 && angle < 225) {
                    // 向左
                    direction = 'left';
                } else if (angle >= 225 && angle < 315) {
                    // 向下
                    direction = 'down';
                } else {
                    // 向右
                    direction = 'right';
                }

                let last_direction = touch.directions[
                touch.directions.length - 1
                    ];

                if (direction !== last_direction) {
                    // 只有移动到不同的方向才计入手势
                    touch.directions.push(direction);
                }

                // 使用新a点
                touch.ax = bx;
                touch.ay = by;
            }

        },
        "on_touch_end"(ev) {
            // 放开触摸
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];

            if (!touch || touch.target !== ev.target)
            // 比如子dom触发start，但是禁止start冒泡就会出现异常
                return;

            // 务必要清除长按定时
            clearTimeout(touch.long_press_timer);

            switch (touch.android_code) {
                // 放开触摸时，才会改变控制键的状态
                case 'KEYCODE_SHIFT_LEFT':
                case 'KEYCODE_SHIFT_RIGHT':
                    this.shift_down = !this.shift_down;
                    break;
                case 'KEYCODE_ALT_LEFT':
                case 'KEYCODE_ALT_RIGHT':
                    this.alt_down = !this.alt_down;
                    break;
                case 'KEYCODE_CTRL_LEFT':
                case 'KEYCODE_CTRL_RIGHT':
                    this.ctrl_down = !this.ctrl_down;
                    break;
                case 'KEYCODE_META_LEFT':
                case 'KEYCODE_META_RIGHT':
                    this.meta_down = !this.meta_down;
                    break;
            }

            // 耗时属于短按？
            let time_is_press = ev.timeStamp - touch.start_time < SMALL_IS_SHORT_PRESS_MS;
            // 起点b点最大线长属于按？
            let px_is_press = touch.start_2_b_max_px < SMALL_IS_PRESS_PX;
            // 未触发长按前，起点到b最大连线长是否已经达到手势的位移要求
            let have_gesture_move = touch.before_long_press_start_2_b_max_px >= SMALL_IS_PRESS_PX;

            if (px_is_press) {
                if (time_is_press) {
                    this.on_press(ev);
                    return;
                }

                this.on_long_press_end(ev);
                return;
            }

            if (!have_gesture_move) {
                // 虽然最大ab线长达到手势要求，但是限时内的起点到b点并没有达到，导致走了长按，所以不再算手势
                return;
            }

            touch.directions = touch.directions.join('>');
            // 触发手势
            this.on_gesture(ev);
        },
        on_gesture(ev) {
            let ev_ct = ev.changedTouches[0];
            let identifier = ev_ct.identifier;
            let touch = glb.touch[ev_ct.identifier];

            if (0 === identifier)
            // 手势只使用identifier＝0触摸的手指来运算
            // 注意一种手势只应做一件事
                switch (touch.directions) {
                    case 'up':
                        this.show_keyboard('en');
                        return;
                    case 'down':
                        this.show_keyboard(DEFAULT_KEYBOARD);
                        return;
                    case 'left':
                        this.show_keyboard('symbol');
                        return;
                    case 'right':
                        this.show_keyboard('number');
                        return;
                    case 'left>right':
                        this.show_keyboard('other');
                        return;
                    case 'right>left':
                        this.show_keyboard('quick');
                        return;
                    case 'up>down':
                        this.speech_to_text();
                        return;
                }
        },
        on_press(ev) {
            // 短按
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];
            let android_code = touch.android_code;

            if ('function' === typeof this[glb.current_keyboard + '_keyboard_on_press']) {
                // 走该键盘自定义逻辑，比如中文输入
                this[glb.current_keyboard + '_keyboard_on_press'](ev);
                return;
            }

            if (android_code) {
                // 优先处理案桌键事件
                this.send_key_press(android_code, touch);
            } else if (touch.text) {
                // 再到字符串
                this.send_text(touch.text);
            }
        },
        on_long_press(ev) {
            // 长按
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];
            let android_code = touch.android_code;

            // 长按只处理安卓键值事件
            if (!android_code)
                return;

            if ('function' === typeof this[glb.current_keyboard + '_keyboard_on_long_press']) {
                // 走键盘自定义逻辑
                this[glb.current_keyboard + '_keyboard_on_long_press'](ev);
                return;
            }
            // 长按中
            if (java[android_code])
                this.send_key_press(android_code, touch);

        },
        on_long_press_end(ev) {
            // 长按结束
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];
            let android_code = touch.android_code;
            // 只处理安卓单键值事件;
            if (!android_code) return;

            if ('function' === typeof this[glb.current_keyboard + '_keyboard_on_long_press_end']) {
                // 走自定义键盘逻辑
                this[glb.current_keyboard + '_keyboard_on_long_press_end'](ev);
                return;
            }

            if (java[android_code])
                this.send_key_up(android_code);
        },
        show_keyboard(who) {
            // 显示指定键盘
            glb.current_keyboard = who;

            for (let k in this) {
                if (this.hasOwnProperty(k)) {
                    if (0 !== String(k).indexOf(KEYBOARD_SHOW_PRE)) continue;
                    this[k] = KEYBOARD_SHOW_PRE + who === k;
                }
            }
        },
        "edit_quick_input"(ev) {
            this.textarea_placeholder = '请编辑快捷语 返回自动保存 格式如下：' +
                '\n呢称 这是短语后的内容，内容中间可以有空格但不能有换行(用\\n代替)' +
                '\n手机 1300000000' +
                '\n邮箱 e@qq.com';
            this.textarea_show = true;
            let list = localStorage.getItem(QUICK_INPUT_ITEM_NAME) || '';

            if (list) {
                try {
                    list = JSON.parse(list);
                    let tmp = '';
                    list.forEach(function (obj) {
                        tmp += obj[0] + ' ' + obj[1].replace(/\n/g, '\\n') + '\n\n';
                    });
                    list = tmp;
                } catch (e) {
                    list = '';
                }
            }
            this.textarea_value = list;
            glb.textarea_hide_cb = function () {
                if (list === this.textarea_value)
                // 没有改变
                    return;
                // 保存
                let new_list = [];
                this.textarea_value.split('\n').forEach(function (line) {
                    line = line.trim();
                    if ('' === line) return;
                    let first_space = line.indexOf(' ');
                    let display = line.substr(0, first_space);
                    let text = line.substr(first_space + 1)
                        .trim().replace(/\\n/g, '\n');
                    if ('' === text) return;
                    new_list.push([display, text]);
                });
                localStorage.setItem(QUICK_INPUT_ITEM_NAME, JSON.stringify(new_list));
                // 更新快捷键盘
                this.quick_input = new_list;
                glb.textarea_hide_cb = null;
            };
        },
        get_meta_state(touch) {
            // 获取控制键状态组合
            let state = 0;
            // 任何已经按下的控制键，在使用一次后自动恢复
            if (this.shift_down || touch.with_shift) {
                state |= java.META_SHIFT_MASK;
            }

            if (this.ctrl_down || touch.with_ctrl) {
                state |= java.META_CTRL_MASK;
            }

            if (this.alt_down) {
                state |= java.META_ALT_MASK;
            }

            if (this.meta_down) {
                state |= java.META_META_MASK;
            }

            return state;
        },
        cn_keyboard_reset() {
            // 重置中文输入状态
            this.candidates = [];
            this.keys = '';
        },
        "show_custom_candidates"(ev, candidates_array) {
            // 显示自定义的候选，比如一个按键显示更多符号
            let tmp = [];
            candidates_array.forEach(function (v) {
                tmp.push({words: v});
            });
            this.cn_keyboard_reset();
            this.candidates = tmp;
        },
        "use_candidate"(words) {
            // 点击选择了指定的候选
            this.cn_keyboard_reset();
            this.send_text(words);
        },
        send_key_down(android_code, repeat, meta) {
            // 发送按下事件，因为要维护up与down成对，否则可能会出现逻辑混乱，所以，若无特殊请直接使用key_press
        },
        send_key_up(android_code, meta) {
            // 发送放开事件，因为要维护up与down成对，否则可能会出现逻辑混乱，所以，若无特殊请直接使用key_press
        },
        send_key_press(key, touch) {
            // 发送一次按键事件
            if (!java[key]) return;
            let meta = this.get_meta_state(touch);
            JAVA.send_key_press(key, meta);
            this.clear_meta(key);
        },
        send_text(text, ev) {
            // 直接发送字符串
            if ('string' !== typeof text) {
                if (!ev || !ev.target) return false;
                text = ev.target.innerText.trim();
            }
            JAVA.send_text(text);
            this.clear_meta();
        },
        clear_meta(code) {
            let metas = ',KEYCODE_SHIFT_LEFT,KEYCODE_SHIFT_RIGHT,KEYCODE_ALT_LEFT' +
                ',KEYCODE_ALT_RIGHT,KEYCODE_CTRL_LEFT,KEYCODE_CTRL_RIGHT,KEYCODE_META_LEFT' +
                ',KEYCODE_META_RIGHT,';
            if (metas.indexOf(',' + code + ',') < 0)
            // 不是按控制键，就清除,shift不清除，让用户自行控制
                this.ctrl_down = this.alt_down = this.meta_down = false;
        },
        "shift_toggle_text"(t) {
            // 根据shift按钮状态，改变大小写显示
            return this.shift_down ? t.toUpperCase() : t.toLowerCase();
        },
        'textarea_close'() {
            // 放弃编辑框操作
            this.textarea_show = false;
        },
        'textarea_save'() {
            this.textarea_show = false;

            if ('function' === typeof glb.textarea_hide_cb)
                glb.textarea_hide_cb.call(this);
        },
        'deploy'() {
            // 重新加载html
            JAVA.reload();
        },
        speech_to_text() {
            // 使用语音输入
            let str = JAVA.speech_to_text();
        },
        speech_to_text_on_result(obj) {
            // 总是切换到中文来显示
            this.show_keyboard(DEFAULT_KEYBOARD_CN);
            this.show_custom_candidates(null, [obj.text]);
        },

        // 五笔处理
        "wu_bi_keyboard_on_press"(ev) {
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];
            let a_code = touch.android_code;
            let text = touch.text;
            // 删除缓存键码
            let keys = this.keys;

            if (!a_code && text) {
                // 字符串，直接上屏
                this.send_text(text);
                this.cn_keyboard_reset();
                return;
            }

            if (!a_code) {
                this.cn_keyboard_reset();
                return;
            }

            if ('KEYCODE_DEL' === a_code) {
                // 向左删除
                if (!keys) {
                    // 没有键码，直接向系统发送删除事件
                    this.send_key_press(a_code);
                    return;
                }

                keys = keys.replace(/.$/, '');

                if (!keys) {
                    // 变空了
                    this.cn_keyboard_reset();
                    return;
                }

            } else if ('KEYCODE_SPACE' === a_code) {
                if (this.candidates.length) {
                    // 有候选,首个上屏
                    let cd = this.candidates[0];
                    this.send_text(cd.words);
                } else if (!keys.length) {
                    // 没键码缓存,向系统发送空格事件
                    this.send_key_press(a_code);
                }
                // 重置
                this.cn_keyboard_reset();
                return;
            } else if ('KEYCODE_ENTER' === a_code) {
                if (keys.length) {
                    // 有缓存键码，键码上屏
                    this.send_text(keys);
                } else {
                    // 发送空格事件
                    this.send_key_press(a_code);
                }
                this.cn_keyboard_reset();
                return;
            } else if (a_code < 'KEYCODE_A' || a_code > 'KEYCODE_Z') {
                // 不是英文,直接发送事件
                this.send_key_press(a_code);
                this.cn_keyboard_reset();
                return;
            } else if (!a_code && text) {
                // 没键码，有字符串
                this.send_text(text);
                this.cn_keyboard_reset();
                return;
            } else {
                // 全是英文,追加
                if (keys && !this.candidates.length) {
                    // 前面的码已经没有匹配了，忽略本key
                    return;
                }

                keys += a_code.replace('KEYCODE_', '').toLowerCase();
            }

            // 开始匹配码表和显示候选
            let tmp = [];

            if (4 < keys.length) {
                // 不允许输入超过4码
                return;
            } else {
                // 只有合理的码，才查找
                //let start_time = +new Date;
                // 大概意思是只取前n个以该码开头的匹配
                let reg = new RegExp(
                    '(?:(?:^|'
                    + CODE_LIST_SEPARATE
                    + ')' + keys + '[a-z]*' + CODE_LIST_KEY_WORD_SEPARATE
                    + '[^' + CODE_LIST_KEY_WORD_SEPARATE + CODE_LIST_SEPARATE
                    + ']+){1,' + CANDIDATE_LIMIT + '}'
                );
                let match = wu_bi[keys.substr(0, 1)].match(reg);
                //debug('码表匹配耗时：' + (+new Date - start_time));

                if (match) {
                    // 有匹配
                    // 会出现,aa 中文这样的结果，要把首个分隔去掉
                    let first_sp = new RegExp('^' + CODE_LIST_SEPARATE);
                    match = match[0].replace(first_sp, '').split(CODE_LIST_SEPARATE);
                    match.forEach(function (kw) {
                        kw = kw.split(CODE_LIST_KEY_WORD_SEPARATE);
                        tmp.push({keys: kw[0], words: kw[1]});
                    });

                    if (4 === keys.length && 1 === tmp.length) {
                        // 4码唯一，自动上屏
                        this.send_text(tmp[0].words);
                        this.cn_keyboard_reset();
                        return;
                    }
                }
            }

            this.keys = keys;
            this.candidates = tmp;
        },
        "wu_bi_keyboard_on_long_press"(ev) {
            // 五笔键盘长按事件
            let ev_ct = ev.changedTouches[0];
            let touch = glb.touch[ev_ct.identifier];
            let a_code = touch.android_code;

            switch (a_code) {
                case 'KEYCODE_DEL':
                    // 长按立刻
                    if (this.keys) {
                        this.cn_keyboard_reset();
                        return;
                    }

                    this.send_key_press(a_code);
                    break;
                case 'KEYCODE_SPACE':
                    if (this.candidates && this.candidates.length) {
                        this.send_text(this.candidates[0].words);
                        this.cn_keyboard_reset();
                        return;
                    }

                    this.send_key_press(a_code);
                    break;
                case 'KEYCODE_ENTER':
                    if (this.keys) {
                        this.send_text(this.keys);
                        this.cn_keyboard_reset();
                        return;
                    }

                    this.send_key_press(a_code);
                    break;
            }
        },
        "wu_bi_keyboard_on_long_press_end"(ev) {
            // 不处理本事件
        },
    }
});
