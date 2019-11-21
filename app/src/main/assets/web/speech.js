/** 语音转文本组件 **/
Vue.component('speech', {
    data() {
        return {
            text: '',
            show: false
        };
    },
    mounted() {
        this.$on('speech_to_text_result', this.on_speech_to_text_result);
        this.$on('L_R', this.on_show);
        this.$on('hide', this.on_hide);
    },
    methods: {
        on_show() {
            // 不能从其它键盘返回到本键盘
            this.$root.$emit('child_show', this, false);
            this.show = true;
            java.speech_to_text();
        },
        on_hide() {
            this.text = '';
            this.show = false;
        },
        on_back() {
            this.text = '';
            this.$root.$emit('back', this);
            this.on_hide();
        },
        'on_speech_to_text_result'(obj) {
            // 返回语音结果
            this.text = obj.text;
        },
        'on_clean'() {
            this.text = '';
        },
        'on_commit_text'() {
            java.send_text(this.text);
        },
        'on_back_space'() {
            document.execCommand('delete', false, null);
            return false;
        }
    },
    template: '<div class="speech" v-show="show">' +
        '<textarea class="speech_result" v-model.trim="text" placeholder="请说话..."/>' +
        '<button @click="on_clean" data-disable_gesture="1">清空</button>' +
        '<button @click.stop.prevent="on_back_space">删除</button>' +
        '<button @click="on_commit_text">上屏</button>' +
        '<button @click="on_back">返回</button>' +
        '</div>'
});
