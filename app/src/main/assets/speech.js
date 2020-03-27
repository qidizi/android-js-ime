function speech() {
    Vue.component('speech', {
        data() {
            return {
                text: this.TIP,
                show: false,
                result_cls: ''
            };
        },
        mounted() {
            let status = this.READY;
            this.$on('speech_recognizer_on_listening', function () {
                status = this.LISTENING;
                this.text = this.LISTEN_TIP;
            });
            this.$on('speech_recognizer_on_error', function (obj) {
                // 变成已经准备好，可以重试
                status = this.READY;
                this.text = '^_^ 点我重试，原因：' + obj.text;
                this.result_cls = 'fail';
            });
            this.$on('speech_recognizer_on_recognizing', function () {
                status = this.RECOGNIZING;
                this.text = this.WAIT_TIP;
            });
            this.$on('speech_recognizer_on_result', function (obj) {
                // 返回语音结果
                status = this.READY;

                if (obj) {
                    this.text = obj.text;
                    this.result_cls = 'success';
                    return;
                }

                this.text = '没听懂！点我再试一次呗。';
                this.result_cls = 'fail';
            });
            this.$on('0-l>r', this.on_show);
            this.$on('hide', this.on_hide);
            // this.$root.$emit('register_default', this, this.show = true);
        },
        methods: {
            /** 语音转文本组件 **/
            WAIT_TIP: '^_^ 请稍候...',
            TIP: '^_^ 请点我开始说话',
            LISTEN_TIP: '^_^ Hi，准备好了，请说话...说完点我开始识别',
            // 准备好
            READY: 1,
            // 准备中
            READYING: 2,
            // 聆听中
            LISTENING: 3,
            // 识别中
            RECOGNIZING: 4,
            on_show() {
                // 不能从其它键盘返回到本键盘
                this.$root.$emit('child_show', this, false);
                this.text = this.TIP;
                this.show = true;
                this.result_cls = '';
                status = this.READY;
            },
            on_hide() {
                this.text = '';
                this.show = false;

                if (this.READY !== status) {
                    // 要停止聆听
                    java.cancel_speech_recognizer();
                }
            },
            on_back() {
                this.$root.$emit('back', this);
                this.on_hide();
            },
            'speech_recognizer'() {
                switch (status) {
                    case this.READY:
                        this.text = this.WAIT_TIP;
                        status = this.READYING;
                        java.open_speech_recognizer();
                        this.result_cls = 'process';
                        break;
                    case this.LISTENING:
                        java.stop_speech_recognizer();
                        this.text = this.WAIT_TIP;
                        break;
                }
            },
            'on_commit_text'() {
                java.send_text(this.text);
                this.text = this.TIP;
                this.result_cls = '';
            },
            'on_enter'() {
                java.send_key_press(java.KEYCODE_ENTER);
            },
            'on_del'() {
                java.send_key_press(java.KEYCODE_DEL);
            },
            'on_space'() {
                java.send_key_press(java.KEYCODE_SPACE);
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
    <kbd class="` + name + ` kbd" v-show="show">
        <button @click="on_commit_text" class="apply btn">上屏</button>
        <button @click="on_enter" class="btn cancel">⏎</button>
        <button @click="on_del" class="btn cancel">⌫</button>
        <button @click="on_space" class="btn cancel">␣</button>
        <button @click="on_back" class="cancel btn">返回</button>
        <input type="button" :class="'speech_result ' + result_cls"
         @click.stop.prevent="speech_recognizer" v-model.trim="text" />
    </kbd>
    `
    });
}

