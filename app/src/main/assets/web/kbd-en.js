Vue.component('kbd-en', {
    mounted() {
        this.$on('U_D', this.on_show);
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
            show: true,
            kbd: [
                [
                    {
                        c: {text: 1},
                        u: {text: '!'},
                    },
                    {
                        c: {text: 2},
                        u: {text: '@'},
                        l: {text: '<'},
                        r: {text: '>'},
                    },
                    {
                        c: {text: 3},
                        u: {text: '#'},
                        l: {text: "'"},
                        r: {text: '"'},
                    },
                    {
                        c: {text: 4},
                        u: {text: '$'},
                        l: {text: ';'},
                        r: {text: ':'},
                    },
                    {
                        c: {text: 5},
                        u: {text: '%'},
                        l: {text: '\\'},
                        r: {text: '|'},
                    },
                    {
                        c: {text: 6},
                        u: {text: '^'},
                        l: {text: '{'},
                        r: {text: '}'},
                    },
                    {
                        c: {text: 7},
                        u: {text: '&'},
                        l: {text: '['},
                        r: {text: ']'},
                    },
                    {
                        c: {text: 8},
                        u: {text: '*'},
                        l: {text: '~'},
                        r: {text: '`'},
                    },
                    {
                        c: {text: 9},
                        u: {text: '('},
                        l: {text: '_'},
                        r: {text: '+'},
                    },
                    {
                        c: {text: 0},
                        u: {text: ')'},
                        l: {text: '-'},
                        r: {text: '='},
                    },

                ], [
                    {
                        c: {text: 'Q'},
                        u: {text: 'F1'},
                        d: {text: 'F11'},
                    },
                    {
                        c: {text: 'W'},
                        u: {text: 'F2'},
                        d: {text: 'F12'},
                    },
                    {
                        c: {text: 'E'},
                        u: {text: 'F3'},
                    },
                    {
                        c: {text: 'R'},
                        u: {text: 'F4'},
                    },
                    {
                        c: {text: 'T'},
                        u: {text: 'F5'},
                    },
                    {
                        c: {text: 'Y'},
                        u: {text: 'F6'},
                    },
                    {
                        c: {text: 'U'},
                        u: {text: 'F7'},
                    },
                    {
                        c: {text: 'I'},
                        u: {text: 'F8'},
                    },
                    {
                        c: {text: 'O'},
                        u: {text: 'F9'},
                    },
                    {
                        c: {text: 'P'},
                        u: {text: 'F10'},
                    }
                ], [
                    {
                        c: {text: 'A'},
                    },
                    {
                        c: {text: 'S'},
                    },
                    {
                        c: {text: 'D'},
                    },
                    {
                        c: {text: 'F'},
                    },
                    {
                        c: {text: 'G'},
                    },
                    {
                        c: {text: 'H'},
                    },
                    {
                        c: {text: 'J'},
                    },
                    {
                        c: {text: 'K'},
                    },
                    {
                        c: {text: 'L'},
                    },
                    {
                        cls: 'kbd_l_w'
                    }
                ], [

                    {
                        cls:'kbd_z_w'

                    },

                    {
                        c: {text: 'Z'},
                    },
                    {
                        c: {text: 'X'},
                    },
                    {
                        c: {text: 'C'},
                    },
                    {
                        c: {text: 'V'},
                    },
                    {
                        c: {text: 'B'},
                    },
                    {
                        c: {text: 'N'},
                    },
                    {
                        c: {text: 'M'},
                    },
                    {
                        c: {text: ','},
                    },
                    {
                        c: {text: '⌫'},
                        cls:'kbd_bs_w'
                    }
                ], [
                    {
                        c: {text: '⇦'},
                    },
                    {
                        c: {text: '⇧'},
                    },
                    {
                        c: {text: '⇩'},
                    },
                    {
                        c: {text: '⇨'},
                    },
                    {
                        c: {text: ' 🄰'},
                    },
                    {
                        c: {text: '␣'},
                        cls: 'kbd_m_w'
                    },
                    {
                        c: {text: '.'},
                    },
                    {
                        c: {text: '/'},
                    },
                    {
                        c: {text: '⏎'},
                        cls: 'kbd_m_w'
                    }
                ]
            ],
        };
    }
});
