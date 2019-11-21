// 快捷短语保存在localStorage的key
const QUICK_INPUT_ITEM_NAME = 'quick_input_list';
Vue.component('kbd-quick', {
    data() {
        return {
            show: false,
            show_kbd: true,
            lines: '',
            quick_input: localStorage.getItem(QUICK_INPUT_ITEM_NAME)
        };
    },
    mounted() {
        // 加载快捷短语
        this.$on('R_L', this.on_show);
        this.$on('hide', this.on_hide);
    },
    computed: {
        quick_input_parse() {
            // 注意需要自行赋值，不是return
            let new_list = [];
            let kbd = {};
            let sides = ['c', 'u', 'd', 'l', 'r'];
            let side_i = 0;
            this.quick_input.split('\n').forEach(function (line) {
                line = line.trim();
                if ('' === line) return;
                let first_space = line.indexOf(' ');
                let display = line.substr(0, first_space);
                let text = line.substr(first_space + 1)
                    .trim().replace(/\\n/g, '\n');
                if ('' === text) return;

                if (side_i >= sides.length) {
                    side_i = 0;
                    kbd = {};
                }

                kbd[sides[side_i++]] = [display, text];
                new_list.push(kbd);
            });

            if (kbd && kbd.c) new_list.push(kbd);
            return new_list;
        }
    },
    methods: {
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
        on_editor_paste() {
            this.$el.querySelector('textarea').focus();
            document.execCommand('paste', false, this.lines);
        },
        on_editor_copy() {
            document.execCommand('copy', false, this.lines);
        },
        on_editor_cancel() {
            this.show_kbd = true;
            this.lines = '';
        },
        on_editor_save() {
            // 保存
            localStorage.setItem(QUICK_INPUT_ITEM_NAME, this.lines);
            // 更新快捷键盘
            this.quick_input = this.lines;
            this.show_kbd = true;
            this.lines = '';
        },
        on_editor_show() {
            this.lines = localStorage.getItem(QUICK_INPUT_ITEM_NAME) || '';
            this.show_kbd = false;
        }
    },
    template: '<div class="quick" v-show="show">' +
        '<div class="textarea" v-show="!show_kbd">' +
        '<textarea placeholder="不支持直接编辑，格式如下：\n\n1键面文字 上屏文字\n2键面文字 上屏文字" ' +
        'rows="10" v-model.trim="lines" readonly="readonly">' +
        '</textarea>' +
        '<button @click="on_editor_paste">粘贴</button>' +
        '<button @click="on_editor_copy">复制</button>' +
        '<button @click="on_editor_save">保存</button>' +
        '<button @click="on_editor_cancel">取消</button>' +
        '</div>' +
        '<div>' +
        '<section class="quick_words">' +
        '<kbd  v-show="show_kbd" v-for="kv in quick_input_parse">' +
        '<b class="kbd-c" v-if="kv.c">{{kv.c[0]}}</b>' +
        '<b class="kbd-u" v-if="kv.u">{{kv.u[0]}}</b>' +
        '<b class="kbd-d" v-if="kv.d">{{kv.d[0]}}</b>' +
        '<b class="kbd-l" v-if="kv.l">{{kv.l[0]}}</b>' +
        '<b class="kbd-r" v-if="kv.r">{{kv.r[0]}}</b>' +
        '</kbd>' +
        '</section>' +
        '</div>' +
        '</div>'
});
