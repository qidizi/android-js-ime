Vue.component('kbd-wu-bi', {
    mounted() {
        this.$on(['D_U','show'], this.on_show);
        this.$on('hide', this.on_hide);
        this.$on('tab', this.on_tab);
        this.$on('long_tab', this.on_long_tab);
    },
    methods: {
        on_show() {
            // 不支持从其它键盘返回
            this.$root.$emit('child_show', this, true);
            this.show = true;
            console.log('cn')

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
        '<key class="kbd-c" v-if="kv.c">{{kv.c.label}}</key>' +
        '<key class="kbd-u" v-if="kv.u">{{kv.u.label}}</key>' +
        '<key class="kbd-d" v-if="kv.d">{{kv.d.label}}</key>' +
        '<key class="kbd-l" v-if="kv.l">{{kv.l.label}}</key>' +
        '<key class="kbd-r" v-if="kv.r">{{kv.r.label}}</key>' +
        '</kbd>' +
        '</section>' +
        '</div>'
    , data() {
        return {
            show: false,
            kbd: [
                [
                    {
                        c: {label: 1},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 2},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 3},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 4},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 5},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 6},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 7},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 8},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 9},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 0},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },

                ], [
                    {
                        c: {label: 'Q'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'W'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'E'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'R'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'T'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'Y'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'U'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'I'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'O'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'P'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    }
                ], [
                    {
                        c: {label: 'A'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'S'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'D'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'F'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'G'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'H'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'J'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'K'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'L'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    }
                ], [

                    {
                        c: {label: 'Z'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'X'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'C'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'V'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'B'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'N'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'M'},
                        u: {label: 'u'},
                        d: {label: 'd'},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    }
                ], [

                    {
                        c: {label: 'Ctrl'},
                        u: {label: 'Alt'},
                        d: {label: ''},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: 'Alt'},
                        u: {label: 'Alt'},
                        d: {label: ''},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: '␣'},
                        u: {label: 'Alt'},
                        d: {label: ''},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: '⏎'},
                        u: {label: 'Alt'},
                        d: {label: ''},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    },
                    {
                        c: {label: '⌫'},
                        u: {label: 'Alt'},
                        d: {label: ''},
                        l: {label: 'l'},
                        r: {label: 'r'},
                    }
                ]
            ],
        };
    }
});
