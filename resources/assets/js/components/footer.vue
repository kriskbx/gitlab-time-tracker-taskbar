<template>
    <footer class="panel footer">
        <div class="vertical-center" v-if="!running">
            <span class="label">No active time monitoring</span>
        </div>
        <div class="vertical-center" v-if="running">
            <i class="fa fa-circle-o-notch fa-spin spinner"></i>
            <div v-for="frame in running" class="label">
                <span class="project">{{ frame.project }}</span>
                <span class="type">{{ frame.resource.type }}</span>
                <span class="id">#{{ frame.resource.id }}</span>
                <span class="time">({{ fromNow(frame.start) }})</span>
            </div>
        </div>
    </footer>
</template>

<script>
    const moment = require('moment');

    export default {
        props: {
            running: {
                default: false
            }
        },
        mounted() {
            setInterval(this.$forceUpdate, 10000);
        },
        methods: {
            fromNow(time) {
                return moment(time).fromNow(true);
            }
        }
    }
</script>