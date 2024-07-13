'use strict';
function newGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function Msg(target, inbound, outbound) {
  var _this = this;
  this._target = target;
  this._inbound = inbound;
  this._resolvers = {};

  function ack(guid, msg) {
    _this._target.postMessage(
      JSON.stringify({ ack: true, guid: guid, msg: msg }),
      '*'
    );
  }
  function nack(guid, err) {
    err = err || {};
    _this._target.postMessage(
      JSON.stringify({
        ack: true,
        guid: guid,
        err: { message: err.message || 'Generic Error' },
      }),
      '*'
    );
  }

  function handleMessage(e) {
    var action;
    try {
      action = JSON.parse(e.data);
    } catch (err) {
      // log.warn('Got unparsable message: '+e.data);
      return;
    }

    if (action.ack) {
      var resolver = _this._resolvers[action.guid];
      if (!resolver) {
        // log.warn('Could not find guid: '+action.guid);
        return;
      }
      delete _this._resolvers[action.guid];
      if (action.err) {
        resolver.reject(action.err);
      } else {
        resolver.resolve(action.msg);
      }
    } else if (action.fn) {
      var fn = inbound[action.fn];
      if (!fn)
        return nack(
          action.guid,
          'MSG: function "' + action.fn + '" not implemented'
        );
      Promise.resolve(fn.apply(inbound, action.args)).then(
        function (msg) {
          ack(action.guid, msg);
        },
        function (err) {
          nack(action.guid, err);
        }
      );
    }
  }

  this._setupOutbound(outbound);
  window.addEventListener('message', handleMessage, false);
}

Msg.prototype._post = function (msg) {
  var _this = this;
  var guid = newGuid();
  return new Promise(function (resolve, reject) {
    _this._resolvers[guid] = {
      resolve: resolve,
      reject: reject,
    };
    msg.guid = guid;
    _this._target.postMessage(JSON.stringify(msg), '*');
  });
};

Msg.prototype._outboundProperty = function (name) {
  var _this = this;
  return function () {
    return _this._post({
      fn: name,
      args: Array.prototype.slice.apply(arguments),
    });
  };
};

Msg.prototype._setupOutbound = function (outbound) {
  for (var key in outbound) {
    if (outbound.hasOwnProperty(key)) {
      outbound[key] = this._outboundProperty(key);
    }
  }
};

module.exports = Msg;
