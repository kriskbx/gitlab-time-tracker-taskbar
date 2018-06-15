const Config = require('./writable-file-config');
const Tasks = require('gitlab-time-tracker/src/include/tasks');
const Base = require('gitlab-time-tracker/src/models/base');

const electron = require('electron');
const {app, dialog, Tray, BrowserWindow, Menu, ipcMain} = electron;
const path = require('path');
const events = require('events');
const chokidar = require('chokidar');
const os = require('os');

const moment = require('moment');
var log = require('electron-log');
log.transports.file.appName = 'gtt-taskbar';

let gtt = new events.EventEmitter(),
    trayIcon = null,
    trayWindow = null,
    contextMenu = null,
    settingsWindow = null,
    aboutWindow = null,
    listWindow = null,
    debug = false;

gtt._app = app;
gtt._version = '0.2.4';
gtt._config = new Config(__dirname);

if (gtt._config.get('error-reporting')) {
    var Raven = require('raven');
    Raven.config('https://62cb30e3c06945b7960d624de45ed322@sentry.io/1218774').install();
}

gtt._api = new Base(gtt._config);
gtt._tasks = new Tasks(gtt._config);
gtt._paused = false;
gtt._syncing = false;
gtt._lastSync = false;
gtt._watchers = {};
gtt._unauthorized = false;
gtt._offline = false;
gtt._platform = {darwin: 'mac', linux: 'linux', win32: 'win'}[os.platform()];
gtt._iconPath = path.join(__dirname, 'images/', gtt._platform == 'mac' ? 'mac' : 'default');

app.on('window-all-closed', () => {
    if (process.platform != 'darwin') {
        app.quit();
    }
});

app.disableHardwareAcceleration();

app.on('ready', () => {
    setTimeout(() => {
        gtt._dump('Running on ' + gtt._platform);
        gtt.setTrayWindow();
        gtt.setTray();
        gtt._watchers.config.add();
        gtt._watchers.frames.add();
    }, 100);
});

/**
 * Create and open the list window.
 */
gtt.openListWindow = () => {
    if (listWindow) return listWindow.focus();

    listWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        resizable: true,
        fullscreenable: false,
        maximizable: true,
        minimizable: true,
        icon: path.join(__dirname, '/icons/png/64x64.png')
    });

    listWindow.setMenu(null);

    listWindow.loadURL('file://' + __dirname + '/log.html');
    if (debug) listWindow.openDevTools();

    listWindow.on('closed', function () {
        listWindow = null;
    });
};

/**
 * Create and open the about window.
 */
gtt.openAboutWindow = () => {
    if (aboutWindow) return aboutWindow.focus();

    aboutWindow = new BrowserWindow({
        width: 350,
        height: 350,
        resizable: false,
        fullscreenable: false,
        maximizable: false,
        minimizable: false,
        icon: path.join(__dirname, '/icons/png/64x64.png')
    });

    aboutWindow.setMenu(null);

    aboutWindow.loadURL('file://' + __dirname + '/about.html');
    if (debug) aboutWindow.openDevTools();

    aboutWindow.on('closed', function () {
        aboutWindow = null;
    });
};

/**
 * Create and open the settings window.
 */
gtt.openSettingsWindow = () => {
    if (settingsWindow) return settingsWindow.focus();

    settingsWindow = new BrowserWindow({
        width: 450,
        height: 450,
        resizable: false,
        fullscreenable: false,
        maximizable: false,
        icon: path.join(__dirname, '/icons/png/64x64.png')
    });

    settingsWindow.setMenu(null);

    settingsWindow.loadURL('file://' + __dirname + '/settings.html');
    if (debug) settingsWindow.openDevTools();

    settingsWindow.on('closed', function () {
        settingsWindow = null;
    });
};

/**
 * Create and open the context menu.
 */
gtt.openContextMenu = () => {
    contextMenu = Menu.buildFromTemplate([
        {
            label: gtt._syncing ? 'Syncing right now...' : `Last sync: ${gtt._lastSync ? gtt._lastSync.fromNow() : '-'}`,
            enabled: false
        },
        {
            label: gtt._paused ? 'Resume Syncing' : 'Pause Syncing',
            click() {
                gtt._paused = !gtt._paused;
                gtt.sync().catch(e => console.log(e));
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Preferences...',
            click: gtt.openSettingsWindow
        },
        {
            label: 'About',
            click: gtt.openAboutWindow
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: app.quit
        }
    ]);

    contextMenu.popup();
};

/**
 * Create and set the tray window.
 */
gtt.setTrayWindow = () => {
    trayWindow = new BrowserWindow({
        width: 370,
        height: 800,
        show: false,
        frame: false,
        resizable: false,
        transparent: true,
        icon: path.join(__dirname, '/icons/png/64x64.png')
    });

    trayWindow.loadURL('file://' + __dirname + '/index.html');
    if (debug) trayWindow.openDevTools();

    trayWindow.on('blur', function () {
        if (!debug) trayWindow.hide();
    });

    trayWindow.on('closed', function () {
        trayWindow = null;
    });
};

/**
 * Create and set the tray icon.
 */
gtt.setTray = () => {
    if (gtt._platform == 'mac') app.dock.hide();

    trayIcon = new Tray(path.join(gtt._iconPath, '/tray/iconTemplate.png'));

    if (gtt._platform == 'linux') {
        let contextMenu = Menu.buildFromTemplate([
            {label: 'Open GTT', click: gtt.toggleTrayWindow},
            {label: 'Quit', click: app.quit}
        ]);
        trayIcon.setContextMenu(contextMenu);
    } else {

        trayIcon.on('click', function (event, bounds) {
            gtt.toggleTrayWindow(bounds);
        });
    }
};

/**
 * Toggle tray window.
 * @param bounds
 */
gtt.toggleTrayWindow = bounds => {
    let x, y, trayWindowBounds = trayWindow.getBounds();

    if (gtt._platform != 'linux') {
        x = (bounds.x + (bounds.width / 2)) - (trayWindowBounds.width / 2);
        y = bounds.y + 10;

        if (gtt._platform == 'win') {
            y = bounds.y - 250;
        }
    } else {
        let {width} = electron.screen.getPrimaryDisplay().workAreaSize;
        x = (width / 2) - (trayWindowBounds.width / 2);
        y = 30;
    }

    trayWindow.setPosition(
        Math.ceil(x),
        Math.ceil(y)
    );

    if (trayWindow && trayWindow.isVisible()) {
        return trayWindow.hide();
    }

    trayWindow.show();
};

/**
 * Get current time monitoring status.
 * @returns {Promise}
 */
gtt.status = () => {
    gtt._dump(`Queried status`);
    return gtt._tasks
        .status()
        .then(frames => {
            if (frames.length === 0) {
                trayIcon.setImage(path.join(gtt._iconPath, '/tray/iconTemplate.png'));
                return false;
            }

            trayIcon.setImage(path.join(gtt._iconPath, '/tray-running/iconTemplate.png'));
            return frames;
        });
};

/**
 * Get projects from GitLab.
 * @returns {Promise}
 */
gtt.projects = () => {
    gtt._dump(`Queried projects`);
    return gtt._api.get(`projects?membership=true`)
        .then(projects => projects.body);
};

/**
 * Get issues for the given project from GitLab.
 * @param project
 * @returns {Promise}
 */
gtt.issues = project => {
    if (!project) return new Promise(r => r(false));
    gtt._dump(`Queried issues for project ${project}`);

    let query = [], menuBar;
    if (!(menuBar = gtt._config.get('menubar')) || !menuBar.closed) query.push('state=opened');

    return gtt._api.get(`projects/${encodeURIComponent(project)}/issues?${query.join('&')}`)
        .then(issues => ({issues: issues.body, project}));
};

/**
 * Get merge requests for the given project from Gitlab.
 * @param project
 * @returns {Promise}
 */
gtt.mergeRequests = project => {
    if (!project) return new Promise(r => r(false));
    gtt._dump(`Queried merge requests for project ${project}`);

    let query = [], menuBar;
    if (!(menuBar = gtt._config.get('menubar')) || !menuBar.closed) {
        query.push('state=opened');
    } else {
        query.push('state=all')
    }

    return gtt._api.get(`projects/${encodeURIComponent(project)}/merge_requests?${query.join('&')}`)
        .then(mergeRequests => ({mergeRequests: mergeRequests.body, project}));
};

/**
 * Sync time records to GitLab.
 * @returns {Promise}
 */
gtt.sync = () => {
    if (gtt._paused) return new Promise(r => r(false));
    gtt._dump(`Sync started`);
    gtt._syncing = true;

    return gtt._tasks.syncInit()
        .then(() => gtt._tasks.syncResolve())
        .then(() => {
            gtt._syncing = false;
            gtt._lastSync = moment();

            if (gtt._tasks.sync.frames.length === 0)
                return false;

            gtt._tasks.syncNotes().then(() => gtt._tasks.syncUpdate());

            return true;
        });
};

/**
 * Get the log
 * @returns {Promise}
 */
gtt.log = () => {
    gtt._dump('Queried log');
    return gtt._tasks.log();
};

/**
 * (Re)load the config
 * @returns {writableFileConfig}
 */
gtt.loadConfig = () => {
    gtt._dump(`Loaded config`);
    gtt._config = new Config(__dirname);
    gtt._api = new Base(gtt._config);
    return gtt._config;
};

/**
 * Write the config
 * @param config
 */
gtt.writeConfig = (config) => {
    gtt._dump(`Config written`);
    gtt._watchers.config.remove();
    gtt._config.write(config, {url: null, token: null, dateFormat: null, timeFormat: null});
    gtt._watchers.config.add();
    gtt.loadConfig();
};

/**
 * Cache wrapper.
 */
gtt.cache = {
    get: (key) => gtt._config.cache.get(key),
    set: (key, value) => gtt._config.cache.set(key, value)
};

/**
 * Dump to console.
 *
 * @param msg
 * @private
 */
gtt._dump = (msg) => {
    log.info(msg);
};

gtt._send = (key, val) => {
    if (debug) {
        gtt._dump(`ipc main send: ${key}, ${val}`);
    }

    if(trayWindow)
        trayWindow.webContents.send(key, val);
};

gtt._watchers.config = {
    add() {
        gtt._dump('Added config watcher');
        this.watcher = chokidar
            .watch(gtt._config.global)
            .on('change', () => {
                gtt.loadConfig();
                gtt._unauthorized = false;
                gtt._send('gtt-config', gtt._config);
            });
    },
    remove() {
        if (!this.watcher) return;
        gtt._dump('Removed config watcher');
        this.watcher.close();
    }
};

gtt._watchers.frames = {
    add() {
        gtt._dump('Added frames watcher');
        this.watcher = chokidar
            .watch(path.join(gtt._config.frameDir, '*.json'), {ignoreInitial: true})
            .on('raw', (event, path) => {
                if (this.timeout) clearTimeout(this.timeout);
                this.timeout = setTimeout(() => {
                    gtt._dump(`"${path}" changed.`);
                    gtt.log().then(data => gtt._send('gtt-log', data));
                    gtt.status().then(status => gtt._send('gtt-status', status));
                }, 100);
            });
    },
    remove() {
        if (!this.watcher) return;
        gtt._dump('Removed frames watcher');
        this.watcher.close();
    }
};

gtt._handleError = error => {
    if (error.statusCode === 401 && !gtt._unauthorized) {
        gtt._unauthorized = true;
        if (dialog.showMessageBox(null, {
            type: "warning",
            title: "Unauthorized",
            message: "Cannot connect to GitLab: unauthorized.",
            detail: "If this is the first time you start gtt, open the preferences and add your GitLab API token.",
            buttons: ["Go to preferences now", "I'll do it later"]
        }) === 0) gtt.openSettingsWindow();
    }
};

/**
 * IPC Listeners
 */
ipcMain.on('gtt-config', event => {
    event.returnValue = gtt.loadConfig();
});
ipcMain.on('gtt-version', event => {
    event.returnValue = gtt._version;
});
ipcMain.on('gtt-platform', event => {
    event.returnValue = gtt._platform;
});

ipcMain.on('gtt-config-write', (event, config) => {
    gtt._unauthorized = false;
    gtt.writeConfig(config);
});

ipcMain.on('gtt-status', event => {
    gtt.status()
        .then(status => event.sender.send('gtt-status', status))
        .catch(e => console.log(e));
});

ipcMain.on('gtt-projects', event => {
    gtt.projects()
        .then(projects => event.sender.send('gtt-projects', projects))
        .catch(e => {
            event.sender.send('gtt-projects', false);
            gtt._handleError(e)
        });
});
ipcMain.on('gtt-issues', (event, project) => {
    gtt.issues(project)
        .then(issues => event.sender.send('gtt-issues', issues))
        .catch(e => {
            event.sender.send('gtt-issues', false);
            gtt._handleError(e)
        });
});
ipcMain.on('gtt-merge-requests', (event, project) => {
    gtt.mergeRequests(project)
        .then(mergeRequests => event.sender.send('gtt-merge-requests', mergeRequests))
        .catch(e => {
            event.sender.send('gtt-merge-requests', false);
            gtt._handleError(e)
        });
});

ipcMain.on('gtt-sync', event => {
    gtt.sync()
        .then(result => event.sender.send('gtt-sync', result))
        .catch(e => {
            event.sender.send('gtt-sync', false);
            gtt._handleError(e)
        });
});
ipcMain.on('gtt-start', (event, {project, type, id}) => {
    gtt._dump(`Started time monitoring for ${project} ${type} ${id}`);
    gtt._tasks.start(project, type, id)
        .then(frame => event.sender.send('gtt-start', true))
        .catch(e => console.log(e));
});
ipcMain.on('gtt-stop', event => {
    gtt._dump(`Stopped time monitoring`);
    gtt._tasks.stop()
        .then(frames => event.sender.send('gtt-stop', !!frames.length))
        .catch(e => console.log(e));
});
ipcMain.on('gtt-cancel', event => {
    gtt._dump(`Cancelled time monitoring`);
    gtt._tasks.cancel()
        .then(frames => event.sender.send('gtt-cancel', !!frames.length))
        .catch(e => console.log(e));
});
ipcMain.on('gtt-log', event => {
    gtt.log()
        .then(log => event.sender.send('gtt-log', log))
        .catch(e => console.log(e));
});
ipcMain.on('list-window', () => {
    gtt.openListWindow();
});
ipcMain.on('settings-window', () => {
    gtt.openSettingsWindow();
});
ipcMain.on('context-menu', () => {
    gtt.openContextMenu();
});
ipcMain.on('cache-get', (event, key) => {
    event.returnValue = gtt.cache.get(key);
});
ipcMain.on('cache-set', (event, {key, data}) => {
    gtt.cache.set(key, data);
});
