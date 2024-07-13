'use strict';

function getScapPath(webOSVersion) {
  switch (webOSVersion) {
    case '3.0':
    case '3.2':
      return 'lib/scap_1.5/cordova-cd/';
    default:
      return 'lib/scap_1.7/cordova-cd/';
  }
}

function getScapFiles(webOSVersion) {
  switch (webOSVersion) {
    case '3.0':
    case '3.2':
      return [
        'configuration.js',
        'deviceInfo.js',
        'inputSource.js',
        'power.js',
        'signage.js',
        'sound.js',
        'storage.js',
        'video.js',
        'security.js',
        'time.js',
        'utility.js',
      ];
    default:
      // 4.0, 4.1, 5.0...
      return [
        'configuration.js',
        'deviceInfo.js',
        'inputSource.js',
        'power.js',
        'signage.js',
        'sound.js',
        'storage.js',
        'video.js',
        'security.js',
        'time.js',
        'utility.js',
        'iot.js',
      ];
  }
}

// Gets webOS Signage version
function getWebOSVersion() {
  return new Promise(function (resolve, reject) {
    var custom = new Custom();
    custom.Signage.getwebOSVersion(
      function successCallback(successObject) {
        var webOSVersion = successObject.webOSVersion;

        resolve(webOSVersion);
      },
      function failureCallback(failureObject) {
        console.log(
          '[' + failureObject.errorCode + ']' + failureObject.errorText
        );
        resolve('3.2'); // TODO: handle local browser case better
      }
    );
  });
}

// Depending on the webOS platform, the SCAP library is automatically loaded.
function loadScripts(webOSVersion) {
  console.log('loading scap API...');
  new Promise(function (resolve, reject) {
    var path = getScapPath(webOSVersion);
    var files = getScapFiles(webOSVersion);
    files.forEach(function (file, i) {
      var jsPath = path + file;
      var script = document.createElement('script');

      script.src = jsPath;
      document.head.appendChild(script);

      console.log('SCAP API "' + jsPath + '" added!!');
      if (i === files.length - 1) {
        // after the last script is loaded, resolve the promise
        script.onload = function () {
          console.log('Done');
          resolve();
        };
      }
    });
  });
}

function load() {
  console.log('load scap');
  return getWebOSVersion().then(function (version) {
    console.log('got version ' + version);
    return loadScripts(version);
  });
}

load();

console.log('scap-loader.js loaded');

// window.loadScap = load;
