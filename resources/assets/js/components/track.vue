<template>
    <div class="track">
        <div class="step">
            <span class="refresh" :class="{ 'disabled': loadingProjects }"
                  title="Refresh the list of projects"
                  @click="loadProjects">
                <i class="fa fa-refresh"
                   :class="{ 'fa-spin': loadingProjects }"></i>
            </span>

            <v-select class="project"
                      v-model="selectedProject"
                      placeholder="Select Project"
                      :options="projectOptions"></v-select>
        </div>

        <div class="step">
            <span class="refresh" :class="{ 'disabled': loadingResource }"
                  :title="resourceType ? 'Refresh the list of issues' : 'Refresh the list of MRs'"
                  @click="loadResource">
                <i class="fa fa-refresh"
                   :class="{ 'fa-spin': loadingResource }"></i>
            </span>

            <toggle-button class="toggle"
                           @change="change"
                           :value="resourceType"
                           :width="58"
                           color="#bfcbd9"
                           :labels="{checked: 'Issue', unchecked: 'MR'}"></toggle-button>

            <v-select class="resource"
                      v-model="selectedResource"
                      :placeholder="resourceType ? 'Select Issue' : 'Select MR'"
                      :options="resourceOptions"></v-select>
        </div>

        <div class="step track-buttons">
            <button class="button start"
                    @click="start"
                    :class="{
                        'working': starting,
                        'disabled': !project || !resource || running
                    }">
                <i class="fa fa-play"
                   :class="{ 'fa-spin': starting }"></i> Start
            </button>

            <button class="button stop"
                    @click="stop"
                    :class="{
                        'working': stopping,
                        'disabled': !running
                    }">
                <i class="fa fa-pause"></i> Stop
            </button>
            <button class="button cancel"
                    @click="cancel"
                    :class="{
                        'working': cancelling,
                        'disabled': !running
                    }">
                <i class="fa fa-ban"></i> Cancel
            </button>
        </div>
    </div>
</template>

<script>
    export default {
        props: {
            resource: {
                default: null
            },
            resourceType: {
                default: true
            },
            project: {
                default: null
            },
            projects: {
                default: []
            },
            issues: {
                default: {}
            },
            mergeRequests: {
                default: {}
            },
            loadingProjects: {
                default: false
            },
            loadingResource: {
                default: false
            },
            starting: {
                default: false
            },
            stopping: {
                default: false
            },
            cancelling: {
                default: false
            },
            running: {
                default: false
            }
        },

        data: () => ({
            selectedProject: null,
            selectedResource: null,
            resourceOptions: [],
            projectOptions: []
        }),

        watch: {
            'projects': {
                deep: true,
                handler: function () {
                    this._setProjectOptions();
                }
            },
            'issues': {
                deep: true,
                handler: function () {
                    this._setResourceOptions();
                    this._resetInput();
                }
            },
            'mergeRequests': {
                deep: true,
                handler: function () {
                    this._setResourceOptions();
                    this._resetInput();
                }
            },
            'resourceType': function () {
                this.$emit('load-resource');
                this._setResourceOptions();
                this._resetInput();
            },
            'project': {
                deep: true,
                handler: function () {
                    this._setResourceOptions();
                    this._resetInput();
                }
            },
            'selectedProject': function (v) {
                this.$emit('update:project', v);
            },
            'selectedResource': function (v) {
                this.$emit('update:resource', v);
            }
        },

        mounted() {
            this.selectedProject = this.project;
            this.selectedResource = this.resource;

            this.$parent.$on('loaded-issues', () => {
                this._setResourceOptions();
                this._resetInput();
            });
            this.$parent.$on('loaded-mergeRequests', () => {
                this._setResourceOptions();
                this._resetInput();
            });
        },

        components: {
            'v-select': require('vue-select').VueSelect
        },

        methods: {
            start(event) {
                event.preventDefault();
                this.$emit('start');
            },
            stop(event) {
                event.preventDefault();
                this.$emit('stop');
            },
            cancel(event) {
                event.preventDefault();
                this.$emit('cancel');
            },

            change(event) {
                this.$emit('update:resource-type', event.value);
            },
            loadResource(event) {
                event.preventDefault();
                this.$emit('load-resource');
            },
            loadProjects(event) {
                event.preventDefault();
                this.$emit('load-projects');
            },

            _resetInput() {
                if (!this.selectedResource || !this.resourceOptions) return;

                if (this.resourceOptions.find(resource => {
                    return resource.id === this.selectedResource.id
                        && resource.type === this.selectedResource.type
                        && resource.project === this.selectedResource.project;
                })) return;

                this.selectedResource = null;
            },

            _setProjectOptions() {
                if(!this.projects)
                    this.projects = [];

                let arr = this.projects.map(project => ({
                    label: project.path_with_namespace,
                    last_activity: project.last_activity_at
                }));

                this._sort(arr);

                this.projectOptions = arr;
            },

            _setResourceOptions() {
                if (!this.project) return this.resourceOptions = [];

                let arr;

                if (this.resourceType) {
                    arr = this.issues[this.project.label];
                } else {
                    arr = this.mergeRequests[this.project.label];
                }

                if (!arr) return this.resourceOptions = [];

                arr = arr.map(resource => ({
                    label: `#${resource.iid} ${resource.title}`,
                    title: resource.title,
                    id: resource.iid,
                    project: this.project.label.replace('', ''),
                    type: !!this.resourceType,
                    last_activity: resource.updated_at
                }));

                this._sort(arr);

                this.resourceOptions = arr;
            },

            _sort(arr) {
                arr.sort((a, b) => {
                    if (a.last_activity === b.last_activity) return 0;

                    return a.last_activity < b.last_activity ? 1 : -1;
                });
            }
        }
    }
</script>