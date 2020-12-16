/** 语音转文本组件 **/
function vue_speech(name) {
    const WAIT_TIP = '请稍候...';
    const TIP = '请开始说话...';
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
                tip: TIP,
                text: '',
                show: false
            };
        },
        mounted() {
            this.$on('speech_recognizer_on_listening', function () {
                status = LISTENING;
                this.tip = LISTEN_TIP;
            });
            this.$on('speech_recognizer_on_error', function (obj) {
                // 变成已经准备好，可以重试
                status = READY;
                this.tip = '^_^ 点我重试，原因：' + obj.text;
            });
            this.$on('speech_recognizer_on_recognizing', function () {
                status = RECOGNIZING;
                this.tip = WAIT_TIP;
            });
            this.$on('speech_recognizer_on_result', function (obj) {
                // 返回语音结果
                status = READY;

                if (obj) {
                    this.tip = '识别完成,点击文字上屏或重新识别。';
                    this.text = obj.text;
                    return;
                }

                this.tip = '没听懂！点我再试一次呗。';
            });
            this.$root.$on('speech_show', this.on_show);
            this.$on('hide', this.on_hide);
        },
        methods: {
            on_show() {
                // 不能从其它键盘返回到本键盘
                this.$root.$emit('child_show', this);
                this.show = true;
                status = READY;
                this.speech_recognizer();
            },
            on_hide() {
                this.text = '';
                this.show = false;

                if (READY !== status) {
                    // 要停止聆听
                    java.cancel_speech_recognizer();
                }
            },
            'speech_recognizer'() {
                switch (status) {
                    case READY:
                        this.tip = WAIT_TIP;
                        this.text = '';
                        status = READYING;
                        java.open_speech_recognizer();
                        break;
                    case LISTENING:
                        java.stop_speech_recognizer();
                        this.tip = WAIT_TIP;
                        break;
                }
            },
            'on_commit_text'() {
                java.send_text(this.text);
                this.text = '';
            }
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
