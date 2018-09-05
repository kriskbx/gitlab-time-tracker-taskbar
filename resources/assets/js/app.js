const Config = require('gitlab-time-tracker/src/include/config');
const Frame = require('gitlab-time-tracker/src/models/baseFrame');

window.Vue = require('vue');
window.Vue.use(require('vue-resource'));
const moment = require('moment');
const URL = require('url-parse');
const _ = require('underscore');
import ToggleButton from 'vue-js-toggle-button';
import {Datetime} from 'vue-datetime-2';

window.Vue.use(ToggleButton);

const shell = window.state.shell;
const ipc = window.state.ipc;

const app = new Vue({
    el: '#app',
    data: window.state.data,
    components: {
        'content-track': require('./components/track.vue'),
        'panel-footer': require('./components/footer.vue'),
        'datetime': Datetime
    },

    watch: {
        'resourceType': function () {
            this.saveState();
        },
        'resource': {
            deep: true,
            handler: function () {
                this.saveState();
            }
        },
        'mergeRequests': {
            deep: true,
            handler: function () {
                this.saveState();
            }
        },
        'issues': {
            deep: true,
            handler: function () {
                this.saveState();
            }
        },
        'projects': {
            deep: true,
            handler: function () {
                this.saveState();
            }
        },
        'project': {
            deep: true,
            handler: function () {
                this.loadResource();
                this.saveState();
            }
        },
        'config': {
            deep: true,
            handler: function () {
                if (this.loadingConfig) return;
                this.writeConfig(this.config)
            }
        }
    },

    computed: {
        gitlab() {
          let url = new URL(this.config.get('url'), true);
          return url.protocol + (url.slashes ? '//' : '') + url.host;
        },
        days() {
            let tmp = this.config;
            return this.log && this.log.frames ? Object.keys(this.log.frames).sort().reverse() : [];
        },
        frames() {
            let frames = {};
            this.days.forEach(day => frames[day] = this.log.frames[day].sort((a, b) => a.start >= b.start ? 1 : -1));
            return frames;
        }
    },

    mounted() {
        this.setConfig(ipc.sync('gtt-config', 'get'));
        this.version = ipc.sync('gtt-version', 'get');
        this.platform = ipc.sync('gtt-platform', 'get');
        this.editing = false;

        // set ipc listeners
        ipc.on('gtt-last-sync', (event, lastSync) => this.lastSync = lastSync);
        ipc.on('gtt-config', (event, config) => this.setConfig(config));
        ipc.on('gtt-log', (event, data) => {
            this.loadingLog = false;
            let i;
            for (i in data.frames) {
                if (!data.frames.hasOwnProperty(i)) continue;
                data.frames[i] = _.map(data.frames[i], frame => Frame.copy(frame));
            }
            this.log = data;
        });
        ipc.on('gtt-status', (event, status) => {
            this.running = status ? status.map(frame => Frame.copy(frame)) : false;
            this.loadingStatus = false;
            this.starting = false;
            this.stopping = false;
            this.cancelling = false;
        });
        ipc.on('gtt-projects', (event, projects) => {
            this.projects = projects;
            this.loadingProjects = false;
        });
        ipc.on('gtt-issues', (event, data) => {
            if (data.project) {
                this.issues[data.project] = data.issues;
                this.$emit('loaded-issues');
            }
            this.loadingResource = false;
        });
        ipc.on('gtt-merge-requests', (event, data) => {
            if (data.project) {
                this.mergeRequests[data.project] = data.mergeRequests;
                this.$emit('loaded-mergeRequests');
            }
            this.loadingResource = false;
        });

        ipc.on('gtt-stop', () => this.sync());

        this.ready = true;

        if (this.$refs.log) this.loadLog();
        if (!this.$refs.main) return;

        // set intervals
        setInterval(this.loadProjects, 10 * 60 * 1000);
        setInterval(this.loadIssues, 10 * 60 * 1000);
        setInterval(this.loadMergeRequests, 10 * 60 * 1000);

        // kick it off once
        this.loadStatus();
        this.loadProjects();
        this.loadIssues();
        this.loadMergeRequests();
        this.sync();
    },

    methods: {
        synced(modified) {
            if (!this.lastSync) return false;
            return moment(modified).diff(this.lastSync) < 0;
        },
        human(input) {
            if (!this.config) return;
            return this.config.toHumanReadable(input);
        },
        setConfig(config) {
            this.loadingConfig = true;
            this.config = Object.assign(new Config, config);
            setTimeout(() => {
                this.loadingConfig = false;
            }, 100);
        },
        moment(input) {
            return moment(input);
        },
        open(url) {
            shell.open(url);
        },
        start() {
            this.starting = true;
            ipc.send('gtt-start', {
                project: this.project ? this.project.label : false,
                type: this.resourceType ? 'issue' : 'merge_request',
                id: this.resource ? this.resource.id : false
            });
        },
        stop() {
            this.stopping = true;
            ipc.send('gtt-stop');
        },
        cancel() {
            this.cancelling = true;
            ipc.send('gtt-cancel');
        },
        sync() {
            ipc.send('gtt-sync');
        },
        contextMenu() {
            ipc.send('context-menu');
        },
        listWindow() {
            ipc.send('list-window');
        },
        settings() {
            ipc.send('settings-window');
        },
        loadLog() {
            this.loadingLog = true;
            ipc.send('gtt-log');
            ipc.send('gtt-sync');
        },
        loadResource() {
            if (this.resourceType) {
                this.loadIssues();
            } else {
                this.loadMergeRequests();
            }
        },
        loadMergeRequests() {
            this.loadingResource = true;
            ipc.send('gtt-merge-requests', this.project ? this.project.label : false);
        },
        loadIssues() {
            this.loadingResource = true;
            ipc.send('gtt-issues', this.project ? this.project.label : false);
        },
        loadStatus() {
            this.loadingStatus = true;
            ipc.send('gtt-status');
        },
        loadProjects() {
            this.loadingProjects = true;
            ipc.send('gtt-projects');
        },
        saveState() {
            let state = Object.assign({}, window.state.data);
            delete state.config;
            delete state.editing;
            delete state.entry;
            delete state.currentEntry;
            ipc.send('cache-set', {key: 'state', data: state});
        },
        writeConfig(config) {
            ipc.send('gtt-config-write', config);
        },
        timeFormat() {
            return this.config ? this.config.get('dateFormat').replace(this.dayFormat(), "") : "HH:mm";
        },
        dayFormat() {
            return this.config ? this.config.get('dateFormat').replace(/([k|h|H|m|s|S][:]?)/gm, "") : 'YYYY-MM-DD';
        },
        getTitleById(id, project) {
            if (!this.issues[project]) return false;

            let filtered = this.issues[project].filter(issue => issue.iid == id);
            if (!filtered[0]) return false;

            return filtered[0].title;
        },
        edit(frame) {
            this.editing = true;
            this.currentEntry = frame;
            this.entry = Frame.copy(frame);
        },
        save() {
            for (let key in this.entry) {
                if (!this.entry.hasOwnProperty(key)) continue;
                this.currentEntry[key] = this.entry[key];
            }
            this.currentEntry.modified = moment().toISOString();
            ipc.send('gtt-edit', {frame: this.currentEntry});
            this.editing = false;
        },
        dump(data) {
            console.log(data);
        }
    }
});
