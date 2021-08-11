/** 语音转文本组件 **/
function vue_speech(name) {
    Vue.component(name, {
        data() {
            return {
                tip: '',
                text: '',
                show: false
            };
        },
        mounted() {
            this.$on('speech_recognizer_on_listening', function () {
                this.tip = '请讲话...';
            });
            this.$on('speech_recognizer_on_error', function (obj) {
                // 变成已经准备好，可以重试
                this.tip = '请重试，原因：' + obj.text;
            });
            this.$on('speech_recognizer_on_recognizing', function () {
                this.tip = '识别中...';
            });
            this.$on('speech_recognizer_on_tip', function (obj) {
                this.tip = obj.text;
            });
            this.$on('speech_recognizer_on_result', function (obj) {
                // 返回语音结果

                if (obj) {
                    this.tip = '识别完成';
                    this.text = obj.text;
                    return;
                }

                this.tip = '没听懂！点我再试一次呗。';
            });
            this.$root.$on('speech_show', this.on_show);
            this.$on('hide', this.on_hide);
            this.$on('touch.' + name, this.on_touch);
        },
        methods: {
            on_show() {
                // 不能从其它键盘返回到本键盘
                this.$root.$emit('child_show', this, (ev) => {
                    return this.on_touch(ev);
                });
                this.show = true;
                this.tip = "请稍候...";
                this.text = '';
                java.open_speech_recognizer();
            },
            on_hide() {
                this.text = '';
                this.show = false;
                // 要停止聆听
                java.cancel_speech_recognizer();
            },
            'on_commit_text'() {
                java.send_text(this.text);
                this.text = '';
            },
            on_touch(ev) {
                // 没有待上屏字符，不占用事件
                if ('' === this.text || !ev.custom_kbd_obj) return false;
                let kbd_obj = ev.custom_kbd_obj;
                if (kbd_obj.code === android.KEYCODE_SPACE) {
                    this.on_commit_text();
                    // 消耗掉空格键事件，en不要做处理了
                    return true;
                }

                return false;
            },
        },
        template: `
        
        <kbd id="${name}" class="${name} kbd" v-show="show">
            <header class="candidates">
                    <samp 
                     @click.stop.prevent="on_commit_text(text)">
                        <sup>
                            <mark>{{tip}}</mark>
                        </sup>
                        <sub>{{text}}</sub>
                    </samp>
                    
            </header>
        </kbd>
    `
    });
}
