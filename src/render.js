const {ipcRenderer, shell} = require('electron');

window.state = {
    data: {
        running: false,
        config: null,
        projects: [],
        issues: {},
        mergeRequests: {},
        project: null,
        resource: null,
        resourceType: true,
        loadingProjects: false,
        loadingResource: false,
        loadingStatus: false,
        loadingLog: false,
        starting: false,
        stopping: false,
        cancelling: false,
        version: false,
        log: null,
        platform: null
    },
    ipc: {
        sync(key, args) {
            return ipcRenderer.sendSync(key, args);
        },
        send(key, args) {
            ipcRenderer.send(key, args);
        },
        on(key, func) {
            ipcRenderer.on(key, func);
        }
    },
    shell: {
        open(url) {
            shell.openExternal(url);
        }
    }
};

let cached = window.state.ipc.sync('cache-get', 'state');
if (cached) window.state.data = Object.assign(window.state.data, cached);