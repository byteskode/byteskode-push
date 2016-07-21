'use strict';

//dependencies
var path = require('path');
var async = require('async');
var expect = require('chai').expect;
var faker = require('faker');
var PushNotification = require(path.join(__dirname, '..'));

describe('byteskode push', function () {

  //seed
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

  beforeEach(function (done) {
    PushNotification.remove(done);
  });

  it('should be exported', function () {
    expect(PushNotification).to.exist;
  });

  it('should be able to send and resend push notifications', function () {
    expect(PushNotification.send).to.exist;
    expect(PushNotification.resend).to.exist;
  });

  it('should be able to queue and requeue push notifications', function () {
    expect(PushNotification.queue).to.exist;
    expect(PushNotification.requeue).to.exist;
  });

  it('should be able to validate sent push notification', function (done) {
    var pushNotification = new PushNotification();
    pushNotification.validate(function (error) {
      expect(error).to.exist;
      expect(error.name).to.equal('ValidationError');
      done();
    });
  });


  it(
    'should be able to send push notification in test and development mode',
    function (done) {

      PushNotification.send(pushNotification, function (error,
        _pushNotification) {

        expect(error).to.not.exist;

        expect(_pushNotification).to.exist;

        expect(_pushNotification._id).to.exist;
        expect(_pushNotification.createdAt).to.exist;
        expect(_pushNotification.sentAt).to.exist;
        expect(_pushNotification.to).to.exist;
        expect(_pushNotification.to).to.be.an.Array;
        expect(_pushNotification.data).to.exist;
        expect(_pushNotification.notification).to.exist;
        expect(_pushNotification.options).to.exist;


        done(error, _pushNotification);
      });

    });



  it(
    'should be able to resend push notification(s) in test and development mode',
    function (done) {

      async.waterfall([

        function createPushNotification(next) {
          PushNotification.queue(pushNotification, next);
        },

        function resend(_pushNotification, next) {
          expect(_pushNotification.sentAt).to.not.exist;

          PushNotification.resend(next);
        }

      ], function (error, response) {

        expect(error).to.not.exist;

        expect(response).to.exist;

        var _pushNotification = response[0];

        expect(_pushNotification._id).to.exist;
        expect(_pushNotification.createdAt).to.exist;
        expect(_pushNotification.sentAt).to.exist;
        expect(_pushNotification.to).to.exist;
        expect(_pushNotification.to).to.be.an.Array;
        expect(_pushNotification.data).to.exist;
        expect(_pushNotification.notification).to.exist;
        expect(_pushNotification.options).to.exist;


        done(error, response);
      });

    });

  it(
    'should be able to queue push notification in test and development mode for later send',
    function (done) {

      PushNotification.on('push:queued', function (_pushNotification) {

        expect(_pushNotification).to.exist;

        expect(_pushNotification._id).to.exist;
        expect(_pushNotification.createdAt).to.exist;
        expect(_pushNotification.sentAt).to.not.exist;
        expect(_pushNotification.to).to.exist;
        expect(_pushNotification.to).to.be.an.Array;
        expect(_pushNotification.data).to.exist;
        expect(_pushNotification.notification).to.exist;
        expect(_pushNotification.options).to.exist;

        done(null, _pushNotification);

      });

      //queue pushNotification
      PushNotification.queue(pushNotification);

    });

  after(function (done) {
    if (PushNotification._queue) {
      PushNotification._queue.shutdown(5000, done);
    } else {
      done();
    }
  });

});