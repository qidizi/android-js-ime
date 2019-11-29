window.addEventListener('load', function () {
    Vue.component('kbd-en', {
        mounted() {
            this.$on(['u>d', 'show'], this.on_show);
            this.$on('hide', this.on_hide);
            this.$on('touch', this.on_touch);
            this.$root.$emit('register_default', this, this.show = true);
        },
        computed: {},
        methods: {
            get_key_class(which, kv) {
                let obj = kv[which];
                if (!obj) return 'hide';
                let cls = which;
                if (obj.cls) cls += ' ' + obj.cls;

                if (obj.code && this.is_meta_code(obj.code) && this.meta_down(obj.code))
                    cls += ' hold_key';
                return cls;
            },
            on_show() {
                // 不支持从其它键盘返回
                this.$root.$emit('child_show', this, true);
                this.show = true;
            },
            on_hide() {
                this.show = false;
            },
            on_touch(ev) {
                if (ev.custom_key) {
                    // 手势u、d、l、r；tab、long_tab
                    let kbd_obj = this.kbd[ev.custom_kbd_i][ev.custom_key];
                    if (!kbd_obj) return;
                    ev.custom_kbd_obj = kbd_obj;
                    // 优先fn
                    if (kbd_obj.fn)
                        kbd_obj.fn.call(this, ev);
                    else if (kbd_obj.code && this.is_meta_code(kbd_obj.code)) {
                        // 点的是meta，放开触摸时，才会改变控制键的状态
                        if ('long_tab' !== ev.custom_type) {
                            let new_status = !this.meta_down(kbd_obj.code);
                            this.meta_down(kbd_obj.code, new_status);
                        }
                    } else if (kbd_obj.code) {
                        java.send_key_press(kbd_obj.code, this.get_meta_state());
                    } else if (kbd_obj.text)
                        java.send_text(kbd_obj.text);
                    else if (/^[A-Z]$/.test(kbd_obj.label)) {
                        java.send_key_press(android['KEYCODE_' + kbd_obj.label], this.get_meta_state());
                    } else
                        java.send_text(kbd_obj.label);
                    this.clear_meta(kbd_obj.code);
                }
            },
            get_meta_state() {
                // 获取控制键状态组合
                let state = 0;
                // 任何已经按下的控制键，在使用一次后自动恢复
                if (this.meta_down('shift')) {
                    state |= android.META_SHIFT_MASK;
                }

                if (this.meta_down('ctrl')) {
                    state |= android.META_CTRL_MASK;
                }

                if (this.meta_down('alt')) {
                    state |= android.META_ALT_MASK;
                }

                if (this.meta_down('meta')) {
                    state |= android.META_META_MASK;
                }

                return state;
            },
            meta_down(meta, val) {
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
        template: `
        <section class="kbd-en" v-show="show">
        <kbd  :class="kv.cls" :data-i="i"  v-for="(kv,i) in kbd" >
        <key :class="get_key_class('c',kv)" v-if="kv.c">{{kv.c.label}}</key>
        <key :class="get_key_class('u',kv)" v-if="kv.u">{{kv.u.label}}</key>
        <key :class="get_key_class('d',kv)" v-if="kv.d">{{kv.d.label}}</key>
        <key :class="get_key_class('l',kv)" v-if="kv.l">{{kv.l.label}}</key>
        <key :class="get_key_class('r',kv)" v-if="kv.r">{{kv.r.label}}</key>
        </kbd>
        </section>
    `,
        data() {
            let data = {
                show: false,
                kbd: [
                    {
                        "c": {"label": "⏎", code: android.KEYCODE_ENTER},
                        "cls": "kbd_150"
                    },
                    {"c": {"label": "/"}},
                    {"c": {"label": "."}},
                    {
                        "c": {"label": "␣", code: android.KEYCODE_SPACE},
                        "cls": "kbd_150"
                    },
                    {"c": {"label": "⇨", code: android.KEYCODE_DPAD_RIGHT}},
                    {"c": {"label": "⇩", code: android.KEYCODE_DPAD_DOWN}},
                    {"c": {"label": "⇧", code: android.KEYCODE_DPAD_UP}},
                    {"c": {"label": "⇦", code: android.KEYCODE_DPAD_LEFT}},
                    {
                        "c": {
                            "label": " 🄰", code: android.KEYCODE_SHIFT_LEFT
                        },
                        u: {label: 'Ctrl', code: android.KEYCODE_CTRL_LEFT},
                        r: {label: 'Alt', code: android.KEYCODE_ALT_LEFT},
                    },
                    {
                        "c": {"label": "⌫", code: android.KEYCODE_DEL},
                        "u": {"label": "⌦", code: android.KEYCODE_FORWARD_DEL},
                        "cls": "kbd_bs_w"
                    },
                    {"c": {"label": ","}},
                    {"c": {"label": "M"}},
                    {"c": {"label": "N"}},
                    {"c": {"label": "B"}},
                    {"c": {"label": "V"}, u: {label: '粘贴', code: android.KEYCODE_PASTE}},
                    {"c": {"label": "C"}, u: {label: '复制', code: android.KEYCODE_COPY}},
                    {"c": {"label": "X"}, u: {label: '剪切', code: android.KEYCODE_CUT}},
                    {"c": {"label": "Z"}, cls: 'kbd_z_margin_left'},
                    {"c": {"label": "L"}, cls: 'kbd_l_margin_right'},
                    {"c": {"label": "K"}},
                    {
                        "c": {"label": "J"},
                        "cls": "kbd_j"
                    },
                    {"c": {"label": "H"}},
                    {"c": {"label": "G"}},
                    {
                        "c": {"label": "F"},
                        "cls": "kbd_f"
                    },
                    {"c": {"label": "D"}},
                    {"c": {"label": "S"}},
                    {
                        "c": {"label": "A"}, cls: 'kbd_a_margin_left',
                        u: {
                            label: '全选', fn() {
                                java.send_key_press(android.KEYCODE_A, android.META_CTRL_MASK);
                            }
                        }
                    },
                    {
                        "c": {"label": "P"},
                        "u": {"label": "F10", code: android.KEYCODE_F10}
                    },
                    {
                        "c": {"label": "O"},
                        "u": {"label": "F9", code: android.KEYCODE_F9},
                        "l": {"label": "-"},
                        "r": {"label": "="}
                    },
                    {"c": {"label": "I"}, "u": {"label": "F8", code: android.KEYCODE_F8}},
                    {
                        "c": {"label": "U"},
                        "u": {"label": "F7", code: android.KEYCODE_F7}
                    },
                    {"c": {"label": "Y"}, "u": {"label": "F6", code: android.KEYCODE_F6}},
                    {
                        "c": {"label": "T"},
                        "u": {"label": "F5", code: android.KEYCODE_F5}
                    },
                    {"c": {"label": "R"}, "u": {"label": "F4", code: android.KEYCODE_F4}},
                    {
                        "c": {"label": "E"},
                        "u": {"label": "F3", code: android.KEYCODE_F3}
                    },
                    {
                        "c": {"label": "W"},
                        "u": {"label": "F2", code: android.KEYCODE_F2},
                        "d": {"label": "F12", code: android.KEYCODE_F12}
                    },
                    {
                        "c": {"label": "Q"},
                        "u": {"label": "F1", code: android.KEYCODE_F1},
                        "d": {"label": "F11", code: android.KEYCODE_F11}
                    },
                    {"c": {"label": 0}, "u": {"label": ")"}},
                    {
                        "c": {"label": 9},
                        "u": {"label": "("},
                        "l": {"label": "_"},
                        "r": {"label": "+"}
                    },
                    {"c": {"label": 8}, "u": {"label": "*"}, "l": {"label": "~"}, "r": {"label": "`"}},
                    {
                        "c": {"label": 7},
                        "u": {"label": "&"},
                        "l": {"label": "["},
                        "r": {"label": "]"}
                    },
                    {"c": {"label": 6}, "u": {"label": "^"}, "l": {"label": "{"}, "r": {"label": "}"}},
                    {
                        "c": {"label": 5},
                        "u": {"label": "%"},
                        "l": {"label": "\\"},
                        "r": {"label": "|"}
                    },
                    {"c": {"label": 4}, "u": {"label": "$"}, "l": {"label": ";"}, "r": {"label": ":"}},
                    {
                        "c": {"label": 3},
                        "u": {"label": "#"},
                        "l": {"label": "'"},
                        "r": {"label": "\""}
                    },
                    {"c": {"label": 2}, "u": {"label": "@"}, "l": {"label": "<"}, "r": {"label": ">"}},
                    {
                        "c": {"label": 1},
                        "u": {"label": "!"},
                        "d": {"label": "Esc", code: android.KEYCODE_ESCAPE}
                    }
                ]
            };
            // TODO 所有的meta key总是使用left，不要使用right，因为一边足够
            data['meta_down_' + android.KEYCODE_SHIFT_LEFT] = false;
            data['meta_down_' + android.KEYCODE_ALT_LEFT] = false;
            data['meta_down_' + android.KEYCODE_CTRL_LEFT] = false;
            data['meta_down_' + android.KEYCODE_META_LEFT] = false;
            return data;
        }
    });
});