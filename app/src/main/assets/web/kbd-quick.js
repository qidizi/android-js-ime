// 快捷短语保存在localStorage的key
const QUICK_INPUT_ITEM_NAME = 'quick_input_list';
Vue.component('kbd-quick', {
    data() {
        return {
            show: false,
            quick_input: localStorage.getItem(QUICK_INPUT_ITEM_NAME),
            kbd: []
        };
    },
    mounted() {
        // 加载快捷短语
        this.$on('r>l', this.on_show);
        this.$on('hide', this.on_hide);
        this.$on('touch', this.on_touch);
        //this.$root.$emit('register_default', this, this.show = true);
    },
    computed: {
        quick_input_parse() {
            // 注意需要自行赋值，不是return

            let kbd = [
                {
                    c: {label: '返回', fn: this.on_back},
                    u: {label: '调整', fn: this.on_kbd_copy},
                    l: {label: '导入', fn: this.on_kbd_paste}
                }
            ];
            let sides;
            let max_cell = 10;
            // 倒着追加，保证底行（首先右边）是满
            let lines = (this.quick_input || '').split('\n');
            //for (let i = 1; i < location.search.replace('?', ''); i++) lines.push(i + ' ' + i);
            lines.forEach(function (line, i) {
                line = line.trim();
                if ('' === line) return;
                let first_space = line.indexOf(' ');
                let display = line.substr(0, first_space);
                let text = line.substr(first_space + 1).trim();
                if ('' === text) return;

                while (true) {
                    if (!sides || !sides.length) {
                        kbd.push({});
                        sides = 'c,u,r,d,l'.split(',');
                    }

                    let cell = kbd.length % max_cell;

                    if (
                        // 会出现次个l空，然后左边只有一个c，因为flex布局无法处理
                        (i >= lines.length - 1 && cell > 7 && 'l' === sides[0]) || // 最后一个如果大于7就不放左侧
                        (1 === cell && 'r' === sides[0]) || // 最右侧，不能放r
                        (0 === cell && "l" === sides[0]) || // 右侧不能放l
                        (kbd.length <= max_cell && 'd' === sides[0]) // 底行，不能放d
                    ) {
                        sides.shift();
                        continue;
                    }

                    kbd[kbd.length - 1][sides.shift()] = {label: display, text: text};
                    return;
                }
            });
            return this.kbd = kbd;
        }
    },
    methods: {
        on_touch(ev) {
            if (ev.custom_key) {
                // 手势u、d、l、r；tab、long_tab
                let kbd_obj = this.kbd[ev.custom_kbd_i][ev.custom_key];
                if (!kbd_obj) return;
                // 优先fn
                if (kbd_obj.fn)
                    kbd_obj.fn.call(this, ev.custom_kbd, ev);
                else if (kbd_obj.code)
                    java.send_key_press(kbd_obj.code);
                else if (kbd_obj.text)
                    java.send_text(kbd_obj.text);
                else
                    java.send_text(kbd_obj.label);
                return true;
            }
        },
        on_show() {
            // 不支持从其它键盘返回
            this.$root.$emit('child_show', this, false);
            this.show = true;
        },
        on_hide() {
            this.show = false;
        },
        on_back() {
            this.$root.$emit('back', this);
            this.on_hide();
        },
        on_kbd_copy() {
            let lines = localStorage.getItem(QUICK_INPUT_ITEM_NAME) || '';
            navigator.clipboard.writeText(lines).then(function () {
                /* clipboard successfully set */
            }, function () {
                /* clipboard write failed */
            });
        },
        on_kbd_paste() {
            // 保存
            let lines = '';
            navigator.clipboard.readText().then(
                clipText => lines = clipText
            );
            localStorage.setItem(QUICK_INPUT_ITEM_NAME, lines);
            // 更新快捷键盘
            this.quick_input = lines;
        }
    },
    template: '<section class="quick_words" v-show="show">' +
        '<kbd  v-show="show" v-for="(kv,i) in quick_input_parse" :data-i="i">' +
        '<key class="kbd-c" v-if="kv.c">{{kv.c.label}}</key>' +
        '<key class="kbd-u" v-if="kv.u">{{kv.u.label}}</key>' +
        '<key class="kbd-d" v-if="kv.d">{{kv.d.label}}</key>' +
        '<key class="kbd-l" v-if="kv.l">{{kv.l.label}}</key>' +
        '<key class="kbd-r" v-if="kv.r">{{kv.r.label}}</key>' +
        '</kbd>' +
        '</section>'

})
;
