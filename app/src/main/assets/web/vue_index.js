function vue_index(name) {
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

    window.app = new Vue({
        el: '#app',
        name: name,
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
            'on_menu'(ev) {
                return 'TEXTAREA' === ev.target.tagName;
            },
            on_touch(touch) {
                // 检查是否touch了kbd
                if (!touch.custom_type) touch.custom_type = touch.type;

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
                        touch.custom_key = 'c';
                    } else if ('.u.d.l.r.'.indexOf('.' + touch.custom_type + '.') > -1)
                        touch.custom_key = touch.custom_type;
                    touch.custom_key_dom = touch.custom_kbd_dom.querySelector('.kbd-' + touch.custom_key);
                }

                touch.custom_type.indexOf('>') > 0 ?
                    // 多方向手势
                    this.$children.forEach(function (vm) {
                        // 注意发送的是手势，不是touch；建议只监听0这个手势
                        vm.$emit(touch.identifier + '-' + touch.custom_type, touch);
                    }) :
                    // 其它只发送给当前显示的键盘
                    this.$children[this.show_uid - 1].$emit('touch', touch);
            },
            on_register_default(vm) {
                this.show_uid = this.default_uid = this.back_uid = vm._uid
            },
            'on_show_default'() {
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
            }
        },
    });
}