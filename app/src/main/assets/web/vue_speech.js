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
        },
        methods: {
            on_show() {
                // 不能从其它键盘返回到本键盘
                this.$root.$emit('child_show', this);
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
