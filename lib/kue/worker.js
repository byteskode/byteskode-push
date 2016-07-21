'use strict';


/**
 * @name worker
 * @description byteskode-push kue worker
 * @singleton
 */


//dependencies
var _ = require('lodash');
var async = require('async');
var mongoose = require('mongoose');
var kue = require('kue');
var config = require('config');
var noop = function () {};


//obtain configuration from config
var _config = config.has('push') ? config.get('push') : {};


//merge default configurations
_config = _.merge({}, {
  apiKey: '',
  model: {
    name: 'PushNotification'
  },
  logger: console.log, //use console log as default logger
  kue: { // kue settings
    concurrency: 10,
    queue: 'push:queued',
    connection: {},
    timeout: 5000
  },
}, _config);


//obtain logger
var log = _config.logger;


/**
 * @name stop
 * @description gracefull shutdown kue
 * @see {@link https://github.com/Automattic/kue#graceful-shutdown}
 * @param {Function} [done] a callback to invoke on succes or failure
 * @type {Function}
 * @public
 */
exports.stop = function stop(done) {

  //ensure callback
  if (!done && !_.isFunction(done)) {
    done = noop;
  }

  //ensure queue safe shutdown
  if (exports.queue) {
    var timeout = (_config.kue || {}).timeout || 5000;
    exports.queue.shutdown(timeout, done);
  }

};


/**
 * @name start
 * @description setup kue worker and start to process `push:queue` jobs
 * @param {Function} [callback] a callback to invoke on succes or failure
 * @type {Function}
 * @public
 */
exports.start = function start(callback) {

  try {

    //obtain PushNotification model
    var PushNotification = mongoose.model(_config.model.name);

    //setup kue worker queue
    if (!exports.queue && PushNotification) {
      //reference kue options
      var options = (_config.kue || {});

      //create job processing queue
      exports.queue = kue.createQueue(options);
      if (_config.debug) {
        log('setup queue');
      }

      //register worker as per configured queue name
      if (_config.debug) {
        log('setup ' + options.queue + ' worker');
      }


      //process queued push notification job
      exports.queue.process(options.queue, options.concurrency,
        function processPushNotificationJob(job, done) {

          //fetch push notification based in job details
          var _id = (job.data || {})._id;

          if (_id) {

            async.waterfall([

              function findPushNotification(next) {
                PushNotification.findById(_id, next);
              },

              function ensurePushNotification(_pushNotification, next) {
                if (!_pushNotification) {
                  //this will affect job instance error(s)
                  next(new Error('PushNotification with id ' + _id +
                    ' does not exists'));
                } else {
                  next(null, _pushNotification);
                }
              },

              function sendPushNotification(_pushNotification, next) {
                _pushNotification.send(next);
              },

              function normalizeSuccessResponse(_pushNotification, next) {
                //this will affect job instance result(s)
                next(null, _pushNotification.response);
              }

            ], done);
          }

          //no push id specified
          //finished the queued job
          else {
            done();
          }

        });


      //register success shutdown hook
      if (_config.debug) {
        log('setup process shutdown hook');
      }


      //listen for process termination
      //and gracefull shutdown worker queue
      process.once('SIGTERM', function ( /*signal*/ ) {
        exports.queue.shutdown(function ( /*error*/ ) {
          process.exit(0);
        });
      });


      if (_config.debug) {
        log('start ' + options.queue + ' jobs processing');
      }

    }

    if (callback && _.isFunction(callback)) {
      callback();
    }

  } catch (error) {

    if (_config.debug) {
      log(error);
    }

    if (callback && _.isFunction(callback)) {
      callback(error);
    }

    //re throw if no options
    if (!_config.debug && !callback) {
      throw error;
    }

  }
};