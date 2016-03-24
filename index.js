#!/usr/bin/env node

var fs = require('fs');
var _ = require('lodash');
var promise = require('promise');
var exec = require('child_process').exec;
var xml2js = require('xml2js');

var args = process.argv;
var PLATFORM = args.length > 2 && args[2] || null;
var DEBUG = args.length > 3 && args[3] || false;
var SIGNING = args.length > 4 && args[4] || false;

var phonegap_platform_mapping = {
    'ios': 'ios',
    'android': 'android',
    'wp8': 'winphone'
};

var shell_exec = function(cmd) {
    return new promise(function(resolve, reject) {
        if (DEBUG) cmd += ' -d';
        exec(cmd, function(err, stdout, stderr) {
            if (err || stderr) {
                reject(err);
                console.error(err, stderr);
            } else {
                resolve(stdout);
                console.log(stdout);
            }
        });
    });
};

var phonegap_exec = function(cmd) {
    return shell_exec('phonegap ' + cmd);
};

var parse_xml = function(xml) {
    return new promise(function(resolve, reject) {
        fs.readFile(xml, function(err, data) {
            (new xml2js.Parser()).parseString(data, function (err, data) {
                var plugins = _.reduce(data.widget.plugin.concat(_.reduce(data.widget.platform, function(memo, platform, idx) {
                    if (!platform) return;
                    var name = platform.$ && platform.$.name;
                    var current_platform = name === phonegap_platform_mapping[PLATFORM];
                    return current_platform ? memo.concat(platform.plugin) : memo;
                }, [])), function(memo, plugin, idx) {
                    if (!plugin) return;

                    var name = plugin.$ && plugin.$.name || plugin.$.spec;
                    if (plugin.param) {
                        var params = [];
                        _.each(plugin.param, function(param) {
                            var name = param.$ && param.$.name;
                            var value = param.$ && param.$.value;
                            if (name && value) {
                                params.push(name + "=" + value);
                            }
                        });
                        if (params.length > 0) {
                            name += " --variable " + params.join(' ');
                        }
                    }

                    memo.push(name);
                    return memo;
                }, []);

                return plugins.length > 0 ? resolve(plugins) : reject(plugins);
            });
        });
    });
};

if (!PLATFORM) {
    return console.log('Missing platform name');
}

shell_exec('rm -rf platforms/ plugins/ hooks/').then(function() {
    return phonegap_exec('platform add ' + PLATFORM);
}).then(function() {
    parse_xml('config.xml').then(function(plugins) {
        phonegap_exec('plugin add ' + plugins.join(' '));
    });
}).then(function() {
    if (SIGNING) {
        if (PLATFORM === 'android') {
            var alias = "";
            var password = "";
            fs.writeFileSync('platforms/android/release-signing.properties', _.reduce({
                'storeFile': '../../certs/android.keystore',
                'storeType': 'jks',
                'keyAlias': alias,
                'keyPassword': password,
                'storePassword': password
            }, function(memo, key, value) {
                return memo + "\n" + key + "=" + value
            }, "").substring(1));
        } else if (PLATFORM === 'ios') {
            //TODO
        } else if (PLATFORM === 'winphone') {
            //TODO
        }
    }

    var configuration = SIGNING ? 'release' : 'debug';
    return phonegap_exec('build ' + PLATFORM + ' --' + configuration);
});
