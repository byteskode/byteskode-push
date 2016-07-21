'use strict';

//editor config
//ruler 80

/**
 * @name PushNotification
 * @description mongoose schema implementation for push notifiation
 *
 * @see {@link https://developers.google.com/cloud-messaging/concept-options}
 * @see {@link https://developers.google.com/cloud-messaging/http-server-ref#downstream}
 * @see {@link https://developers.google.com/cloud-messaging/gcm#apikey}
 * @type Schema
 */

//dependencies
var _ = require('lodash');
var async = require('async');
var config = require('config');
var environment = require('execution-environment');
var gcm = require('node-gcm');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;


//obtain configuration from node-config
//based on the current execution environment
//@see {@link https://github.com/lorenwest/node-config}
var _config = config.has('push') ? config.get('push') : {};


//merge default configurations
_config = _.merge({}, {
  //sender GCM(FCM) API key
  //@see {@link https://github.com/ToothlessGear/node-gcm#requirements}
  //@see {@link https://developers.google.com/cloud-messaging/gcm#apikey}
  apiKey: '',

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
}, _config);


//reference logger
var log = _config.logger;


//initiate node GCM(FCM) sender
//@see {@link https://github.com/ToothlessGear/node-gcm#example-application}
var pushTransport = new gcm.Sender(_config.apiKey, _config.requestOptions);


//default push notification mongoose schema fields
//@see {@link http://mongoosejs.com/docs/guide.html}
var schemaFields = {

  /**
   * @name to
   * @description array of recipients
   *
   *              If it contains more than one recipients, then it
   *              this field contain a list of devices (registration tokens, or IDs) 
   *              receiving a multicast message
   *
   *              If it contains single recipient then, this field contain 
   *              a single registration token, a topic, 
   *              or a notification key (for sending to a device group).
   *
   * @see {@link https://github.com/ToothlessGear/node-gcm#recipients}
   * @type {Object}
   * @private
   */
  to: {
    type: [String],
    index: true,
    required: true
  },


  /**
   * @name data
   * @description specifies the custom key-value pairs of the notification's payload
   * @see {@link https://developers.google.com/cloud-messaging/concept-options}
   * @see {@link https://developers.google.com/cloud-messaging/http-server-ref#downstream}
   * @type {Object}
   * @private
   */
  data: {
    type: Mixed
  },


  /**
   * @name notification
   * @description specifies the predefined, user-visible key-value pairs of 
   *              the notification payload 
   *
   * @see {@link https://developers.google.com/cloud-messaging/concept-options}
   * @see {@link https://developers.google.com/cloud-messaging/http-server-ref#downstream}
   * @see {@link https://developers.google.com/cloud-messaging/concept-options#notifications_and_data_messages}
   * @type {Object}
   * @private
   */
  notification: {
    type: Mixed
  },


  /**
   * @name response
   * @description full push notification response
   *
   *              It is a log of the response returned by node-gcm
   *              
   * @see {@link https://github.com/ToothlessGear/node-gcm}       
   * @type {Object}
   * @private
   */
  response: {
    type: Mixed
  },


  /**
   * @name sentAt
   * @description a time when a push notification is successfully sent to receiver(s)
   * @type {Object}
   * @private
   */
  sentAt: {
    type: Date,
    index: true
  },


  /**
   * @name options
   * @description push notification options.
   *
   *              It specified various options when sending a downstream message 
   *              to a client app, such as whether that message should be 
   *              replaced by a subsequent one
   *
   *              Note!: All these options must obey node-gcm options definition
   *                     rules
   *                     
   * @see {@link https://github.com/ToothlessGear/node-gcm#usage}            
   * @see {@link https://developers.google.com/cloud-messaging/concept-options#common-message-options}
   * @type {Object}
   * @private
   */
  options: {
    type: Mixed
  },

  /**
   * @name results
   * @description processed push notification response results
   * @type {Array}
   */
  results: [{
    type: Mixed
  }],

  // sendOptions:Mixed node-gcm valid send options
  // requestOptions:Mixed node-gcm valid request options

};


//merge additional custom schema fields
schemaFields = _.merge({}, schemaFields, (_config.model || {}).fields);


//define push notification schema with timestamp options
//@see {@link http://mongoosejs.com/docs/guide.html}
var PushNotificationSchema = new Schema(schemaFields, { timestamps: true });


//------------------------------------------------------------------------------
// hooks
//------------------------------------------------------------------------------

/**
 * @name preValidate
 * @description push notification schema pre validate hook
 * @private
 */
PushNotificationSchema.pre('validate', function preValidate(next) {

  //ensure `to` field is in array format
  if (this.to && _.isString(this.to)) {
    this.to = [].concat(this.to);
  }

  next();

});


//------------------------------------------------------------------------------
// PushNotificationSchema Instance Properties & Methods
//------------------------------------------------------------------------------


/**
 * @function
 * @name send
 * @description send this push notification using actual transport or 
 *              log it on console
 * @param {Object} [options] valid node-gcm send options
 * @param  {Function} done a callback to invoke on success or failure
 * @private
 */
PushNotificationSchema.methods.send =
  function send(options, done) {

    //this refer to PushNotification instance context

    //normalize args
    if (options && _.isFunction(options)) {
      done = options;
      options = {};
    }

    //merge options
    options = _.merge({}, this.options, options);

    //reference
    var pushNotification = this;

    //obtain current environment
    //and detect sending options
    var isLocal = environment.isLocal() || options.fake;

    //if local environment or fake send
    //log pushNotification instance and
    //return pushNotification instance
    if (isLocal) {

      pushNotification.sentAt = new Date();
      //fake push notification response
      pushNotification.response = {
        message: 'success'
      };

      pushNotification.save(function (error, _pushNotification) {

        //log pushNotification
        if (_config.debug) {
          log(_pushNotification);
        }

        done(error, _pushNotification);

      });

    }

    //send pushNotification using transport
    //node-gcm sender
    else {

      async.waterfall([

        function sendPushNotification(next) {
          //prepare payload
          var payload = pushNotification.toObject();

          //prepare recipients
          var to =
            payload.to && payload.to.length > 1 ? payload.to : payload.to[0];

          //prepare node-gcm message
          var message = _.omit(payload, 'to');

          //merge message options
          message = _.merge({}, message, payload.options);

          //instantiate node-gcm message
          message = new gcm.Message(message);

          if (_config.debug) {
            log(message.toJson());
          }

          //merge default send options
          //with provided message send options
          options = _.merge({}, _config.sendOptions, payload.options,
            options);

          pushTransport.send(message, to, options,
            function afterSend(error, response) {

              //check for reachability
              //@see {@link https://github.com/ToothlessGear/node-gcm/blob/master/lib/sender.js#L153}
              if (error && _.isNumber(error) && error >= 500) {
                error = new Error('GCM(FCM) Server Unavailable');
                error.status = 'Internal Server Error';
                error.code = error;
              }

              //check for authorization
              //@see {@link https://github.com/ToothlessGear/node-gcm/blob/master/lib/sender.js#L157}
              if (error && _.isNumber(error) && error === 401) {
                error = new Error(
                  'Unauthorized (401). Check that your API token is correct.'
                );
                error.status = 'Unauthorized';
                error.code = error;
              }

              //check failure response
              //@see {@link https://github.com/ToothlessGear/node-gcm/blob/master/lib/sender.js#L161}
              if (error && _.isNumber(error) &&
                error !== 200 && error !== 401 && error <= 500) {
                error = new Error('Invalid Request');
                error.status = 'Invalid Request';
                error.code = error;
              }

              //compose error
              if (error) {
                response = {
                  code: error.code,
                  message: error.message,
                  status: error.status
                };
              }

              //set success message on the response
              else {
                response.message = 'success';
              }

              //pass error too
              next(null, response, error);

            });

        },

        function afterSend(response, error, next) {
          //set response
          pushNotification.response = response;

          //process success response
          if (response.message.toLowerCase() === 'success') {

            //set send date
            pushNotification.sentAt = new Date();

            //process response result
            if (response.results) {
              pushNotification.results =
                _.map(pushNotification.to, function (val, index) {
                  return _.merge({}, { to: val }, response.results[index]);
                });
            }

          }

          //update pushNotification
          pushNotification.save(
            function afterSave(_error, _pushNotification) {

              //fire original error
              if (error) {
                next(error);
              }

              //continue
              else {
                next(_error, _pushNotification);
              }

            });

        }

      ], done);

    }

  };


//------------------------------------------------------------------------------
// PushNotificationSchema Static Properties & Methods
//------------------------------------------------------------------------------

/**
 * @name _send
 * @description helper static methods to perform push notification send
 * @private
 */
PushNotificationSchema.statics._send =
  function _send(pushNotification, options, done) {

    //merge pushNotification options
    pushNotification = _.merge({}, pushNotification);
    pushNotification.options =
      _.merge({}, _config.sendOptions, options, pushNotification.options);

    //reference PushNotification model
    var PushNotification = this;

    async.waterfall([

      function createPushNotification(next) {

        //ensure recipient(s)
        if (!pushNotification.to) {
          next(new Error('No recipient(s) provided'));
        } else {
          //save pushNotification
          PushNotification.create(pushNotification, next);
        }

      }

    ], done);

  };


/**
 * @name send
 * @description perform direct push notification send. 
 *              For better performance consider using queue version
 * @param  {Object}   pushNotification valid node-gcm push notification details
 * @param  {String|[String]}   pusNotification.to push notification recipient(s)
 * @param {Object}    pushNotification.data additional push notification data
 * @param {Object}    pushNotification.notification valid push notification
 * @param {Object}    pushNotification.options valid push notification options
 * @param  {Object}  [options] valid node-gcm options
 * @param  {Number}  [options.retries] signal node-gcm number of retries
 * @param  {Number}  [options.backoff] signal node-gcm backoff strategy
 * @param  {Boolen}  [options.fake] signal to simulate push notification send
 * @param {Function} done a callback to invoke on success or failure
 * @return {PushNotification}          an instance of push notification sent
 * @type {Function}
 * @public
 * @example
 * 
 * PushNotification.send(pushNotification, done);
 *
 * or with options
 *
 * PushNotification.send(pushNotification, options, done);
 * 
 */
PushNotificationSchema.statics.send =
  function send(pushNotification, options, done) {

    //this refer to PushNotification static context

    //normalize arguments
    if (options && _.isFunction(options)) {
      done = options;
      options = {};
    }

    //reference PushNotification
    var PushNotification = this;

    //perform in process direct pushNotification send
    PushNotification._send(pushNotification, options,
      function (error, _pushNotification) {

        //notify creation error
        if (error) {
          done(error);
        }

        //send pushNotification
        else {
          _pushNotification.send(done);
        }

      });

  };


/**
 * @name queue
 * @description queue push notification for later send
 * @param  {Object}   pushNotification valid node-gcm push notification details
 * @param  {String|[String]}   pusNotification.to push notification recipient(s)
 * @param {Object}    pushNotification.data additional push notification data
 * @param {Object}    pushNotification.notification valid push notification
 * @param {Object}    pushNotification.options valid push notification options
 * @param  {Object}  [options] valid node-gcm options
 * @param  {Number}  [options.retries] signal node-gcm number of retries
 * @param  {Number}  [options.backoff] signal node-gcm backoff strategy
 * @param  {Boolen}  [options.fake] signal to simulate push notification send
 * @param {Function} [done] a callback to invoke on success or failure
 * @return {PushNotification}          an instance of push notification sent
 * @type {Function}
 * @public
 * @example
 * 
 * PushNotification.queue(pushNotification);
 *
 * or with options
 *
 * PushNotification.queue(pushNotification, options);
 *
 * or with options and callback
 *
 * PushNotification.queue(pushNotification, options, done);
 * 
 */
PushNotificationSchema.statics.queue =
  function queue(pushNotification, options, done) {

    //this refer to PushNotification static context

    //normalize arguments
    if (options && _.isFunction(options)) {
      done = options;
      options = {};
    }

    //reference pushNotification
    var PushNotification = this;

    PushNotification._send(pushNotification, options,
      function (error, _pushNotification) {

        if (error) {

          //fire push:queue:error event
          PushNotification.emit('push:queue:error', error);

        } else {

          //fire push:queue event
          PushNotification.emit('push:queued', _pushNotification);

          //notify `push:queued` kue worker if available
          //to process queued push notification
          if (PushNotification._queue) {

            //deduce kue queue name
            var queueName = (_config.kue || {}).queue || 'push:queued';

            //create push notification job
            //and queue it
            var job = PushNotification._queue.create(
              queueName,
              _pushNotification.toObject()
            );

            //TODO handle job save/queue error for reliability
            job.save();

          }

        }

        //invoke callback if provided
        if (done && _.isFunction(done)) {
          done(error, _pushNotification);
        }

      });

  };


/**
 * @name unsent
 * @description obtain unsent push notification(s)
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @return {Array[PushNotification]} collection of unsent push notifications
 * @public
 * @example
 *
 * PushNotification.unsent(function(error, unsents){
 *     ...
 *     //process error
 *     //process unsents
 *     ...
 * })
 *
 * or specify criteria
 *
 * PushNotification.unsent(criteria, function(error, unsents){
 *     ...
 *     //process error
 *     //process unsents
 *     ...
 * })
 * 
 */
PushNotificationSchema.statics.unsent = function unsent(criteria, done) {

  //this refer to PushNotification static context


  //normalize arguments
  if (criteria && _.isFunction(criteria)) {
    done = criteria;
    criteria = {};
  }

  criteria = _.merge({}, {
    sentAt: null //ensure push notification have not been sent
  }, criteria);

  //find unsent push notifications
  this.find(criteria, done);

};


/**
 * @name sent
 * @description obtain already sent push notification(s)
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @return {Array[PushNotification]} collection of already sent push notifications
 * @public
 * @example
 *
 * PushNotification.sent(function(error, sents){
 *     ...
 *     //process error
 *     //process sents
 *     ...
 * })
 *
 * or specify criteria
 *
 * PushNotification.sent(criteria, function(error, sents){
 *     ...
 *     //process error
 *     //process sents
 *     ...
 * })
 * 
 */
PushNotificationSchema.statics.sent = function sent(criteria, done) {

  //this refer to PushNotification static context

  //normalize arguments
  if (criteria && _.isFunction(criteria)) {
    done = criteria;
    criteria = {};
  }

  criteria = _.merge({}, {
    sentAt: { $ne: null } //ensure push notification have been sent
  }, criteria);

  //find sent push notification
  this.find(criteria, done);

};


/**
 * @name resend
 * @description re-send all failed push notification based on specified criteria
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @return {Array[PushNotification]} collection of resend push notifications
 * @public
 * @example
 *
 * PushNotification.resend(fuction(error, sents){
 *     ...
 *     //process error
 *     //process sents
 *     ...
 * });
 *
 * or specify additional criteria
 *
 * PushNotification.resend(criteria,function(error, sents){
 *     ...
 *     //process error
 *     //process sents
 *     ...
 * });
 * 
 */
PushNotificationSchema.statics.resend = function resend(criteria, done) {

  //this refer to PushNotification static context

  //normalize arguments
  if (criteria && _.isFunction(criteria)) {
    done = criteria;
    criteria = {};
  }

  //reference PushNotification
  var PushNotification = this;

  //resend fail or unsent push notification(s)
  async.waterfall([

    function findUnsentPushNotifications(next) {
      PushNotification.unsent(criteria, next);
    },

    function resendPushNotifications(unsents, next) {

      //check for unsent push notification(s)
      if (unsents) {

        //prepare send work
        //TODO make use of multi process possibly paralleljs
        unsents = _.map(unsents, function (unsent) {
          return function (_next) {
            unsent.send(_next);
          };
        });

        async.parallel(_.compact(unsents), next);

      } else {
        next(null, unsents);
      }

    }

  ], done);

};



/**
 * @name requeue
 * @description requeue all failed push notifications based on specified
 *              criteria
 * @param {Object} [criteria] valid mongoose query criteria
 * @param  {Function} done a callback to invoke on success or failure
 * @type {Function}
 * @return {Array[PushNotification]} collection of requeued push notifications 
 * @public
 * @example
 *
 * 1. Using EventEmitter
 * 
 * //listen for push:queue:error events on collection level
 * PushNotification.on('push:queue:error', function(error){
 *     ...
 *     //process error
 *     ...
 * });
 *
 * //listen for push:queue events on collection level
 * PushNotification.on('push:requeue:error', function(_pushNotification){
 *     ...
 *     //process success
 *     ...
 * });
 *
 * //requeue without criteria
 * PushNotification.requeue();
 *
 * //requeue with criteria
 * PushNotification.requeue(criteria);
 *
 * or 
 * 
 * 2. Using callbacks
 * 
 * PushNotification.requeue(function(error, unsents){
 *     ...
 *     //process error
 *     
 *     //process unsents
 *     ...
 * });
 *
 * PushNotification.requeue(criteria, function(error, unsents){
 *     ...
 *     //process error
 *     
 *     //process unsents
 *     ...
 * });
 * 
 */
PushNotificationSchema.statics.requeue = function requeue(criteria, done) {

  //this refer to PushNotification static context

  //normalize arguments
  if (criteria && _.isFunction(criteria)) {
    done = criteria;
    criteria = {};
  }

  //reference PushNotification
  var PushNotification = this;

  //obtain all unsent push notifications for requeue
  PushNotification.unsent(criteria, function (error, unsents) {

    if (error) {

      //fire push:queue:error event on mongoose collection level
      //PushNotification
      PushNotification.emit('push:queue:error', error);

    } else {

      //fire push:queue event per unsent push notification
      _.forEach(unsents, function (unsent) {

        //fire push:queued events on mongoose collection level
        //PushNotification
        PushNotification.emit('push:queued', unsent);

        //notify `push:queued` kue worker if available
        //to process queued push notification
        if (PushNotification._queue) {

          //deduce kue queue name
          var queueName = (_config.kue || {}).queue || 'push:queued';

          //create push notification job
          //and queue it
          var job = PushNotification._queue.create(
            queueName,
            unsent.toObject()
          );

          //TODO handle job save/queue error for reliability
          job.save();

        }

      });

    }

    //invoke callback if provided
    if (done && _.isFunction(done)) {
      done(error, unsents);
    }

  });

};

//exports PushNotificationSchema
module.exports = PushNotificationSchema;