// 码表中码词之间分隔符
const WU_BI_KEY_WORD_SEPARATE = ' ';
// 码表中2组kw之间分隔
const WU_BI_KEY_WORD_GROUP_SEPARATE = '\n';
// 这个词库建议从qq五笔中导出它的系统词库
ajax('vue_wu_bi_dict.txt?' + +new Date, function (str) {
    window.vue_wu_bi_dict = {};
    let start = 0;
    for (let i = 'a'.charCodeAt(0); i <= 'z'.charCodeAt(0); i++) {
        let char = String.fromCharCode(i);

        if ('y' === char) {
            vue_wu_bi_dict[char] = str.substring(start).trim();
            break;
        }

        let next_char = str.indexOf(
            WU_BI_KEY_WORD_GROUP_SEPARATE + String.fromCharCode(i + 1)
        );
        vue_wu_bi_dict[char] = str.substring(start, next_char + 1).trim();
        start = next_char + 1;
    }
});

function vue_wu_bi(name) {
// 匹配中文，候选框只显示前面x个
    const CANDIDATE_LIMIT = 100;

    Vue.component(name, {
        mounted() {
            this.$root.$on('0-d>u', this.on_show);
            this.$on('hide', this.on_hide);
            this.$on('reset_zh', this.keyboard_reset);
        },
        methods: {
            on_show() {
                // 注册hook
                this.$root.$emit('child_show', this,  (ev)=> {
                    return this.on_touch(ev);
                });
                this.show = false;
                this.$root.is_zh = 1;
            },
            on_hide() {
                this.show = false;
                this.$root.is_zh = 0;
            },
            on_touch(ev) {
                if (!ev.custom_key) return;
                // 手势u、d、l、r；tab、long_tab
                let kbd_obj = ev.custom_kbd_obj;
                if (!kbd_obj) return;
                if (kbd_obj.code) {
                    if ('long_tab' === ev.custom_type) {
                        this.on_long_press(kbd_obj.code);
                    } else
                        this.wu_bi_code(kbd_obj.code);
                    return true;
                } else if (/^[A-Z]$/.test(kbd_obj.label)) {
                    this.wu_bi_code(kbd_obj.label.toLowerCase());
                    return true;
                }

                return false;
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
                } else {
                    // 全是英文,追加
                    keys += code_or_label;
                }

                // 开始匹配码表和显示候选
                let match_words = [];

                // 已经无匹配的,就不需要再匹配了
                if (
                    !(
                        // 无码了
                        !keys.length
                        ||
                        // 无候选,且还加码
                        (this.keys.length && keys.length > this.keys.length && !this.candidates.length)
                    )
                ) {
                    let words = WU_BI_KEY_WORD_GROUP_SEPARATE + vue_wu_bi_dict[keys[0]];
                    //let start_time = +new Date;
                    // 大概意思是只取前n个以该码开头的匹配
                    // 注意词库并不一定是按key的顺序排序，所以，顺序的key并不会出现在顺排位置，而是按词频来排序
                    let reg = new RegExp(
                        WU_BI_KEY_WORD_GROUP_SEPARATE + keys
                        + '[^' + WU_BI_KEY_WORD_GROUP_SEPARATE + ']+',
                        'g'
                    );
                    // 注意使用的词库是支持单行多义，如： kkkk 口 咒骂
                    let kw, limit = CANDIDATE_LIMIT;

                    while (limit-- > 0 && (kw = reg.exec(words))) {
                        kw = kw[0].trim().split(WU_BI_KEY_WORD_SEPARATE);

                        for (let i = 1; i < kw.length; i++)
                            match_words.push({keys: kw[0], words: kw[i]});
                    }

                }

                this.keys = keys;
                this.candidates = match_words;
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
            'choice_candidate'(word) {
                java.send_text(word);
                this.keyboard_reset();
            },
            get_key_class(which, kv) {
                let obj = kv[which];
                if (!obj) return 'hide';
                let cls = which;
                if (obj.cls) cls += ' ' + obj.cls;
                return cls + ' key';
            },
        },

        //http://xahlee.info/comp/unicode_computing_symbols.html
        template: `            
        <kbd id="${name}" class="${name} kbd" v-show="show">
            <header class="candidates">
                <template v-if="candidates.length">
                    
                    <samp v-for="(t,i) in candidates"
                     @click.stop.prevent="choice_candidate(t.words)">
                        <sup>
                            <mark>{{keys}}</mark>{{t.keys.substr(keys.length)}}
                        </sup>
                        <sub>{{t.words}}</sub>
                    </samp>
                    
                </template>
                <template v-else>
                    
                    <samp 
                     @click.stop.prevent="choice_candidate(keys)">
                        <sup>
                            <mark>{{keys}}</mark>
                        </sup>
                        <sub></sub>
                    </samp>
                    
                </template>
            </header>
        </kbd>
    `,
        watch: {
            keys: function (val) {
                this.show = '' !== val.trim();
            }
        },
        data() {
            return {
                candidates: [],
                keys: '',
                show: false
            };
        }
    });
}
