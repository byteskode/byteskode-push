'use strict';

/**
 * @name byteskode-push
 * @description byteskode push notifications with mongoose persistence 
 *              and kue worker support
 * @singleton
 */

//set environment to development by default
if (!(process.env || {}).NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

//suppress configuration warning
process.env.SUPPRESS_NO_CONFIG_WARNING = true;

//dependencies
var path = require('path');
var config = require('config');
var path = require('path');
var mongoose = require('mongoose');
var environment = require('execution-environment');
var PushNotificationSchema = require(path.join(__dirname, 'lib', 'schema'));
var KueWorker = require(path.join(__dirname, 'lib', 'kue', 'worker'));
var PushNotification;


//configure execution-environment
if (!environment.isLocal) {
    environment.registerEnvironments({
        isLocal: ['test', 'dev', 'development']
    });
}


//obtain configuration from config
var _config = config.has('push') ? config.get('push') : {};


//obtain model name
var modelName = (_config.model || {}).name || 'PushNotification';


// initialize mongoose mail model
try {

    //setup kue queue if available
    if (_config.kue) {
        //require kue
        var kue = require('kue');

        //initialize kue job publish queue
        PushNotificationSchema.statics._queue = kue.createQueue(_config.kue);

        //exports kue job processing worker
        PushNotificationSchema.statics.worker = KueWorker;
    }

    if (!mongoose.model(modelName)) {
        PushNotification = mongoose.model(modelName, PushNotificationSchema);
    } else {
        PushNotification = mongoose.model(modelName);
    }

} catch (e) {
    PushNotification = mongoose.model(modelName, PushNotificationSchema);
}


//export mail model
module.exports = PushNotification;