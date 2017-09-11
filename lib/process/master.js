/**
 * Master of child processes. Handles communication between the
 * processor and the main process.
 *
 */
var status;
var processor;
var Promise = require('bluebird');

// https://stackoverflow.com/questions/18391212/is-it-not-possible-to-stringify-an-error-using-json-stringify
if (!('toJSON' in Error.prototype)){
  Object.defineProperty(Error.prototype, 'toJSON', {
    value: function () {
      var alt = {};

      Object.getOwnPropertyNames(this).forEach(function (key) {
        alt[key] = this[key];
      }, this);

      return alt;
    },
    configurable: true,
    writable: true
  });
}

process.on('message', function(msg) {

  switch(msg.cmd){
    case 'init':
      processor = require(msg.value);
      status = 'IDLE';
      break;

    case 'start':
      if(status !== 'IDLE'){
        return process.send({
          cmd: 'error',
          err: new Error('cannot start a not idling child process')
        });
      }
      status = 'STARTED';
      Promise.resolve(processor(wrapJob(msg.job)) || {}).then( function(result) {
        process.send({
          cmd: 'completed',
          value: result
        });
      }, function(err) {
        process.send({
          cmd: 'failed',
          value: err
        });
      }).finally(function(){
        status = 'IDLE';
      });
      break;
    case 'stop':
      break;
  }
});

var jobHandler = {
  get: function(target, name) {
    if(name === 'progress'){
      return function(progress){
        process.send({
          cmd: 'progress',
          value: progress
        });
      };
    }else{
      return target[name];
    }
  }
};

function wrapJob(job){
  var proxy = new Proxy(job, jobHandler);
  return proxy;
}