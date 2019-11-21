Vue.component('kbd-wu_bi', {
    mounted() {
        this.$on('D_U', this.on_show);
        this.$on('hide', this.on_hide);
        this.$on('tab', this.on_tab);
        this.$on('long_tab', this.on_long_tab);
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
        on_tab(ev) {
            console.log(ev.target, ev.type);
        },
        'on_long_tab'(ev) {
            console.log(ev.target, ev.type);
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
        }
        /* {
             a: show_custom_candidates($event,
                 ['…', '「', '」', '『', '』', '〔', '〕', '【', '】', '——', '……', '—', '《', '》', '〈', '〉', '[', ']', '﹏﹏', '___']
             )
         },*/
    },

    template: '<div class="kbd-wu-bi" v-show="show">' +
        '<section  v-for="kvs in kbd">' +
        '<kbd  v-for="kv in kvs">' +
        '<b class="kbd-c" v-if="kv.c">{{kv.c.text}}</b>' +
        '<b class="kbd-u" v-if="kv.u">{{kv.u.text}}</b>' +
        '<b class="kbd-d" v-if="kv.d">{{kv.d.text}}</b>' +
        '<b class="kbd-l" v-if="kv.l">{{kv.l.text}}</b>' +
        '<b class="kbd-r" v-if="kv.r">{{kv.r.text}}</b>' +
        '</kbd>' +
        '</section>' +
        '</div>'
    , data() {
        return {
            show: false,
            kbd: [
                [
                    {
                        c: {text: 1},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 2},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 3},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 4},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 5},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 6},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 7},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 8},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 9},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 0},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },

                ], [
                    {
                        c: {text: 'Q'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'W'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'E'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'R'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'T'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'Y'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'U'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'I'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'O'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'P'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    }
                ], [
                    {
                        c: {text: 'A'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'S'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'D'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'F'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'G'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'H'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'J'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'K'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'L'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    }
                ], [

                    {
                        c: {text: 'Z'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'X'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'C'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'V'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'B'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'N'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'M'},
                        u: {text: 'u'},
                        d: {text: 'd'},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    }
                ], [

                    {
                        c: {text: 'Ctrl'},
                        u: {text: 'Alt'},
                        d: {text: ''},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: 'Alt'},
                        u: {text: 'Alt'},
                        d: {text: ''},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: '␣'},
                        u: {text: 'Alt'},
                        d: {text: ''},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: '⏎'},
                        u: {text: 'Alt'},
                        d: {text: ''},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    },
                    {
                        c: {text: '⌫'},
                        u: {text: 'Alt'},
                        d: {text: ''},
                        l: {text: 'l'},
                        r: {text: 'r'},
                    }
                ]
            ],
        };
    }
});
