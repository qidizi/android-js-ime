function vue_quick(name) {
    Vue.component(name, {
        data() {
            return {
                lines: '',
                show_editor: false,
                show: false,
                quick_input: java.quick_word(),
                kbd: []
            };
        },
        mounted() {
            // 加载快捷短语
            this.$root.$on('0-r>l', this.on_show);
            this.$on('hide', this.on_hide);
            this.$root.$on('touch.' + name, this.on_touch);
        },
        computed: {
            'quick_input_parse'() {
                // 注意需要自行赋值，不是return
                let kbd = [];
                let _this = this;
                let sides;
                let max_cell = 10;
                // 倒着追加，保证底行（首先右边）是满
                let lines = (this.quick_input || '').trim().split('\n');
                // 加入调整按钮
                lines.unshift('⚙ 自定方法');
                // 单字标题
                let label_1 = [];
                // 双字标题
                let label_2 = [];
                lines.forEach(function (line, i) {
                    line = line.trim();
                    if ('' === line) return;
                    let first_space = line.indexOf(' ');
                    let display = line.substr(0, first_space);
                    let text = line.substr(first_space + 1).trim();
                    if ('' === text) return;

                    display.length === 1 ?
                        label_1.push([display, text]) :
                        label_2.push([display, text]);
                });

                let count = label_1.length + label_2.length;
                let is_first = 1, row = 1, cell = 1;
                while (label_1.length || label_2.length) {
                    while (true) {
                        if (!sides || !sides.length) {
                            kbd.push({});
                            sides = 'c,u,r,l,d'.split(',');
                        }

                        let row = Math.ceil(kbd.length / max_cell) || 1, // 最小是1
                            cell = kbd.length ? kbd.length % max_cell || 10 : 1,// 最小是1,第10列把0变成10
                            side = sides.shift(),
                            row_count = 50 // 每行最多放多少个键标
                        ;

                        if (
                            // 本行会满行(首行或其它行),且当前属于首列的l,不放
                            (count / row_count >= row && cell === 1 && 'l' === side) ||
                            // 最右列r不放
                            (cell === max_cell && 'r' === side) ||
                            (row >= 5 && row * row_count >= count && 'd' === side) ||// 底行，不能放d;当前设计是至少支持5行
                            ('c' === side && !label_1.length) // 中间,但是没有单字标题了
                        ) {
                            // 浪费了键标后,要追加个数(相当于剩余数量增加了)
                            count++;
                            continue;
                        }

                        let qw = 'c' === side ? label_1.shift() :
                            // 4边,优先用双字标题
                            (label_2.length ? label_2.shift() : label_1.shift());
                        let key = {label: qw[0], text: qw[1]}

                        if (is_first) {
                            // 编辑按钮
                            delete key.text;
                            key.fn = _this.on_edit;
                        }

                        is_first = 0;
                        kbd[kbd.length - 1][side] = key;
                        // 跳出 true这个while
                        break;
                    }
                }

                return this.kbd = kbd;
            }
        },
        methods: {
            on_touch(ev) {
                if (ev.custom_key && 'long_tab' !== ev.custom_type) {
                    // 手势u、d、l、r；tab、long_tab
                    let kbd_obj = this.kbd[ev.custom_kbd_i][ev.custom_key];
                    if (!kbd_obj) return;
                    ev.custom_kbd_obj = kbd_obj;

                    // 优先fn
                    if (kbd_obj.fn)
                        kbd_obj.fn.call(this, ev);
                    else if (kbd_obj.text)
                        java.send_text(kbd_obj.text);
                    else
                        java.send_text(kbd_obj.label);
                }
            },
            on_show() {
                // 不支持从其它键盘返回
                this.$root.$emit('child_show', this);
                this.show = true;
            },
            on_hide() {
                // 收到其它组件通知的隐藏
                this.show_editor = false;
                this.show = false;
            },
            'on_close'() {
                // 本身触发的隐藏
                this.$root.$emit('child_hide', this);
                this.on_hide();
            },
            on_edit() {
                this.lines = java.quick_word() || '';
                this.show_editor = true;
            },
            'on_save'() {
                // 保存
                this.show_editor = false;
                java.quick_word(this.lines);
                // 更新快捷键盘
                this.quick_input = this.lines;
                this.lines = '';
            },
            'on_edit_cancel'() {
                this.show_editor = false;
                this.lines = '';
            },
            get_key_class(which, kv) {
                let obj = kv[which];
                if (!obj) return 'hide';
                let cls = which;
                if (obj.cls) cls += ' ' + obj.cls;
                return cls + ' key';
            },
        },
        template: `
        <kbd id="${name}" class="${name} kbd" v-show="show">
        
        <footer class="editor_box" v-show="show_editor">
            <textarea 
            class="quick_editor"
             placeholder="说明   请剪出编辑，再贴回应用\n键面文字       上屏内容文字\n键面文字2     上屏内容文字2\n"
             v-model.trim="lines"
             ></textarea>
             <button class="cancel btn" @click.stop.prevent="on_edit_cancel">取消</button>
             <button class="apply btn" @click.stop.prevent="on_save">应用</button>
         </footer>
         
            <kbd  :class="(kv.cls||'') + ' keys'" :data-i="i"  v-for="(kv,i) in quick_input_parse" >
                <kbd :class="get_key_class('c',kv)" v-if="kv.c">{{kv.c.label}}</kbd>
                <kbd :class="get_key_class('u',kv)" v-if="kv.u">{{kv.u.label}}</kbd>
                <kbd :class="get_key_class('d',kv)" v-if="kv.d">{{kv.d.label}}</kbd>
                <kbd :class="get_key_class('l',kv)" v-if="kv.l">{{kv.l.label}}</kbd>
                <kbd :class="get_key_class('r',kv)" v-if="kv.r">{{kv.r.label}}</kbd>
            </kbd>       
        </kbd>
`

    })
    ;
}
