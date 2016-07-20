byteskode-push
=====================

[![Build Status](https://travis-ci.org/byteskode/byteskode-push.svg?branch=master)](https://travis-ci.org/byteskode/byteskode-push)

byteskode push notifiation with mongoose persistence and kue support

*Note: byteskode-push is configured using [config](https://github.com/lorenwest/node-config) using key `push`*

## Requirements
- [mongoose](https://github.com/Automattic/mongoose)

## Installation
```sh
$ npm install --save mongoose byteskode-push
```

## Usage

```javascript
var mongoose = require('mongoose');
var PushNotification = require('byteskode-push');

//push notification
var pushNotification = {
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
    };

//send push notification immediate
PushNotification.send(pushNotification, function(error, _pushNotification){
            ...
});

//queue for later sending
//you will have to implement worker for later resend
//or use built in kue worker and queue
PushNotification.queue(pushNotification);

```

## API

### `send(pushNotification:Object,[options:Object], callback(error, pushNotification))`
Before send all push notifications are persisted to mongodb using mongoose. pushNotification object should constitute valid [node-gcm](https://github.com/ToothlessGear/node-gcm) message and its options.

If running in `production` and still want to simulate `fake sent` pass an additional object with `fake` key set to `true`.

To pass `node-gcm` send options such as `retries` and `backoff strategy` also pass them on the `options` object.

Example
```js
//real send
PushNotification.send(pushNotification, function(error, pushNotification){
            ...
    });

//simulate send
PushNotification.send(pushNotification, {fake:true}, function(error, pushNotification){
            ...
    });
```

### `resend([criteria:Object], callback(error, pushNotifications))`
Resend will try to resend failed push notifications that are in the database. `criteria` is a valid mongoose criteria used to specify which failed push notifications to resend.

Example
```js
PushNotification.resend(fuction(error, pushNotifications){
    ...
});

//or pass criteria
PushNotification.resend(criteria, fuction(error, pushNotifications){
    ...
});
```

### `queue(pushNotification:Object,[options:Object], [callback(error, pushNotification)])`
Unlike send, queue will save push notification for later processing. After push notification persisted into database `mail:queued` event will be fired with an instance of saved push notification. If any error occur an event `mail:queue:error` will be fired.

Example
```js
PushNotification.on('push:queued', fuction(pushNotification){
    ...
    //process pushNotification in background or real queue like kue
    ...
});

PushNotification.on('push:queue:error', fuction(error){
   ...
   //handle error
   ... 
});

//queue push notification
PushNotification.queue(pushNotification);
```

### `requeue([criteria:Object], [callback(error, pushNotification)])`
Unlike resend, requeue will fire `push:queued` event on every unsent push notification.

Example
```js
PushNotification.requeue();

//or pass criteria
PushNotification.requeue(criteria);
```

## Configuration Options
Base on your environment setup, ensure you have the following configurations in your `config` files.

```js
push: {
    //sender GCM(FCM) API key
    //@see {@link https://github.com/ToothlessGear/node-gcm#requirements}
    //@see {@link https://developers.google.com/cloud-messaging/gcm#apikey}
    apiKey: <your_api_key>,

    //custom GCM(FCM) request options to be passed to node-gcm request
    //@see {@link https://github.com/ToothlessGear/node-gcm#custom-gcm-request-options}
    requestOptions: {},

    //valid node-gcm send options
    //used to specify number of retries and back-off strategy
    //@see {@link https://github.com/ToothlessGear/node-gcm/blob/master/lib/sender.js#L15}
    sendOptions: {},

    //custom options to be merged
    //on PushNotification schema and model
    model: {

        //name of the model to be used when register to mongoose
        //default to PushNotification
        name: 'PushNotification',

        //additional custom schema fields to add on the push notification schema
        fields: {}
    },

    //allow log of push notification after send
    debug: false,

    //logger to be used
    //use console log as default logger
    logger: console.log,

    //kue options
    //if available kue queue will be created
    //and worker to process push notification in worker
    //process will be available
    //see below for details
    kue: {
            concurrency: 10,
            timeout: 5000,
            queue: 'push:queued',
            connection: {}
        }
    }
```

## Kue Integration
To add support to `kue` ensure you have installed kue and supply the required configuration. The presence of `kue` configuration in `push` config options will signal the use of `kue` publisher and worker. [See Example]()

```sh
$ npm install --save kue
```

### Kue Push Worker
In your worker process start the queued push worker as below

```js
var mongoose = require('mongoose');
var PushNotification = require('byteskode-push');

//Alert!: Probably your should start push notification
//processing in your worker process
//and not main process
PushNotification.worker.start();

//listen for the worker queue events
PushNotifcation.worker.queue.on('job complete', function(id, result) {
    console.log('complete', id, result);
});

PushNotifcation.worker.queue.on('error', function(error) {
    console.log('error', error);
});

//anywhere in your main process
//queue push notification for background send
PushNotification.queue(pushNotification);
```

## Testing
* Clone this repository

* Install all development dependencies
```sh
$ npm install
```

* Then run test
```sh
$ npm test
```

## Contribute
It will be nice, if you open an issue first so that we can know what is going on, then, fork this repo and push in your ideas. Do not forget to add a bit of test(s) of what value you adding.

## Licence
The MIT License (MIT)

Copyright (c) 2015 byteskode, lykmapipo & Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 