/** 语音转文本组件 **/
function vue_speech(name) {
    const WAIT_TIP = '^_^ 请稍候...';
    const TIP = '^_^ 请点我开始说话';
    const LISTEN_TIP = '^_^ Hi，准备好了，请说话...说完点我开始识别';
    // 准备好
    const READY = 1;
    // 准备中
    const READYING = 2;
    // 聆听中
    const LISTENING = 3;
    // 识别中
    const RECOGNIZING = 4;
    let status = READY;
    Vue.component(name, {
        data() {
            return {
                text: TIP,
                show: false,
                result_cls: ''
            };
        },
        mounted() {
            this.$on('speech_recognizer_on_listening', function () {
                status = LISTENING;
                this.text = LISTEN_TIP;
            });
            this.$on('speech_recognizer_on_error', function (obj) {
                // 变成已经准备好，可以重试
                status = READY;
                this.text = '^_^ 点我重试，原因：' + obj.text;
                this.result_cls = 'fail';
            });
            this.$on('speech_recognizer_on_recognizing', function () {
                status = RECOGNIZING;
                this.text = WAIT_TIP;
            });
            this.$on('speech_recognizer_on_result', function (obj) {
                // 返回语音结果
                status = READY;

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
            on_show() {
                // 不能从其它键盘返回到本键盘
                this.$root.$emit('child_show', this, false);
                this.text = TIP;
                this.show = true;
                this.result_cls = '';
                status = READY;
            },
            on_hide() {
                this.text = '';
                this.show = false;

                if (READY !== status) {
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
                    case READY:
                        this.text = WAIT_TIP;
                        status = READYING;
                        java.open_speech_recognizer();
                        this.result_cls = 'process';
                        break;
                    case LISTENING:
                        java.stop_speech_recognizer();
                        this.text = WAIT_TIP;
                        break;
                }
            },
            'on_commit_text'() {
                java.send_text(this.text);
                this.text = TIP;
                this.result_cls = '';
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
        <button @click="on_back" class="cancel btn">返回</button>
        <input type="button" :class="'speech_result ' + result_cls"
         @click.stop.prevent="speech_recognizer" v-model.trim="text" />
    </kbd>
    `
    });
}
