function vue_quick(name) {
// 快捷短语保存在localStorage的key
    const QUICK_INPUT_ITEM_NAME = 'quick_input_list';
    Vue.component(name, {
        data() {
            return {
                lines: '',
                show_editor: false,
                show: false,
                quick_input: localStorage.getItem(QUICK_INPUT_ITEM_NAME),
                kbd: []
            };
        },
        mounted() {
            // 加载快捷短语
            this.$on('0-r>l', this.on_show);
            this.$on('hide', this.on_hide);
            this.$on('touch.' + name, this.on_touch);
        },
        computed: {
            quick_input_parse() {
                // 注意需要自行赋值，不是return
                let kbd = [];
                let _this = this;
                let sides;
                let max_cell = 10;
                // 倒着追加，保证底行（首先右边）是满
                let lines = (this.quick_input || '').trim().split('\n');
                lines.unshift('调整 自定方法');
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
                            sides = 'c,u,r,l,d'.split(',');
                        }

                        let cell = kbd.length % max_cell;

                        if (
                            // 首行不放上
                            (kbd.length < 11 && 'u' === sides[0]) ||
                            // 首列不放右(因右对齐
                            (1 === cell && 'r' === sides[0]) ||
                            (0 === cell && "l" === sides[0]) || // 右侧不能放l
                            (kbd.length <= max_cell && 'd' === sides[0]) // 底行，不能放d
                        ) {
                            sides.shift();
                            continue;
                        }

                        let key = {label: display, text: text}

                        if (0 === i) {
                            delete key.text;
                            key.fn = _this.on_edit;
                        }

                        kbd[kbd.length - 1][sides.shift()] = key;
                        return;
                    }
                });
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
            on_close() {
                // 本身触发的隐藏
                this.$root.$emit('child_hide', this);
                this.on_hide();
            },
            on_edit() {
                this.lines = localStorage.getItem(QUICK_INPUT_ITEM_NAME) || '';
                this.show_editor = true;
            },
            on_save() {
                // 保存
                this.show_editor = false;
                localStorage.setItem(QUICK_INPUT_ITEM_NAME, this.lines);
                // 更新快捷键盘
                this.quick_input = this.lines;
                this.lines = '';
            },
            on_edit_cancel() {
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
