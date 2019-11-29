window.addEventListener('load', function () {
// 匹配中文，候选框只显示前面x个
    const CANDIDATE_LIMIT = 15;
// 码表中码词之间分隔符
    const CODE_LIST_KEY_WORD_SEPARATE = ' ';
// 码表中2组kw之间分隔
    const CODE_LIST_SEPARATE = ',';

    Vue.component('kbd-wu-bi', {
        mounted() {
            this.$on(['d>u', 'show'], this.on_show);
            this.$on('hide', this.on_hide);
            this.$on('touch', this.on_touch);
            //this.$root.$emit('register_default', this, this.show = true);
        },
        methods: {
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
                    else if (kbd_obj.code) {
                        if ('long_tab' === ev.custom_type) {
                            this.on_long_press(kbd_obj.code);
                        } else
                            this.wu_bi_code(kbd_obj.code);
                        return;
                    } else if (kbd_obj.text)
                        java.send_text(kbd_obj.text);
                    else if (/^[A-Z]$/.test(kbd_obj.label)) {
                        this.wu_bi_code(kbd_obj.label.toLowerCase());
                        return;
                    } else
                        java.send_text(kbd_obj.label);
                    this.keyboard_reset();
                }
            },
            wu_bi_code(code_or_label) {
                let keys = this.keys;

                if (code_or_label === android.KEYCODE_DEL) {
                    // 向左删除
                    if (!keys) {
                        // 没有键码，直接向系统发送删除事件
                        java.send_key_press(code_or_label);
                        return;
                    }

                    keys = keys.replace(/.$/, '');

                    if (!keys) {
                        // 变空了
                        this.keyboard_reset();
                        return;
                    }
                } else if (code_or_label === android.KEYCODE_SPACE) {
                    if (this.candidates.length) {
                        // 有候选,首个上屏
                        let cd = this.candidates[0];
                        java.send_text(cd.words);
                    } else if (!keys.length) {
                        // 没键码缓存,向系统发送空格事件
                        java.send_key_press(code_or_label);
                    }
                    // 重置
                    this.keyboard_reset();
                    return;
                } else if (code_or_label === android.KEYCODE_ENTER) {
                    if (keys.length) {
                        // 有缓存键码，键码上屏
                        java.send_text(keys);
                    } else {
                        // 发送空格事件
                        java.send_key_press(code_or_label);
                    }
                    this.keyboard_reset();
                    return;
                } else if (
                    code_or_label === android.KEYCODE_DPAD_LEFT ||
                    code_or_label === android.KEYCODE_DPAD_RIGHT ||
                    code_or_label === android.KEYCODE_DPAD_UP ||
                    code_or_label === android.KEYCODE_DPAD_DOWN ||
                    code_or_label === android.KEYCODE_FORWARD_DEL
                ) {
                    java.send_key_press(code_or_label);
                    return;
                } else {
                    // 全是英文,追加
                    if (keys && !this.candidates.length) {
                        // 前面的码已经没有匹配了，忽略本key
                        return;
                    }

                    keys += code_or_label;
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
                    let match = window['wu_bi_' + keys.substr(0, 1)].match(reg);
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
                            java.send_text(tmp[0].words);
                            this.keyboard_reset();
                            return;
                        }
                    }
                }

                this.keys = keys;
                this.candidates = tmp;
            },
            "on_long_press"(code) {
                // 五笔键盘长按事件

                switch (code) {
                    case android.KEYCODE_DEL:
                        // 长按立刻
                        if (this.keys) {
                            this.keyboard_reset();
                            return;
                        }

                        java.send_key_press(code);
                        break;
                    case android.KEYCODE_SPACE:
                        if (this.candidates && this.candidates.length) {
                            java.send_text(this.candidates[0].words);
                            this.keyboard_reset();
                            return;
                        }

                        java.send_key_press(code);
                        break;
                    case android.KEYCODE_ENTER:
                        if (this.keys) {
                            java.send_text(this.keys);
                            this.keyboard_reset();
                            return;
                        }

                        java.send_key_press(code);
                        break;
                }
            },
            keyboard_reset() {
                // 重置中文输入状态
                this.candidates = [];
                this.keys = '';
            },
            choice_candidate(word) {
                java.send_text(word);
                this.keyboard_reset();
            }
        },

        //http://xahlee.info/comp/unicode_computing_symbols.html
        template: `
        <section class="kbd-wu-bi" v-show="show">

            <kbd  v-for="(kv,i) in kbd" :class="kv.cls" :data-i="i">
            <key class="c" v-if="kv.c">{{kv.c.label}}</key>
            <key class="u" v-if="kv.u">{{kv.u.label}}</key>
            <key class="d" v-if="kv.d">{{kv.d.label}}</key>
            <key class="l" v-if="kv.l">{{kv.l.label}}</key>
            <key class="r" v-if="kv.r">{{kv.r.label}}</key>
            </kbd>
            
            <nav class="candidates">
            <code v-for="(t,i) in candidates" @click.stop.prevent="choice_candidate(t.words)">
            <sup>
            <b>{{keys}}</b>{{t.keys.substr(keys.length)}}
            </sup>
            <sub>{{t.words}}</sub>
            </code>
            </nav>
            
            </section>
    `,
        data() {
            return {
                candidates: [],
                keys: '',
                show: false,
                kbd: [
                    {"c": {"label": "⏎", code: android.KEYCODE_ENTER}, "cls": "kbd_150"},
                    {"c": {"label": "？"}},
                    {
                        "c": {"label": "。"},
                        "r": {"label": "、"},
                        "u": {"label": "》"}
                    },
                    {
                        "c": {"label": "，"},
                        "l": {"label": "："},
                        "r": {"label": "；"},
                        "u": {"label": "《"}
                    },
                    {
                        "c": {"label": "␣", code: android.KEYCODE_SPACE},
                        "cls": "kbd_150"
                    },
                    {"c": {"label": "⇨", code: android.KEYCODE_DPAD_RIGHT}},
                    {"c": {"label": "⇩", code: android.KEYCODE_DPAD_DOWN}},
                    {"c": {"label": "⇧", code: android.KEYCODE_DPAD_UP}},
                    {"c": {"label": "⇦", code: android.KEYCODE_DPAD_LEFT}},
                    {
                        "c": {"label": "⌫", code: android.KEYCODE_DEL},
                        "u": {"label": "⌦", code: android.KEYCODE_FORWARD_DEL},
                        "cls": "kbd_bs_w"
                    },
                    {"c": {"label": "！"},},

                    {"c": {"label": "M"}, "l": {"label": "“"}, "r": {"label": "”"}},
                    {
                        "c": {"label": "N"},
                        "l": {"label": "‘"},
                        "r": {"label": "’"}
                    },
                    {"c": {"label": "B"}},
                    {
                        "c": {"label": "V"},
                        "l": {"label": "["},
                        "r": {"label": "]"}
                        , u: {label: '粘贴', code: android.KEYCODE_PASTE}
                    },
                    {
                        "c": {"label": "C"},
                        "l": {"label": "〔"},
                        "r": {"label": "〕"}
                        , u: {label: '复制', code: android.KEYCODE_COPY}
                    },
                    {
                        "c": {"label": "X"},
                        "l": {"label": "【"},
                        "r": {"label": "】"}
                        , u: {label: '剪切', code: android.KEYCODE_CUT}
                    },
                    {
                        "c": {"label": "Z"},
                        "u": {"label": "__"},
                        "d": {"label": "～"},
                        "l": {"label": "－"},
                        "r": {"label": "-"}
                        , cls: 'kbd_z_margin_left'
                    },
                    {"c": {"label": "L"}, cls: 'kbd_l_margin_right'},
                    {
                        "c": {"label": "K"},
                        "u": {"label": "﹏﹏"},
                        "d": {"label": "__"},
                        "l": {"label": "<"},
                        "r": {"label": ">"}
                    },
                    {
                        "u": {"label": "——"},
                        "c": {"label": "J"},
                        "l": {"label": "『"},
                        "r": {"label": "』"},
                        "cls": "kbd_j"
                    },
                    {
                        "c": {"label": "H"},
                        "l": {"label": "「"},
                        "r": {"label": "」"}
                    },
                    {"c": {"label": "G"}}, {
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
                        "d": {"label": "0"},
                        "u": {"label": "）"}
                    },
                    {"c": {"label": "O"}, "d": {"label": "9"}, "u": {"label": "（"}},
                    {
                        "c": {"label": "I"},
                        "d": {"label": "8"}
                    },
                    {"c": {"label": "U"}, "d": {"label": "7"}},
                    {
                        "c": {"label": "Y"},
                        "u": {"label": "……"},
                        "d": {"label": "6"}
                    },
                    {"c": {"label": "T"}, "d": {"label": "5"}},
                    {
                        "c": {"label": "R"},
                        "u": {"label": "¥"},
                        "d": {"label": "4"}
                    },
                    {"c": {"label": "E"}, "d": {"label": "3"}},
                    {
                        "c": {"label": "W"},
                        "d": {"label": "2"},
                        "r": {"label": "r"}
                    },
                    {"c": {"label": "Q"}, "d": {"label": "1"}}
                ]
            };
        }
    });
});
