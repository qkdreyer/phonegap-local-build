#!/usr/bin/env node

var fs = require('fs');
var _ = require('lodash');
var promise = require('promise');
var exec = require('child_process').exec;
var xml2js = require('xml2js');

var args = process.argv;
var platform = args.length > 2 && args[2] || null;
var debug = args.length > 3 && args[3] || false;

var shell_exec = function(cmd) {
    return new promise(function(resolve, reject) {
        if (debug) cmd += ' -d';
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

var parse_plugin = function(xml) {
    return new promise(function(resolve, reject) {
        fs.readFile(xml, function(err, data) {
            var parser = new xml2js.Parser();
            parser.parseString(data, function (err, config) {
                var plugins = [];
                _.each(config.widget.plugin, function(plugin, idx) {
                    if (plugin) {
                        var name = plugin.$ && plugin.$.name;
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
                        plugins.push(name);
                    }
                });

                return plugins.length > 0 ? resolve(plugins) : reject(plugins);
            });
        });
    });
};

if (!platform) {
    return console.log('Missing platform name');
}

shell_exec('rm -rf platforms/ plugins/ hooks/').then(function() {
    return phonegap_exec('platform add ' + platform);
}).then(function() {
    parse_plugin('config.xml').then(function(plugins) {
        phonegap_exec('plugin add ' + plugins.join(' '));
    });
}).then(function() {
    return phonegap_exec('build ' + platform)
});
