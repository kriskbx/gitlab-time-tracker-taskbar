const fileConfig = require('gitlab-time-tracker/src/include/file-config');
const yaml = require('write-yaml');
const _ = require('underscore');

class writableFileConfig extends fileConfig {
    /**
     *
     * @param config
     * @param fields
     */
    write(config, fields = {}) {
        let original = Object.assign(fields, this.localExists() ? this.parseLocal() : this.parseGlobal());
        let write = {};

        _.each(original, (val, key) => {
            write[key] = config.data[key] ? this.data[key] = config.data[key] : this.data[key];
        });

        return new Promise((resolve, reject) => {

            yaml.sync(this.global, write, err => reject(err));
            resolve();
        });
    }
}

module.exports = writableFileConfig;