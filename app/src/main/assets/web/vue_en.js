function vue_en(name) {
// 小于这个毫秒就是按
    const SMALL_IS_SHORT_PRESS_MS = 500;
// 在这个范围内就是按，否则就是swipe
    const SMALL_IS_PRESS_PX = 5;
// 长按激活后，多少毫秒发送一次按下事件
    const LONG_PRESS_REPEAT_MS = 50;
    // 达到本px的位移才计一个方向；减少提高灵敏度，增大减少灵敏度
    const MIN_PX_FOR_ONE_DIRECTION = 10;

// 创建临时全局变量，不放到vue data中，防止刷新ui
// touch事件关系：
// 按：down与up小于x毫秒＋ab点线长小于m
// 长按: down与up不小于x毫秒＋ab点线长小于m
// pan：x毫秒内，ab点线长不小于m（因为需要跟长按分清）
    let glb = {
        // 只响应几个手指的触摸
        touch: []
    };

    function kbd_name(dom) {
        if (!dom || 'BODY' === dom.tagName || 'HTML' === dom.tagName) return null;
        if ('KBD' === dom.tagName && has_class(dom, 'kbd')) {
            return dom.id;
        }

        return kbd_name(dom.parentElement);
    }

    window.app = new Vue({
        el: '#app',
        name: name,
        created() {
            // 因为子组件可能会早于主组件mounted
            this.$on('child_show', this.on_child_show);
            this.$on('child_hide', this.on_child_hide);
            this.$on('touch.' + name, this.on_touch_en);
            this.$on('0-u>d', this.on_show);
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
            on_show() {
                this.on_child_show(this);
                this.show = true;
            },
            hook(ev) {
                return glb.hook && glb.hook(ev) || false;
            },
            'on_menu'(ev) {
                // 按钮有长按功能,不显示菜单
                return 'KBD' !== ev.target.tagName;
            },
            on_touch(touch) {
                // 检查是否touch了kbd
                if (!touch.custom_type) touch.custom_type = touch.type;
                // 点击了哪个面板上dom
                let name = kbd_name(touch.target);

                if (
                    'KBD' === touch.target.tagName
                    && (
                        has_class(touch.target, 'keys')
                        || has_class(touch.target, 'key')
                    )
                ) {
                    // 附加上点击的键盘
                    touch.custom_kbd_dom = has_class(touch.target, 'keys') ? touch.target : touch.target.parentElement;
                    // 找到键盘对象
                    touch.custom_kbd_i = touch.custom_kbd_dom.dataset.i;

                    if ('.long_tab.tab.'.indexOf('.' + touch.custom_type + '.') > -1) {
                        // 点击或是长按,表示处理按键中间值
                        touch.custom_key = 'c';
                    } else if ('.u.d.l.r.'.indexOf('.' + touch.custom_type + '.') > -1)
                        // 其它方向值
                        touch.custom_key = touch.custom_type;
                }

                let is_gesture = touch.custom_type.indexOf('>') > 0;
                // 通知自己和子模块
                this.$children.concat([this]).forEach(function (vm) {
                    // 发送手势，不是touch；多指触摸时建议只监听0这个手势;类似于0-l>r>d,1->r->d>l
                    is_gesture ?
                        vm.$emit(touch.identifier + '-' + touch.custom_type, touch) :
                        // 点或长按,其它只发送给当前显示的键盘
                        vm.$emit('touch.' + name, touch);
                });
            },
            on_touch_en(ev) {
                // 英文面板必须有key
                if (!ev.custom_key) return this.hook(ev);
                // 手势u、d、l、r；tab、long_tab
                let kbd_obj = this.kbd[ev.custom_kbd_i][ev.custom_key];
                // 英文面板必须是点击了实键
                if (!kbd_obj) return this.hook(ev);
                ev.custom_kbd_obj = kbd_obj;
                ev.meta_state = this.get_meta_state();
                // 优先fn
                if (kbd_obj.fn)
                    // 针对的是当前面板,无需组件处理
                    kbd_obj.fn.call(this, ev);
                else if (kbd_obj.code && this.is_meta_code(kbd_obj.code)) {
                    // 点的是meta，放开触摸时，才会改变控制键的状态; 按的是控制键,无需组件处理
                    if ('long_tab' !== ev.custom_type) {
                        let new_status = !this.set_meta_down(kbd_obj.code);
                        this.set_meta_down(kbd_obj.code, new_status);
                    }
                } else if (kbd_obj.code) {
                    // 功能键,如删除,回车,f12
                    if (true !== this.hook(ev))
                        java.send_key_press(kbd_obj.code, ev.meta_state);
                } else if (kbd_obj.text)
                    // 字符串,无需子件处理
                    java.send_text(kbd_obj.text);
                else if (/^[A-Z]$/.test(kbd_obj.label)) {
                    // 26个英文字
                    if (true !== this.hook(ev))
                        java.send_key_press(android['KEYCODE_' + kbd_obj.label], ev.meta_state);
                } else
                    // 符号
                    java.send_text(kbd_obj.label);
                // 除了shift按键,按任何键都尝试清除掉像alt,ctrl之类控制键
                this.clear_meta(kbd_obj.code);
            },
            on_child_show(vm, hook) {
                glb.hook = hook || false;
                glb.show_uid = vm._uid;
                // 某个组件显示,通知其它的隐藏
                this.$children.forEach(function (_vm) {
                    _vm._uid !== vm._uid && _vm.$emit('hide');
                });
            },
            on_child_hide() {
                delete glb.show_uid;
                delete glb.hook;
            },
            "java_listener"(what, info) {
                // 接收java通知，比如输入框要求显示数字键盘
                if ('console_log' === what) {
                    debug(info.text);
                }

                this.$children.forEach(function (vm) {
                    vm.$emit(what, info);
                });
            },
            "on_touch_cancel"(ev) {
                // 触摸事件被打断，如长按时，文本被选中了触发了右键菜单弹出
                for (let n = 0, changed_touch; (changed_touch = ev.changedTouches[n]); n++) {
                    let touch = glb.touch[changed_touch.identifier];
                    delete glb.touch[changed_touch.identifier];
                    // 只需要取消延时触发长按定时
                    clearTimeout(touch.long_press_timer);
                    // type === touchcancel
                    touch.type = ev.type;
                    this.on_touch(touch);
                }
            },
            "on_touch_start"(ev) {
                for (let n = 0, changed_touch; (changed_touch = ev.changedTouches[n]); n++) {
                    // 手指按下
                    // 只取起始点的dom
                    // let target = ev.target;
                    let touch = glb.touch[changed_touch.identifier] = {
                        identifier: changed_touch.identifier,
                        type: ev.type,
                        canceled: false
                    };
                    touch.target = changed_touch.target;
                    let vm = this;
                    // 初始该触摸点
                    // 起点坐标与时间
                    touch.start_x = touch.ax = changed_touch.screenX;
                    touch.start_y = touch.ay = changed_touch.screenY;
                    touch.start_time = ev.timeStamp;
                    // 起点与b点最大线长
                    touch.start_2_b_max_px = 0;
                    // 长按下后，重复发送down事件的次序（次数，从0开始）
                    touch.long_press_repeat_index = 0;
                    // 从按下到放开，全部移动方向
                    touch.directions = [];
                    // 防止意外编程，先清空
                    clearTimeout(touch.long_press_timer);
                    // 超过多少毫秒不放就启动长按处理
                    // 长按只处理android的keyCode单个键码，不处理字符串
                    // 不处理组合键
                    function lp_timer() {
                        if (touch.start_2_b_max_px > SMALL_IS_PRESS_PX || touch.canceled)
                            // 只要有一次最大位移超过，就取消长按
                            return;
                        touch.custom_type = 'long_tab';
                        vm.on_touch(touch);
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
                for (let n = 0, changed_touch; (changed_touch = ev.changedTouches[n]); n++) {
                    // 触摸中移动
                    let touch = glb.touch[changed_touch.identifier];
                    touch.type = ev.type;

                    if (!touch || touch.target !== changed_touch.target)
                        // 比如子dom触发start，但是禁止start冒泡就会出现异常
                        continue;

                    let ax = touch.ax;
                    let sx = touch.start_x;
                    let sy = touch.start_y;
                    let ay = touch.ay;
                    let bx = changed_touch.screenX;
                    let by = changed_touch.screenY;
                    // 计算与起点连线长
                    // https://baike.baidu.com/item/%E4%B8%A4%E7%82%B9%E9%97%B4%E8%B7%9D%E7%A6%BB%E5%85%AC%E5%BC%8F
                    let sb_px = Math.sqrt(Math.pow(sx - bx, 2) + Math.pow(sy - by, 2));
                    // 计算ab连线长
                    let ab_px = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
                    // 当前为止起点到b的最大连线长
                    touch.start_2_b_max_px = Math.max(
                        touch.start_2_b_max_px, sb_px
                    );

                    // 主要超过按的偏移px，就立刻取消长按
                    if (touch.start_2_b_max_px > SMALL_IS_PRESS_PX)
                        clearTimeout(touch.long_press_timer);

                    if (ab_px > MIN_PX_FOR_ONE_DIRECTION) {
                        // 位移多少才按一次swipe计算；
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

                        // 超出按（长）的偏移px，才能按swipe算
                        let last_direction = touch.directions[touch.directions.length - 1];

                        if (direction !== last_direction) {
                            // 只有移动到不同的方向才计入手势
                            touch.directions.push(direction);
                        }
                        // a点要重新设定
                        touch.ax = bx;
                        touch.ay = by;
                    }
                }
            },
            "on_touch_end"(ev) {
                // 放开触摸
                for (let n = 0, changed_touch; (changed_touch = ev.changedTouches[n]); n++) {
                    let touch = glb.touch[changed_touch.identifier];
                    delete glb.touch[changed_touch.identifier];
                    touch.type = ev.type;
                    touch.canceled = true;

                    if (!touch || touch.target !== changed_touch.target)
                        // 比如子dom触发start，但是禁止start冒泡就会出现异常
                        continue;

                    // 务必要清除长按定时
                    clearTimeout(touch.long_press_timer);
                    // 耗时属于短按？
                    let time_is_press = ev.timeStamp - touch.start_time < SMALL_IS_SHORT_PRESS_MS;
                    // 起点b点最大线长属于按？
                    let px_is_press = touch.start_2_b_max_px < SMALL_IS_PRESS_PX;

                    if (px_is_press) {
                        // 最大位移属于按或长按范围
                        touch.custom_type = time_is_press ? 'tab' : 'long_tab';
                        this.on_touch(touch);
                        continue;
                    }

                    touch.directions = touch.directions.join('>');
                    touch.custom_type = touch.directions;
                    this.on_touch(touch);
                }
            },
            get_key_class(which, kv) {
                let obj = kv[which];
                if (!obj) return 'hide';
                let cls = which;
                if (obj.cls) cls += ' ' + obj.cls;

                if (obj.code && this.is_meta_code(obj.code) && this.set_meta_down(obj.code))
                    cls += ' hold_key';
                return cls + ' key';
            },
            get_meta_state() {
                // 获取控制键状态组合
                let state = 0;
                // 任何已经按下的控制键，在使用一次后自动恢复
                if (this.set_meta_down('shift')) {
                    state |= android.META_SHIFT_MASK;
                }

                if (this.set_meta_down('ctrl')) {
                    state |= android.META_CTRL_MASK;
                }

                if (this.set_meta_down('alt')) {
                    state |= android.META_ALT_MASK;
                }

                if (this.set_meta_down('meta')) {
                    state |= android.META_META_MASK;
                }

                return state;
            },
            set_meta_down(meta, val) {
                let which = 'meta_down_' + (isNaN(meta) ? android['KEYCODE_' + meta.toUpperCase() + '_LEFT'] : meta);
                if (2 === arguments.length)
                    return this[which] = val;

                return this[which];
            },
            clear_meta(code) {
                if (!this.is_meta_code(code)) {
                    // 不是按控制键，就清除,shift不清除，让用户自行控制
                    this['meta_down_' + android.KEYCODE_META_LEFT] = false;
                    this['meta_down_' + android.KEYCODE_ALT_LEFT] = false;
                    this['meta_down_' + android.KEYCODE_CTRL_LEFT] = false;
                    return true;
                }
                return false;
            },
            is_meta_code(code) {
                switch (code) {
                    case android.KEYCODE_SHIFT_LEFT:
                    case android.KEYCODE_SHIFT_RIGHT:
                    case android.KEYCODE_ALT_LEFT:
                    case android.KEYCODE_ALT_RIGHT:
                    case android.KEYCODE_CTRL_LEFT:
                    case android.KEYCODE_CTRL_RIGHT:
                    case android.KEYCODE_META_LEFT:
                    case android.KEYCODE_META_RIGHT:
                        return true;
                }

                return false;
            }
        },
        data() {
            let data = {
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
                default_uid: null,
                kbd: [
                    {
                        "c": {"label": "⏎", code: android.KEYCODE_ENTER},
                        "cls": "kbd_20"
                    },
                    {
                        u: {label: '?'},
                        "c": {"label": "."},
                        "r": {"label": ":"},
                        "l": {"label": ";"}
                    },
                    {
                        "l": {"label": "'"},
                        "r": {"label": '"'},
                        "c": {"label": ","}
                    },
                    {
                        "u": {"label": "Esc", code: android.KEYCODE_ESCAPE},
                        "c": {"label": "␣", code: android.KEYCODE_SPACE},
                        "cls": "kbd_20"
                    },
                    {
                        "c": {
                            "label": "⇨", fn() {
                                java.send_right();
                            }
                        },
                        "u": {
                            "label": "⇥", fn() {
                                java.send_key_press(android.KEYCODE_TAB, android.META_SHIFT_MASK);
                            }
                        }
                    },
                    {
                        "c": {
                            "label": "⇧", fn() {
                                java.send_up();
                            }
                        }
                    },
                    {
                        "c": {
                            "label": "⇩", fn() {
                                java.send_down();
                            }
                        }
                    },
                    {
                        "c": {
                            "label": "⇦", fn() {
                                java.send_left();
                            }
                        },
                        "u": {
                            "label": "⇥", fn() {
                                java.send_key_press(android.KEYCODE_TAB);
                            }
                        }
                    },
                    {
                        "c": {"label": "⌫", code: android.KEYCODE_DEL},
                        "u": {"label": "⌦", code: android.KEYCODE_FORWARD_DEL},
                        "cls": "kbd_15"
                    },
                    {
                        "u": {"label": "%"},
                        "c": {"label": "/"},
                        "l": {"label": "+"},
                        "r": {"label": "-"},
                        "d": {"label": "="},
                    },
                    {
                        "u": {"label": "*"},
                        "c": {"label": "M"},
                        "l": {"label": "("},
                        "d": {"label": "@"},
                        "r": {"label": ")"}
                    },
                    {
                        "u": {"label": "!"},
                        "c": {"label": "N"},
                        "l": {"label": "<"},
                        "r": {"label": ">"},
                        "d": {"label": "~"}
                    },
                    {
                        "c": {"label": "B"},
                        "u": {"label": "^"},
                        "l": {"label": "{"},
                        "r": {"label": "}"},
                        "d": {"label": "$"}
                    },
                    {
                        "c": {"label": "V"}
                    },
                    {
                        "c": {"label": "C"},
                        "r": {"label": "、"},
                        "d": {"label": "；"},
                        "u": {"label": "："},
                    },
                    {
                        "c": {"label": "X"},
                        u: {label: '！'},
                        d: {label: '，'},
                        l: {label: '“'},
                        r: {label: '”'}
                    },
                    {
                        "c": {"label": "Z"},
                        u: {label: '？'},
                        l: {label: '‘'},
                        d: {label: '。'},
                        r: {label: '’'}
                    },
                    {
                        cls: 'kbd_z_margin_left'
                    },
                    {
                        "c": {
                            "label": " 🄰", code: android.KEYCODE_SHIFT_LEFT
                        },
                        cls: 'kbd_l_margin_right'
                    },
                    {
                        "c": {"label": "L"},
                        "u": {"label": "\\"},
                        "r": {"label": "|"},
                        "d": {"label": "#"},
                        "l": {"label": "_"}
                    },
                    {
                        "c": {"label": "K"},
                        "u": {"label": "&"},
                        "l": {"label": "["},
                        "r": {"label": "]"},
                        "d": {"label": "`"}
                    },
                    {
                        "c": {"label": "J"},
                        "cls": "kbd_j",
                        d: {
                            label: '粘贴', fn() {
                                java.send_paste();
                            }
                        },
                        u: {
                            label: '复制',
                            fn() {
                                java.send_copy();
                            }
                        },
                        l: {
                            label: '剪切', fn() {
                                java.send_cut();
                            }
                        },
                        r: {
                            label: '撤消',
                            fn() {
                                java.send_undo();
                            }
                        }
                    },
                    {"c": {"label": "H"}},
                    {"c": {"label": "G"}},
                    {
                        "c": {"label": "F"},
                        "cls": "kbd_f"
                    },
                    {
                        "c": {"label": "D"},
                        "d": {"label": "——"},
                        "l": {"label": "「"},
                        "r": {"label": "」"}
                    },
                    {
                        "c": {"label": "S"},
                        "d": {"label": "……"},
                        "l": {"label": "『"},
                        "r": {"label": "』"},

                    },
                    {
                        "c": {"label": "A"},
                        "d": {"label": "-"},
                        "r": {"label": "·"},
                        u: {
                            label: '全选', fn() {
                                java.send_select_all();
                            }
                        }
                    },
                    {
                        cls: 'kbd_a_margin_left'
                    },
                    {
                        "c": {"label": "P"},
                        u: {label: 'Ctrl', code: android.KEYCODE_CTRL_LEFT},
                        d: {label: 'Alt', code: android.KEYCODE_ALT_LEFT}
                    },
                    {
                        "c": {"label": "O"}
                    },
                    {
                        "c": {"label": "I"}
                    },
                    {
                        "c": {"label": "U"}
                    },
                    {
                        "c": {"label": "Y"}
                    },
                    {
                        "c": {"label": "T"},
                        "l": {"label": "【"},
                        "r": {"label": "】"},
                    },
                    {
                        "l": {"label": "〔"},
                        "r": {"label": "〕"},
                        "c": {"label": "R"},
                        "d": {"label": "___"},
                    },
                    {
                        "c": {"label": "E"},
                        "l": {"label": "["},
                        "r": {"label": "]"},
                        "d": {"label": "/"},
                    },
                    {
                        "c": {"label": "W"},
                        "l": {"label": "（"},
                        "r": {"label": "）"},
                        "u": {"label": "F11", code: android.KEYCODE_F11},
                    },
                    {
                        "c": {"label": "Q"},
                        "u": {"label": "F12", code: android.KEYCODE_F12}
                    },
                    {
                        "c": {"label": 0},
                        "d": {"label": "F10", code: android.KEYCODE_F10}
                    },
                    {
                        "d": {"label": "F9", code: android.KEYCODE_F9},
                        "c": {"label": 9}

                    },
                    {
                        "c": {"label": 8},
                        "d": {"label": "F8", code: android.KEYCODE_F8}
                    },
                    {
                        "c": {"label": 7},
                        "d": {"label": "F7", code: android.KEYCODE_F7}
                    },
                    {
                        "c": {"label": 6},
                        "d": {"label": "F6", code: android.KEYCODE_F6}
                    },
                    {
                        "c": {"label": 5},
                        "d": {"label": "F5", code: android.KEYCODE_F5}
                    },
                    {
                        "c": {"label": 4},
                        "l": {"label": '〈'},
                        "r": {"label": '〉'},
                        "d": {"label": "F4", code: android.KEYCODE_F4},
                    },
                    {
                        "c": {"label": 3},
                        "l": {"label": '《'},
                        "r": {"label": '》'},
                        "d": {"label": "F3", code: android.KEYCODE_F3}
                    },
                    {
                        "c": {"label": 2},
                        "d": {"label": "F2", code: android.KEYCODE_F2}
                    },
                    {
                        "c": {"label": 1},
                        "d": {"label": "F1", code: android.KEYCODE_F1}
                    }
                ]
            };
            // 所有的meta key总是使用left，不要使用right，因为一边足够
            data['meta_down_' + android.KEYCODE_SHIFT_LEFT] = false;
            data['meta_down_' + android.KEYCODE_ALT_LEFT] = false;
            data['meta_down_' + android.KEYCODE_CTRL_LEFT] = false;
            data['meta_down_' + android.KEYCODE_META_LEFT] = false;
            return data;
        }
    });
}
