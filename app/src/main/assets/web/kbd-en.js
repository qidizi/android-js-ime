Vue.component('kbd-en', {
    mounted() {
        this.$on(['U_D','show'], this.on_show);
        this.$on('hide', this.on_hide);
        this.$on('tab', this.on_tab);
        this.$on('long_tab', this.on_long_tab);
        this.$root.$emit('register_default', this);
    },
    methods: {
        on_show() {
            // 不支持从其它键盘返回
            this.$root.$emit('child_show', this, true);
            this.show = true;
            console.log('en')
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
        'on_U'(ev) {
            console.log(ev.target, ev.type);
        },
        'on_D'(ev) {
            console.log(ev.target, ev.type);
        },
        'on_L'(ev) {
            console.log(ev.target, ev.type);
        },
        'on_R'(ev) {
            console.log(ev.target, ev.type);
        },
        get_meta_state(touch) {
            // 获取控制键状态组合
            let state = 0;
            // 任何已经按下的控制键，在使用一次后自动恢复
            if (this.shift_down || (touch && touch.with_shift)) {
                state |= java.META_SHIFT_MASK;
            }

            if (this.ctrl_down || (touch && touch.with_ctrl)) {
                state |= java.META_CTRL_MASK;
            }

            if (this.alt_down) {
                state |= java.META_ALT_MASK;
            }

            if (this.meta_down) {
                state |= java.META_META_MASK;
            }

            return state;
        },
        ch() {


            switch (touch.android_code) {
                // 放开触摸时，才会改变控制键的状态
                case 'KEYCODE_SHIFT_LEFT':
                case 'KEYCODE_SHIFT_RIGHT':
                    this.shift_down = !this.shift_down;
                    break;
                case 'KEYCODE_ALT_LEFT':
                case 'KEYCODE_ALT_RIGHT':
                    this.alt_down = !this.alt_down;
                    break;
                case 'KEYCODE_CTRL_LEFT':
                case 'KEYCODE_CTRL_RIGHT':
                    this.ctrl_down = !this.ctrl_down;
                    break;
                case 'KEYCODE_META_LEFT':
                case 'KEYCODE_META_RIGHT':
                    this.meta_down = !this.meta_down;
                    break;
            }
        }
    },
    template: '<div class="kbd-en" v-show="show">' +
        '<section  v-for="kvs in kbd">' +
        '<kbd  v-for="kv in kvs" :class="kv.cls">' +
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
            show: true,
            kbd: [
                [
                    {
                        c: {label:1},
                        u: {label:'!'},
                    },
                    {
                        c: {label:2},
                        u: {label:'@'},
                        l: {label:'<'},
                        r: {label:'>'},
                    },
                    {
                        c: {label:3},
                        u: {label:'#'},
                        l: {label:"'"},
                        r: {label:'"'},
                    },
                    {
                        c: {label:4},
                        u: {label:'$'},
                        l: {label:';'},
                        r: {label:':'},
                    },
                    {
                        c: {label:5},
                        u: {label:'%'},
                        l: {label:'\\'},
                        r: {label:'|'},
                    },
                    {
                        c: {label:6},
                        u: {label:'^'},
                        l: {label:'{'},
                        r: {label:'}'},
                    },
                    {
                        c: {label:7},
                        u: {label:'&'},
                        l: {label:'['},
                        r: {label:']'},
                    },
                    {
                        c: {label:8},
                        u: {label:'*'},
                        l: {label:'~'},
                        r: {label:'`'},
                    },
                    {
                        c: {label:9},
                        u: {label:'('},
                        l: {label:'_'},
                        r: {label:'+'},
                    },
                    {
                        c: {label:0},
                        u: {label:')'},
                        l: {label:'-'},
                        r: {label:'='},
                    },

                ], [
                    {
                        c: {label:'Q'},
                        u: {label:'F1'},
                        d: {label:'F11'},
                    },
                    {
                        c: {label:'W'},
                        u: {label:'F2'},
                        d: {label:'F12'},
                    },
                    {
                        c: {label:'E'},
                        u: {label:'F3'},
                    },
                    {
                        c: {label:'R'},
                        u: {label:'F4'},
                    },
                    {
                        c: {label:'T'},
                        u: {label:'F5'},
                    },
                    {
                        c: {label:'Y'},
                        u: {label:'F6'},
                    },
                    {
                        c: {label:'U'},
                        u: {label:'F7'},
                    },
                    {
                        c: {label:'I'},
                        u: {label:'F8'},
                    },
                    {
                        c: {label:'O'},
                        u: {label:'F9'},
                    },
                    {
                        c: {label:'P'},
                        u: {label:'F10'},
                    }
                ], [
                    {
                        c: {label:'A'},
                    },
                    {
                        c: {label:'S'},
                    },
                    {
                        c: {label:'D'},
                    },
                    {
                        c: {label:'F'},
                    },
                    {
                        c: {label:'G'},
                    },
                    {
                        c: {label:'H'},
                    },
                    {
                        c: {label:'J'},
                    },
                    {
                        c: {label:'K'},
                    },
                    {
                        c: {label:'L'},
                    },
                    {
                        cls: 'kbd_l_w'
                    }
                ], [

                    {
                        cls:'kbd_z_w'

                    },

                    {
                        c: {label:'Z'},
                    },
                    {
                        c: {label:'X'},
                    },
                    {
                        c: {label:'C'},
                    },
                    {
                        c: {label:'V'},
                    },
                    {
                        c: {label:'B'},
                    },
                    {
                        c: {label:'N'},
                    },
                    {
                        c: {label:'M'},
                    },
                    {
                        c: {label:','},
                    },
                    {
                        c: {label:'⌫'},
                        cls:'kbd_bs_w'
                    }
                ], [
                    {
                        c: {label:'⇦'},
                    },
                    {
                        c: {label:'⇧'},
                    },
                    {
                        c: {label:'⇩'},
                    },
                    {
                        c: {label:'⇨'},
                    },
                    {
                        c: {label:' 🄰'},
                    },
                    {
                        c: {label:'␣'},
                        cls: 'kbd_m_w'
                    },
                    {
                        c: {label:'.'},
                    },
                    {
                        c: {label:'/'},
                    },
                    {
                        c: {label:'⏎'},
                        cls: 'kbd_m_w'
                    }
                ]
            ],
        };
    }
});
