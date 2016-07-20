'use strict';


//dependencies
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/byteskode-push');
var PushNotifcation = require('byteskode-push');
var faker = require('faker');

//Alert!: Probably your should start push notification
//processing in your worker process
//and not main process
PushNotifcation.worker.start();

//listen for the worker queue events
PushNotifcation.worker.queue.on('job complete', function(id, result) {
    console.log('complete', id, result);
});

PushNotifcation.worker.queue.on('error', function(error) {
    console.log('error', error);
});

setInterval(function(argument) {

    //queue email for send
    PushNotifcation.queue({
        to: faker.random.uuid(),
        data: {
            key1: 'message1',
            key2: 'message2'
        },
        notification: {
            title: 'Alert!!!',
            body: 'Abnormal data access',
            icon: 'ic_launcher'
        },
        options: {
            collapseKey: 'demo',
            priority: 'high',
            contentAvailable: true,
            delayWhileIdle: true,
            timeToLive: 3,
            restrictedPackageName: 'somePackageName',
            dryRun: true
        }
    });

}, 4000);