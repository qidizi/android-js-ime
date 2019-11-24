window.onload = function () {
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
// 默认中文
    const DEFAULT_KEYBOARD_CN = 'cn';
// 默认英文
    const DEFAULT_KEYBOARD_EN = 'en';
// 默认键盘
    const DEFAULT_KEYBOARD = DEFAULT_KEYBOARD_CN;

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

    function id(the_id) {
        return document.getElementById(the_id);
    }

    window.app = new Vue({
        el: '#app',
        name: "SimpleKeyboard",
        data: {
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
            show_uid: null,
            back_uid: null,
            default_uid: null
        },
        created() {
            // 因为子组件可能会早于主组件mounted
            this.$on('child_show', this.on_child_show);
            this.$on('back', this.on_back);
            this.$on('register_default', this.on_register_default);
        },
        mounted() {
            // 初始化
            // 不使用jq，只有简单的功能
            id('init').remove();
            id('app').style.display = 'block';
            // 向java注册接收通知的方法
            java.js_onload("window.app.java_listener");
        },
        methods: {
            on_touch(ev) {
                // 检查是否touch了kbd
                if (!ev.custom_type) ev.custom_type = ev.type;

                if (!(!ev.target || '.KBD.KEY.'.indexOf('.' + ev.target.tagName + '.') < 0)) {
                    // 附加上点击的键盘
                    ev.custom_kbd = 'KBD' === ev.target.tagName ? ev.target : ev.target.parentElement;
                    // 找到键盘对象
                    ev.custom_kbd_i = ev.custom_kbd.dataset.i;

                    if ('.long_tab.tab.'.indexOf('.' + ev.custom_type + '.') > -1) {
                        ev.custom_key = 'c';
                    } else if ('.u.d.l.r.'.indexOf('.' + ev.custom_type + '.') > -1)
                        ev.custom_key = ev.custom_type;
                }

                // console.log(ev,ev.custom_type, this.$children[this.show_uid - 1], this.show_uid)
                ev.custom_type.indexOf('>') > 0 ?
                    // 多方向手势
                    this.$children.forEach(function (vm) {
                        // 注意发送的是手势，不是touch
                        vm.$emit(ev.custom_type, ev);
                    }) :
                    // 其它只发送给当前显示的键盘
                    this.$children[this.show_uid - 1].$emit('touch', ev);
            },
            on_register_default(vm) {
                this.show_uid = this.default_uid = this.back_uid = vm._uid
            },
            on_show_default(vm) {
                this.$children[this.default_uid - 1].$emit('show');
            },
            on_child_show(vm, can_back) {
                can_back && (this.back_uid = vm._uid);
                this.show_uid = vm._uid;
                this.$children.forEach(function (_vm) {
                    _vm._uid !== vm._uid && _vm.$emit('hide', vm._uid);
                });
            },
            on_back() {
                this.$children[this.back_uid - 1].$emit('show');
            },
            "java_listener"(what, info) {
                // 接收java通知，比如输入框要求显示数字键盘
                this.$children.forEach(function (vm) {
                    vm.$emit('on_' + what, info);
                });
            },
            "on_touch_cancel"(ev) {
                // 触摸事件被打断，如长按时，文本被选中了触发了右键菜单弹出
                for (let n = 0; ev.changedTouches[n]; n++) {
                    let touch = glb.touch[n];
                    delete glb.touch[n];
                    // 只需要取消延时触发长按定时
                    clearTimeout(touch.long_press_timer);
                    // type === touchcancel
                    this.on_touch(ev);
                }
            },
            "on_touch_start"(ev) {
                for (let n = 0; ev.changedTouches[n]; n++) {
                    // 手指按下
                    let ev_ct = ev.changedTouches[n];
                    // 只取起始点的dom
                    // let target = ev.target;
                    let touch = glb.touch[n] = {};
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
                    // // 要发送的字符串
                    // let text = target.getAttribute('data-text');
                    // touch.text = 'string' === typeof text ? text : '';
                    // let android_key_code = target.getAttribute('data-android');
                    // android_key_code = android_key_code ? android_key_code : '';
                    // touch.with_shift = 0;
                    // touch.with_ctrl = 0;
                    //
                    // // 是否属于按下shift才能出现的键
                    // if (-1 < android_key_code.indexOf(WITH_SHIFT_SYMBOL)) {
                    //     android_key_code = android_key_code.replace(WITH_SHIFT_SYMBOL, '');
                    //     touch.with_shift = 1;
                    // }
                    //
                    // // 是否属于按下ctrl才能出现的键
                    // if (-1 < android_key_code.indexOf(WITH_CTRL_SYMBOL)) {
                    //     android_key_code = android_key_code.replace(WITH_CTRL_SYMBOL, '');
                    //     touch.with_ctrl = 1;
                    // }
                    //
                    // // android完成keyCode字符串
                    // touch.android_code = android_key_code;
                    //
                    // 防止意外编程，先清空
                    clearTimeout(touch.long_press_timer);
                    // 超过多少毫秒不放就启动长按处理
                    // 长按只处理android的keyCode单个键码，不处理字符串
                    // 不处理组合键
                    function lp_timer() {
                        if (touch.start_2_b_max_px > SMALL_IS_PRESS_PX)
                        // 只要有一次最大位移超过，就取消长按
                            return;
                        ev.custom_type = 'long_tab';
                        vm.on_touch(ev);
                        //debug('repeat,', touch.long_press_repeat_index);
                        // 重复唯一序号
                        touch.long_press_repeat_index++;
                        // 使用相同的方式，方便清理
                        touch.long_press_timer = setTimeout(lp_timer, LONG_PRESS_REPEAT_MS);
                    }

                    touch.long_press_timer = setTimeout(lp_timer, SMALL_IS_SHORT_PRESS_MS);
                }
            },
            "on_touch_move"(ev) {
                for (let n = 0; ev.changedTouches[n]; n++) {
                    // 触摸中移动
                    let ev_ct = ev.changedTouches[n];
                    let touch = glb.touch[n];

                    if (!touch || touch.target !== ev.target)
                    // 比如子dom触发start，但是禁止start冒泡就会出现异常
                        continue;

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
                            direction = 'u';
                        } else if (angle >= 135 && angle < 225) {
                            // 向左
                            direction = 'l';
                        } else if (angle >= 225 && angle < 315) {
                            // 向下
                            direction = 'd';
                        } else {
                            // 向右
                            direction = 'r';
                        }

                        let last_direction = touch.directions[touch.directions.length - 1];

                        if (direction !== last_direction) {
                            // 只有移动到不同的方向才计入手势
                            touch.directions.push(direction);
                        }

                        // 使用新a点
                        touch.ax = bx;
                        touch.ay = by;
                    }
                }
            },
            "on_touch_end"(ev) {
                // 放开触摸
                for (let n = 0; ev.changedTouches[n]; n++) {
                    let touch = glb.touch[n];
                    delete glb.touch[n];

                    if (!touch || touch.target !== ev.target)
                    // 比如子dom触发start，但是禁止start冒泡就会出现异常
                        continue;

                    // 务必要清除长按定时
                    clearTimeout(touch.long_press_timer);
                    // 耗时属于短按？
                    let time_is_press = ev.timeStamp - touch.start_time < SMALL_IS_SHORT_PRESS_MS;
                    // 起点b点最大线长属于按？
                    let px_is_press = touch.start_2_b_max_px < SMALL_IS_PRESS_PX;
                    // 未触发长按前，起点到b最大连线长是否已经达到手势的位移要求
                    let have_gesture_move = touch.before_long_press_start_2_b_max_px >= SMALL_IS_PRESS_PX;

                    if (px_is_press) {
                        // 位移属于tab范围
                        ev.custom_type = time_is_press ? 'tab' : 'long_tab';
                        this.on_touch(ev);
                        continue;
                    }

                    if (!have_gesture_move) {
                        // 虽然最大ab线长达到手势要求，但是限时内的起点到b点并没有达到，导致走了长按，所以不再算手势
                        continue;
                    }

                    touch.directions = touch.directions.join('>');
                    ev.custom_type = touch.directions;
                    this.on_touch(ev);
                }
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
            }
        },
    });
};