/*
 * ============================================================================
 *   LG ELECTRONICS INC., PYEONGTAEK, KOREA
 *   Copyright(c) 2020 by LG Electronics Inc.
 *
 *   Author          : signagesupport@lge.com
 *   Modified Date   : 2020-05-21
 *   Release Version : 1.3200521
 *
 *   See ./doc/index.html for more detail
 * ============================================================================
 */
cordova.define('cordova/plugin/custom', function (e, a, l) {
  var n;
  n = window.PalmSystem
    ? e('cordova/plugin/webos/service')
    : {
        Request: function (e, a) {
          'function' == typeof a.onFailure &&
            a.onFailure({
              returnValue: !1,
              errorCode: 'NOT_WEBOS',
              errorText: 'PalmSystem Not Available. Cordova is not installed?',
            });
        },
      };
  var r = function () {},
    t = {
      '1.0': [
        'getPowerOnOffHistory',
        'changePassword',
        'getwebOSVersion',
        'disableApplication',
        'setPowerOnStatus',
        'getPowerOnStatus',
        'setWhiteBalanceRGB',
        'getWhiteBalanceRGB',
        'getCustomJSVersion',
      ],
      '2.0': [
        'getKAM',
        'setKAM',
        'getApplicationInfo',
        'switchApplication',
        'setMaster',
        'setSlave',
        'setAvSync',
        'setAvSyncSpeaker',
        'setAvSyncBypass',
        'getAvSync',
        'getAvSyncSpeaker',
        'getAvSyncBypass',
        'addUSBAttachEventListener',
        'removeUSBAttachEventListener',
      ],
      '3.0': [
        'getWoWLAN',
        'setWoWLAN',
        'getNativePortraitMode',
        'setNativePortraitMode',
        'setNoSignalImageStatus',
        'getNoSignalImageStatus',
        'clearBrowsingData',
        'enableScreenShareApp',
      ],
      3.2: ['setEnterpriseCode', 'getPortControl', 'setPortControl'],
      '4.0': [],
      4.1: [],
      '5.0': [],
    },
    c = { USBAttachEventListener: null },
    o = { webOSVersion: -2 },
    s = {
      COMMERCIAL: 'commercial',
      HOTELMODE: 'hotelMode',
      NETWORK: 'network',
      OPTION: 'option',
      SOUND: 'sound',
      PICTURE: 'picture',
      LOCK: 'lock',
    },
    R = 'enableKAM',
    O = 'password',
    u = 'siAppOrientation',
    C = 'screenRotation',
    d = 'wolwowlOnOff',
    E = 'powerOnStatus',
    b = 'powerOnOffHistory',
    f = 'avSync',
    p = 'avSyncSpeaker',
    A = 'avSyncBypassInput',
    M = 'noSignalImage',
    k = 'pictureMode',
    S = 'systemPin',
    N = 'blockedPortList';
  (r.ERROR_CODE = {
    COMMON: {
      OLD_WEBOS_VERSION: 'OLD_WEBOS_VERSION',
      UNSUPPORTED_API: 'UNSUPPORTED_API',
      BAD_PARAMETERS: 'BAD_PARAMETERS',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
      NOT_MONITORING: 'NOT_MONITORING',
      MEDIA_ERROR: 'MEDIA_ERROR',
    },
    CONFIGURATION: {
      INVALID_PASSWORD_FORMAT: 'BAD_PARAMETERS',
      ACCESS_DENIED: 'ACCESS_DENIED',
      INVALID_CONFIG: 'INVALID_CONFIGURATION',
    },
    APPLICATION: {
      SETTINGS_ERROR: 'SETTINGS_ERROR',
      NOT_INSTALLED: 'NOT_INSTALLED',
    },
  }),
    (r.CLEARBROWSINGDATATYPES = {
      ALL: 'all',
      APPCACHE: 'appcache',
      CACHE: 'cache',
      CHANNELIDS: 'channelIDs',
      COOKIES: 'cookies',
      FILESYSTEMS: 'fileSystems',
      INDEXEDDB: 'indexedDB',
      LOCALSTORAGE: 'localStorage',
      SERVICEWORKERS: 'serviceWorkers',
      WEBSQL: 'webSQL',
    }),
    (r.AVSYNC = { ON: 'on', OFF: 'off' }),
    (r.AVSYNCBYPASS = { ON: 'on', OFF: 'off' }),
    (r.NOSIGNALIMAGE = { ON: 'on', OFF: 'off' }),
    (r.POWERONSTATUS = {
      POWERON: 'power_on',
      STANDBY: 'stand_by',
      LASTSTATUS: 'lst',
    }),
    (r.APPLICATION = {
      ZIP_TYPE: 'commercial.signage.signageapplauncher',
      IPK_TYPE: 'com.lg.app.signage',
      EXTERNAL_HDMI: 'com.webos.app.hdmi1',
      EXTERNAL_HDMI1: 'com.webos.app.hdmi1',
      EXTERNAL_HDMI2: 'com.webos.app.hdmi2',
      EXTERNAL_HDMI3: 'com.webos.app.hdmi3',
      EXTERNAL_HDMI4: 'com.webos.app.hdmi4',
      EXTERNAL_RGB: 'com.webos.app.externalinput.rgb',
      EXTERNAL_DVI: 'com.webos.app.hdmi2',
      EXTERNAL_DP: 'com.webos.app.hdmi3',
      EXTERNAL_OPS: 'com.webos.app.hdmi4',
      SCREEN_SHARE: 'com.webos.app.miracast',
    }),
    (r.NATIVEPORTRAIT = {
      OFF: 'off',
      DEGREE_90: '90',
      DEGREE_180: '180',
      DEGREE_270: '270',
    });
  var m = {
    Common: {
      isPropertyExists: function (e) {
        return void 0 !== e && void 0 !== e && null !== e;
      },
    },
    PlatformChecker: {
      checkPlatformSupportedThisAPI: function (e) {
        for (var a in t)
          for (var l in t[a])
            if (t[a][l] === e)
              return parseFloat(a) <= o.webOSVersion || parseFloat(a);
        return !1;
      },
    },
    SubscriptionChecker: {
      checkCurrentStatusSubscribed: function (e) {
        return (
          'object' == typeof e &&
          'string' == typeof e.uri &&
          'object' == typeof e.params
        );
      },
    },
    ParameterChecker: {
      checkParametersValidation: function (e, a, l) {
        if (
          'object' != typeof e ||
          'object' != typeof a ||
          'string' != typeof l
        )
          return null;
        for (var n in e) if (a[l] === e[n]) return !0;
        return !1;
      },
      checkMulltiParametersValidation: function (e, a, l) {
        if (
          'object' != typeof e ||
          'object' != typeof a ||
          'string' != typeof l ||
          'object' != typeof a[l]
        )
          return null;
        for (var n in (a[l].length, a[l]))
          for (var r = 0; r < e.length; r++) if (a[l][n] !== e[r]) return !1;
        return !0;
      },
      checkMissingParameters: function (e, a) {
        if ('object' != typeof e || null === e || void 0 === e) return !1;
        for (var l = 0; l < a.length; l++)
          if (
            !1 === e.hasOwnProperty(a[l]) ||
            void 0 === e[a[l]] ||
            null === e[a[l]]
          )
            return !1;
        return !0;
      },
    },
    CallbackHandler: {
      callSuccessCallback: function (e, a) {
        'function' == typeof e &&
          ('object' == typeof a
            ? (a.returnValue && delete a.returnValue, e(a))
            : e());
      },
      callFailureCallback: function (e, a, l, n) {
        'function' == typeof e &&
          (a.returnValue && delete a.returnValue,
          -1 === a.errorCode
            ? a.errorText.indexOf('Unknown method') > -1
              ? (a.errorCode = r.ERROR_CODE.COMMON.UNSUPPORTED_API)
              : a.errorText.indexOf('Service does not exist') > -1 &&
                (a.errorCode = r.ERROR_CODE.COMMON.UNSUPPORTED_API)
            : ((void 0 !== a.errorCode && null !== a.errorCode) ||
                (a.errorCode = l),
              (void 0 !== a.errorText && null !== a.errorText) ||
                (a.errorText = n)),
          e(a));
      },
    },
    PreferencesHandler: {
      setPreferences: function (e, a, l, r) {
        var t = {};
        (t[e] = a),
          n.Request('palm://com.palm.systemservice/', {
            method: 'setPreferences',
            parameters: t,
            onSuccess: function (e) {
              'function' == typeof l && (delete e.returnValue, l(e));
            },
            onFailure: function (e) {
              'function' == typeof r && (delete e.returnValue, r(e));
            },
          });
      },
      getPreferences: function (e, a, l) {
        n.Request('palm://com.palm.systemservice/', {
          method: 'getPreferences',
          parameters: { keys: e },
          onSuccess: function (e) {
            'function' == typeof a && (delete e.returnValue, a(e));
          },
          onFailure: function (e) {
            'function' == typeof l && (delete e.returnValue, l(e));
          },
        });
      },
    },
    DBHandler: {
      setValue: function (e, a, l, r) {
        n.Request(
          'luna://com.webos.service.commercial.signage.storageservice/settings/',
          {
            method: 'set',
            parameters: { category: e, settings: a },
            onSuccess: function (e) {
              'function' == typeof l && (delete e.returnValue, l(e));
            },
            onFailure: function (e) {
              'function' == typeof r && (delete e.returnValue, r(e));
            },
          }
        );
      },
      setValueBySettingsService: function (e, a, l, r) {
        n.Request('palm://com.webos.settingsservice', {
          method: 'setSystemSettings',
          parameters: { category: e, settings: a },
          onSuccess: function (e) {
            'function' == typeof l && (delete e.returnValue, l(e));
          },
          onFailure: function (e) {
            'function' == typeof r && (delete e.returnValue, r(e));
          },
        });
      },
      getValue: function (e, a, l, r) {
        n.Request(
          'luna://com.webos.service.commercial.signage.storageservice/settings/',
          {
            method: 'get',
            parameters: { category: e, keys: a },
            onSuccess: function (e) {
              'function' == typeof l && (delete e.returnValue, l(e.settings));
            },
            onFailure: function (e) {
              'function' == typeof r && (delete e.returnValue, r(e));
            },
          }
        );
      },
      getValueBySettingsService: function (e, a, l, r) {
        n.Request('palm://com.webos.settingsservice', {
          method: 'getSystemSettings',
          parameters: { category: e, keys: a },
          onSuccess: function (e) {
            'function' == typeof l && (delete e.returnValue, l(e.settings));
          },
          onFailure: function (e) {
            'function' == typeof r && (delete e.returnValue, r(e));
          },
        });
      },
    },
  };
  function g(e, a, l) {
    var t;
    (t = function () {
      var n = m.PlatformChecker.checkPlatformSupportedThisAPI(e);
      -1 !== o.webOSVersion
        ? !1 !== n
          ? !0 === n || 'number' != typeof n
            ? l(!0)
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.OLD_WEBOS_VERSION,
                'webOS Signage ' +
                  o.webOSVersion.toFixed(1) +
                  " doesn't support " +
                  e +
                  ' API. webOS Signage version should be later than ' +
                  n.toFixed(1) +
                  '.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Cannot found called API in CustomJS.'
            )
        : m.CallbackHandler.callFailureCallback(
            a,
            {},
            r.ERROR_CODE.COMMON.INTERNAL_ERROR,
            'Unknown webOS Signage version.'
          );
    }),
      -2 === o.webOSVersion
        ? n.Request('luna://com.webos.service.systemservice/osInfo/', {
            method: 'query',
            parameters: { parameters: ['webos_release_codename'] },
            onSuccess: function (e) {
              delete e.returnValue,
                -1 !== (o = e).webos_release_codename.indexOf('deua') ||
                -1 !== o.webos_release_codename.indexOf('denali') ||
                -1 !== o.webos_release_codename.indexOf('dreadlocks')
                  ? n.Request(
                      'luna://com.webos.service.commercial.signage.storageservice',
                      {
                        method: 'getOnOffTimeSchedule',
                        parameters: {},
                        onComplete: function (e) {
                          e.settings &&
                          e.settings.hasOwnProperty('onOffTimeSchedule')
                            ? ((o.webOSVersion = 3.2), t())
                            : ((o.webOSVersion = 3), t());
                        },
                      }
                    )
                  : -1 !== o.webos_release_codename.indexOf('jhericurl')
                    ? ((o.webOSVersion = 5), t())
                    : -1 !== o.webos_release_codename.indexOf('geumsan')
                      ? ((o.webOSVersion = 4.1), t())
                      : -1 !== o.webos_release_codename.indexOf('genepi') ||
                          -1 !==
                            o.webos_release_codename.indexOf('goldilocks') ||
                          -1 !== o.webos_release_codename.indexOf('galliano')
                        ? ((o.webOSVersion = 4), t())
                        : ((o.webOSVersion = -1), t());
            },
            onFailure: function (e) {
              function a(e, a) {
                return -1 !== e.indexOf(a);
              }
              !0 === a(navigator.userAgent, 'Web0S') ||
              !0 === a(navigator.userAgent, 'WebAppManager')
                ? a(navigator.userAgent, 'AppleWebKit/537.41')
                  ? ((o.webOSVersion = 1), t())
                  : a(navigator.userAgent, 'AppleWebKit/538.2') &&
                    ((o.webOSVersion = 2), t())
                : ((o.webOSVersion = -1), t());
            },
          })
        : t();
  }
  function _(e, a, l) {
    l.videoEl && 'object' == typeof l.videoEl
      ? l.videoEl.readyState > 3
        ? l.videoEl.mediaId && 'string' == typeof l.videoEl.mediaId
          ? e(l.videoEl.mediaId)
          : a({
              errorCode: r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              errorText: 'Cannot found video element.',
            })
        : a({
            returnValue: !1,
            errorCode: r.ERROR_CODE.COMMON.INTERNAL_ERROR,
            errorText:
              'Video is not loaded yet. Try again after video is loaded.',
          })
      : n.Request(
          'luna://com.webos.service.commercial.signage.storageservice/video/',
          {
            method: 'getMediaID',
            onSuccess: function (l) {
              l.hasOwnProperty('id')
                ? e(l.id)
                : a({
                    returnValue: !1,
                    errorCode: r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    errorText: 'Failed to check media id value.',
                  });
            },
            onFailure: function (l) {
              var n = document.getElementsByTagName('video')[0];
              n && e(n.mediaId), a(l);
            },
          }
        );
  }
  (r.prototype.Configuration = {
    getCustomJSVersion: function (e, a) {
      g('getCustomJSVersion', a, function () {
        m.CallbackHandler.callSuccessCallback(e, { version: '1.3200521' });
      });
    },
    getPortControl: function (e, a, l) {
      g('getPortControl', a, function () {
        m.DBHandler.getValue(
          s.COMMERCIAL,
          [N],
          function (a) {
            'string' == typeof a.blockedPortList &&
              (a.blockedPortList = parseInt(a.blockedPortList)),
              m.CallbackHandler.callSuccessCallback(e, {
                blockedPortList: a.blockedPortList,
              });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get AvSync Bypass status.'
            );
          }
        );
      });
    },
    setPortControl: function (e, a, l) {
      g('setPortControl', a, function () {
        if (
          !1 !==
          m.ParameterChecker.checkMissingParameters(l, ['blockedPortList'])
        ) {
          for (var n = 0; n < l.blockedPortList.length; n++)
            l.blockedPortList[n].blockedPort =
              l.blockedPortList[n].blockedPort.toString();
          m.DBHandler.setValue(
            s.COMMERCIAL,
            l,
            function (a) {
              m.CallbackHandler.callSuccessCallback(e);
            },
            function (e) {
              m.CallbackHandler.callFailureCallback(
                a,
                e,
                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                'Failed to set white balance settings.'
              );
            }
          );
        } else
          m.CallbackHandler.callFailureCallback(
            a,
            {},
            r.ERROR_CODE.COMMON.BAD_PARAMETERS,
            'Missing required parameters.'
          );
      });
    },
    setEnterpriseCode: function (e, a, l) {
      g('setEnterpriseCode', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['enterpriseCode'])
          ? m.DBHandler.setValue(
              s.COMMERCIAL,
              l,
              function (a) {
                m.CallbackHandler.callSuccessCallback(e);
              },
              function (e) {
                m.CallbackHandler.callFailureCallback(
                  a,
                  e,
                  r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                  'Failed to set white balance settings.'
                );
              }
            )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    clearBrowsingData: function (e, a, l) {
      g('clearBrowsingData', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['types'])
          ? !1 !==
            m.ParameterChecker.checkMulltiParametersValidation(
              r.CLEARBROWSINGDATATYPES,
              l,
              'types'
            )
            ? n.Request('palm://com.palm.webappmanager/', {
                method: 'clearBrowsingData',
                parameters: l,
                onSuccess: function (a) {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                onFailure: function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to clear browsing data.'
                  );
                },
              })
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    setWhiteBalanceRGB: function (e, a, l) {
      g('setWhiteBalanceRGB', a, function () {
        !1 !== l.hasOwnProperty('rGain') ||
        !1 !== l.hasOwnProperty('gGain') ||
        !1 !== l.hasOwnProperty('bGain')
          ? (!0 === l.hasOwnProperty('rGain') && 'number' != typeof l.rGain) ||
            (!0 === l.hasOwnProperty('gGain') && 'number' != typeof l.gGain) ||
            (!0 === l.hasOwnProperty('bGain') && 'number' != typeof l.bGain)
            ? m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters. r/g/bGain value type must be number.'
              )
            : o.webOSVersion <= 3
              ? m.DBHandler.getValue(
                  s.PICTURE,
                  [k],
                  function (n) {
                    var t = {};
                    switch (n.pictureMode) {
                      case 'normal':
                        'number' == typeof l.rGain &&
                          (t.rSubGainMedium = l.rGain),
                          'number' == typeof l.gGain &&
                            (t.gSubGainMedium = l.gGain),
                          'number' == typeof l.bGain &&
                            (t.bSubGainMedium = l.bGain);
                        break;
                      case 'vivid':
                        'number' == typeof l.rGain &&
                          (t.rSubGainCool = l.rGain),
                          'number' == typeof l.gGain &&
                            (t.gSubGainCool = l.gGain),
                          'number' == typeof l.bGain &&
                            (t.bSubGainCool = l.bGain);
                        break;
                      case 'cinema':
                        'number' == typeof l.rGain &&
                          (t.rSubGainWarm = l.rGain),
                          'number' == typeof l.gGain &&
                            (t.gSubGainWarm = l.gGain),
                          'number' == typeof l.bGain &&
                            (t.bSubGainWarm = l.bGain);
                        break;
                      default:
                        return void m.CallbackHandler.callFailureCallback(
                          a,
                          {},
                          r.ERROR_CODE.CONFIGURATION.INVALID_CONFIG,
                          'This API supports only if picture mode is Vivid, Standard or Cinema.'
                        );
                    }
                    m.DBHandler.setValue(
                      s.COMMERCIAL,
                      t,
                      function (a) {
                        m.CallbackHandler.callSuccessCallback(e);
                      },
                      function (e) {
                        m.CallbackHandler.callFailureCallback(
                          a,
                          e,
                          r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                          'Failed to set white balance settings.'
                        );
                      }
                    );
                  },
                  function (e) {
                    m.CallbackHandler.callFailureCallback(
                      a,
                      errorObject,
                      r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                      'Failed to set white balance settings.'
                    );
                  }
                )
              : m.DBHandler.getValue(
                  s.PICTURE,
                  [k],
                  function (n) {
                    var t = {};
                    switch (n.pictureMode) {
                      case 'normal':
                      case 'vivid':
                      case 'sports':
                      case 'game':
                      case 'govCorp':
                      case 'eco':
                        'number' == typeof l.rGain && (t.redOffset = l.rGain),
                          'number' == typeof l.gGain &&
                            (t.greenOffset = l.gGain),
                          'number' == typeof l.bGain &&
                            (t.blueOffset = l.bGain);
                        break;
                      default:
                        return void m.CallbackHandler.callFailureCallback(
                          a,
                          {},
                          r.ERROR_CODE.CONFIGURATION.INVALID_CONFIG,
                          'This API is not supports when picture mode is Calibration.'
                        );
                    }
                    m.DBHandler.setValue(
                      s.PICTURE,
                      t,
                      function (a) {
                        m.CallbackHandler.callSuccessCallback(e);
                      },
                      function (e) {
                        m.CallbackHandler.callFailureCallback(
                          a,
                          e,
                          r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                          'Failed to set white balance settings.'
                        );
                      }
                    );
                  },
                  function (e) {
                    m.CallbackHandler.callFailureCallback(
                      a,
                      e,
                      r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                      'Failed to set white balance settings.'
                    );
                  }
                )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters. At least one of rGain, gGain or bGain parameter should be used.'
            );
      });
    },
    getWhiteBalanceRGB: function (e, a) {
      g('getWhiteBalanceRGB', a, function () {
        o.webOSVersion <= 3
          ? m.DBHandler.getValue(s.PICTURE, [k], function (l) {
              m.DBHandler.getValue(
                s.COMMERCIAL,
                [
                  'rSubGainMedium',
                  'gSubGainMedium',
                  'bSubGainMedium',
                  'rSubGainCool',
                  'gSubGainCool',
                  'bSubGainCool',
                  'rSubGainWarm',
                  'gSubGainWarm',
                  'bSubGainWarm',
                ],
                function (n) {
                  var t = {};
                  switch (l.pictureMode) {
                    case 'normal':
                      (t.rGain = n.rSubGainMedium),
                        (t.gGain = n.gSubGainMedium),
                        (t.bGain = n.bSubGainMedium);
                      break;
                    case 'vivid':
                      (t.rGain = n.rSubGainCool),
                        (t.gGain = n.gSubGainCool),
                        (t.bGain = n.bSubGainCool);
                      break;
                    case 'cinema':
                      (t.rGain = n.rSubGainWarm),
                        (t.gGain = n.gSubGainWarm),
                        (t.bGain = n.bSubGainWarm);
                      break;
                    default:
                      return void m.CallbackHandler.callFailureCallback(
                        a,
                        {},
                        r.ERROR_CODE.CONFIGURATION.INVALID_CONFIG,
                        'This API supports only if picture mode is Vivid, Standard or Cinema.'
                      );
                  }
                  'string' == typeof t.rGain && (t.rGain = parseInt(t.rGain)),
                    'string' == typeof t.gGain && (t.gGain = parseInt(t.gGain)),
                    'string' == typeof t.bGain && (t.bGain = parseInt(t.bGain)),
                    m.CallbackHandler.callSuccessCallback(e, t);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    errorObject,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to get white balance settings.'
                  );
                }
              );
            })
          : m.DBHandler.getValue(
              s.PICTURE,
              [k, 'redOffset', 'greenOffset', 'blueOffset'],
              function (l) {
                var n = {};
                switch (l.pictureMode) {
                  case 'normal':
                  case 'vivid':
                  case 'sports':
                  case 'game':
                  case 'govCorp':
                  case 'eco':
                    (n.rGain = l.redOffset),
                      (n.gGain = l.greenOffset),
                      (n.bGain = l.blueOffset);
                    break;
                  default:
                    return void m.CallbackHandler.callFailureCallback(
                      a,
                      {},
                      r.ERROR_CODE.CONFIGURATION.INVALID_CONFIG,
                      'This API is not supports when picture mode is Calibration.'
                    );
                }
                'string' == typeof n.rGain && (n.rGain = parseInt(n.rGain)),
                  'string' == typeof n.gGain && (n.gGain = parseInt(n.gGain)),
                  'string' == typeof n.bGain && (n.bGain = parseInt(n.bGain)),
                  m.CallbackHandler.callSuccessCallback(e, n);
              },
              function (e) {
                m.CallbackHandler.callFailureCallback(
                  a,
                  e,
                  r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                  'Failed to get white balance settings.'
                );
              }
            );
      });
    },
    setAvSync: function (e, a, l) {
      g('setAvSync', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['avSync'])
          ? !1 !==
            m.ParameterChecker.checkParametersValidation(r.AVSYNC, l, 'avSync')
            ? m.DBHandler.setValue(
                s.SOUND,
                l,
                function (a) {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set AvSync settings.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getAvSync: function (e, a) {
      g('getAvSync', a, function () {
        m.DBHandler.getValue(
          s.SOUND,
          [f],
          function (a) {
            m.CallbackHandler.callSuccessCallback(e, { avSync: a.avSync });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get AvSync status.'
            );
          }
        );
      });
    },
    setAvSyncSpeaker: function (e, a, l) {
      g('setAvSyncSpeaker', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['avSyncSpeaker'])
          ? !1 !==
            m.ParameterChecker.checkParametersValidation(
              r.AVSYNCSPEAKER,
              l,
              'avSyncSpeaker'
            )
            ? m.DBHandler.setValue(
                s.SOUND,
                l,
                function (a) {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set AvSync Speaker settings.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getAvSyncSpeaker: function (e, a) {
      g('getAvSyncSpeaker', a, function () {
        m.DBHandler.getValue(
          s.SOUND,
          [p],
          function (a) {
            'string' == typeof a.avSyncSpeaker &&
              (a.avSyncSpeaker = parseInt(a.avSyncSpeaker)),
              m.CallbackHandler.callSuccessCallback(e, {
                avSyncSpeaker: a.avSyncSpeaker,
              });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get AvSync Speaker status.'
            );
          }
        );
      });
    },
    setAvSyncBypass: function (e, a, l) {
      g('setAvSyncBypass', a, function () {
        !1 !==
        m.ParameterChecker.checkMissingParameters(l, ['avSyncBypassInput'])
          ? !1 !==
            m.ParameterChecker.checkParametersValidation(
              r.AVSYNCBYPASS,
              l,
              'avSyncBypassInput'
            )
            ? m.DBHandler.setValue(
                s.SOUND,
                l,
                function (a) {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set AvSync Bypass settings.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getAvSyncBypass: function (e, a) {
      g('getAvSyncBypass', a, function () {
        m.DBHandler.getValue(
          s.SOUND,
          [A],
          function (a) {
            m.CallbackHandler.callSuccessCallback(e, {
              avSyncBypassInput: a.avSyncBypassInput,
            });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get AvSync Bypass status.'
            );
          }
        );
      });
    },
    setNoSignalImageStatus: function (e, a, l) {
      g('setNoSignalImageStatus', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['noSignalImage'])
          ? !1 !==
            m.ParameterChecker.checkParametersValidation(
              r.NOSIGNALIMAGE,
              l,
              'noSignalImage'
            )
            ? m.DBHandler.setValue(
                s.COMMERCIAL,
                l,
                function (a) {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set NoSignalImage status.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getNoSignalImageStatus: function (e, a) {
      g('getNoSignalImageStatus', a, function () {
        m.DBHandler.getValue(
          s.COMMERCIAL,
          [M],
          function (a) {
            m.CallbackHandler.callSuccessCallback(e, {
              noSignalImage: a.noSignalImage,
            });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get NoSignalImage status.'
            );
          }
        );
      });
    },
    getPowerOnOffHistory: function (e, a) {
      g('getPowerOnOffHistory', a, function () {
        m.DBHandler.getValue(
          s.COMMERCIAL,
          [b],
          function (a) {
            var l = a.powerOnOffHistory;
            for (
              'string' == typeof a.powerOnOffHistory &&
              (l = JSON.parse(a.powerOnOffHistory));
              ;

            ) {
              var n = l.indexOf(' ');
              if (-1 === n) break;
              l.splice(n, 1);
            }
            m.CallbackHandler.callSuccessCallback(e, { powerOnOffHistory: l });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get Power On/Off history.'
            );
          }
        );
      });
    },
    setPowerOnStatus: function (e, a, l) {
      g('setPowerOnStatus', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['mode'])
          ? !1 !==
            m.ParameterChecker.checkParametersValidation(
              r.POWERONSTATUS,
              l,
              'mode'
            )
            ? m.DBHandler.setValue(
                s.HOTELMODE,
                { powerOnStatus: l.mode },
                function (a) {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set Power On status.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getPowerOnStatus: function (e, a) {
      g('getPowerOnStatus', a, function () {
        m.DBHandler.getValue(
          s.HOTELMODE,
          [E],
          function (a) {
            m.CallbackHandler.callSuccessCallback(e, {
              powerOnStatus: a.powerOnStatus,
            });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get Power On status.'
            );
          }
        );
      });
    },
    setKAM: function (e, a, l) {
      g('setKAM', a, function () {
        var n;
        if (
          !1 !== m.ParameterChecker.checkMissingParameters(l, ['keepAliveMode'])
        ) {
          if (!0 === l.keepAliveMode) n = 'enable';
          else {
            if (!1 !== l.keepAliveMode)
              return void m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameter. parameters.enable should be true or false.'
              );
            n = 'disable';
          }
          m.DBHandler.setValue(
            s.COMMERCIAL,
            { enableKAM: n },
            function (a) {
              m.CallbackHandler.callSuccessCallback(e);
            },
            function (e) {
              m.CallbackHandler.callFailureCallback(
                a,
                e,
                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                'Failed to set Keep Alive Mode settings.'
              );
            }
          );
        } else
          m.CallbackHandler.callFailureCallback(
            a,
            {},
            r.ERROR_CODE.COMMON.BAD_PARAMETERS,
            'Missing required parameters.'
          );
      });
    },
    getKAM: function (e, a) {
      g('getKAM', a, function () {
        m.DBHandler.getValue(
          s.COMMERCIAL,
          [R],
          function (a) {
            var l = 'enable' === a[R];
            m.CallbackHandler.callSuccessCallback(e, { keepAliveMode: l });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get Keep Alive Mode settings.'
            );
          }
        );
      });
    },
    changePassword: function (e, a, l) {
      g('changePassword', a, function () {
        var n,
          t,
          c,
          R = 4;
        !1 !==
        m.ParameterChecker.checkMissingParameters(l, [
          'currentPassword',
          'newPassword',
        ])
          ? ((n = l.currentPassword),
            (t = l.newPassword),
            ('string' == typeof n && 'string' == typeof t) ||
              m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameter type.'
              ),
            o.webOSVersion >= 4 && (R = 6),
            (c = (function () {
              var e = '';
              for (i = 0; i < R; i++) e += '9';
              return parseInt(e);
            })()),
            n.length === R && t.length === R
              ? parseInt(t) < 0 || parseInt(t) > c
                ? m.CallbackHandler.callFailureCallback(
                    a,
                    {},
                    r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                    'Invalid password format. Valid password value range is from ' +
                      (function () {
                        var e = '';
                        for (i = 0; i < R; i++) e += '0';
                        return e;
                      })() +
                      ' to ' +
                      c +
                      '.'
                  )
                : n !== t
                  ? o.webOSVersion >= 3.2
                    ? m.DBHandler.getValueBySettingsService(
                        s.LOCK,
                        [S],
                        function (l) {
                          l[S] !== n
                            ? m.CallbackHandler.callFailureCallback(
                                a,
                                {},
                                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                'Incorrect password. Access denied.'
                              )
                            : m.DBHandler.setValueBySettingsService(
                                s.LOCK,
                                { systemPin: t },
                                function () {
                                  m.CallbackHandler.callSuccessCallback(e);
                                },
                                function (e) {
                                  'function' == typeof a &&
                                    m.CallbackHandler.callFailureCallback(
                                      a,
                                      errorObject,
                                      r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                      'Failed to set new password.'
                                    );
                                }
                              );
                        },
                        function (e) {
                          m.CallbackHandler.callFailureCallback(
                            a,
                            e,
                            r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                            'Failed to get current password from platform.'
                          );
                        }
                      )
                    : m.DBHandler.getValue(
                        s.HOTELMODE,
                        [O],
                        function (l) {
                          l[O] !== n
                            ? m.CallbackHandler.callFailureCallback(
                                a,
                                {},
                                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                'Incorrect password. Access denied.'
                              )
                            : m.DBHandler.setValue(
                                s.HOTELMODE,
                                { password: t },
                                function () {
                                  if (o.webOSVersion >= 3.2)
                                    m.CallbackHandler.callSuccessCallback(e);
                                  else {
                                    var a = '';
                                    if ('0000' === t) a = '8080';
                                    else {
                                      var l = parseInt(t);
                                      a = (
                                        '0000' +
                                        parseInt((l / 10).toString()) +
                                        ((l + 1) % 10).toString()
                                      ).substr(-4);
                                    }
                                    m.CallbackHandler.callSuccessCallback(e, {
                                      serverUIPassword: a,
                                    });
                                  }
                                },
                                function (e) {
                                  'function' == typeof a &&
                                    m.CallbackHandler.callFailureCallback(
                                      a,
                                      errorObject,
                                      r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                      'Failed to set new password.'
                                    );
                                }
                              );
                        },
                        function (e) {
                          m.CallbackHandler.callFailureCallback(
                            a,
                            e,
                            r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                            'Failed to get current password from platform.'
                          );
                        }
                      )
                  : m.CallbackHandler.callFailureCallback(
                      a,
                      {},
                      r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                      'Current and new password are same.'
                    )
              : m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                  'Invalid password format. Password length should be ' + R
                ))
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getNativePortraitMode: function (e, a) {
      g('getNativePortraitMode', a, function () {
        3 === o.webOSVersion
          ? m.DBHandler.getValue(
              s.COMMERCIAL,
              [u],
              function (a) {
                m.CallbackHandler.callSuccessCallback(e, {
                  nativePortrait: a[u],
                });
              },
              function (e) {
                m.CallbackHandler.callFailureCallback(
                  a,
                  e,
                  r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                  'Failed to get Native Portrait Mode settings.'
                );
              }
            )
          : o.webOSVersion >= 3.2
            ? m.DBHandler.getValue(
                s.OPTION,
                [C],
                function (a) {
                  m.CallbackHandler.callSuccessCallback(e, {
                    nativePortrait: a[C],
                  });
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to get Native Portrait Mode settings.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                'Cannot get platform information yet. Try again later.'
              );
      });
    },
    setNativePortraitMode: function (e, a, l) {
      g('setNativePortraitMode', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['nativePortrait'])
          ? !1 !==
            m.ParameterChecker.checkParametersValidation(
              r.NATIVEPORTRAIT,
              l,
              'nativePortrait'
            )
            ? 3 === o.webOSVersion
              ? m.DBHandler.setValue(
                  s.COMMERCIAL,
                  { siAppOrientation: l.nativePortrait },
                  function (a) {
                    m.CallbackHandler.callSuccessCallback(e);
                  },
                  function (e) {
                    m.CallbackHandler.callFailureCallback(
                      a,
                      e,
                      r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                      'Failed to set Native Portrait Mode settings.'
                    );
                  }
                )
              : o.webOSVersion >= 3.2
                ? m.DBHandler.setValue(
                    s.OPTION,
                    { screenRotation: l.nativePortrait },
                    function (a) {
                      m.CallbackHandler.callSuccessCallback(e);
                    },
                    function (e) {
                      m.CallbackHandler.callFailureCallback(
                        a,
                        e,
                        r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                        'Failed to set Native Portrait Mode settings.'
                      );
                    }
                  )
                : m.CallbackHandler.callFailureCallback(
                    a,
                    {},
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Cannot get platform information yet. Try again later.'
                  )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
    getWoWLAN: function (e, a) {
      g('getWoWLAN', a, function () {
        m.DBHandler.getValue(
          s.NETWORK,
          [d],
          function (a) {
            var l;
            (l = 'true' === a[d]),
              m.CallbackHandler.callSuccessCallback(e, { enableWoWLAN: l });
          },
          function (e) {
            m.CallbackHandler.callFailureCallback(
              a,
              e,
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'Failed to get WoWLAN settings.'
            );
          }
        );
      });
    },
    setWoWLAN: function (e, a, l) {
      g('setWoWLAN', a, function () {
        !1 !== m.ParameterChecker.checkMissingParameters(l, ['enableWoWLAN'])
          ? 'boolean' == typeof l.enableWoWLAN
            ? m.DBHandler.setValue(
                s.NETWORK,
                { wolwowlOnOff: l.enableWoWLAN.toString() },
                function () {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set WoWLAN settings.'
                  );
                }
              )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'enableWoWLAN property value must be true or false boolean value.'
              )
          : m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
      });
    },
  }),
    (r.prototype.Signage = {
      enableScreenShareApp: function (e, a, l) {
        g('enableScreenShareApp', a, function () {
          if (!1 !== m.ParameterChecker.checkMissingParameters(l, ['enable'])) {
            'boolean' != typeof l.enable &&
              m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              );
            var n = {};
            !0 === l.enable
              ? (n.enableScreenShare = 'on')
              : (n.enableScreenShare = 'off'),
              m.DBHandler.setValue(
                s.COMMERCIAL,
                n,
                function () {
                  m.CallbackHandler.callSuccessCallback(e);
                },
                function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to set enable of Screen Share application.'
                  );
                }
              );
          } else
            m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
        });
      },
      addUSBAttachEventListener: function (e, a) {
        g('addUSBAttachEventListener', a, function () {
          c.USBAttachEventListener = n.Request(
            'luna://com.webos.service.attachedstoragemanager',
            {
              method: 'listDevices',
              parameters: { subscribe: !0 },
              onSuccess: function (a) {
                var l = [];
                if (a.devices)
                  for (var n = 0; n < a.devices.length; n++) {
                    var r = a.devices[n];
                    ('usb' !== r.deviceType && 'sdcard' !== r.deviceType) ||
                      l.push({
                        type: r.deviceType,
                        vendor: r.vendorName,
                        device: r.deviceName,
                      });
                  }
                m.CallbackHandler.callSuccessCallback(e, { deviceList: l });
              },
              onFailure: function () {
                m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                  'Cannot get USB device information.'
                );
              },
            }
          );
        });
      },
      removeUSBAttachEventListener: function (e, a) {
        g('removeUSBAttachEventListener', a, function () {
          null === c.USBAttachEventListener
            ? m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                'Event listener is not set. Use addUSBAttachEventListener() first.'
              )
            : (c.USBAttachEventListener.cancel(),
              m.CallbackHandler.callSuccessCallback(e));
        });
      },
      getwebOSVersion: function (e, a) {
        g('getwebOSVersion', a, function () {
          -2 === o.webOSVersion
            ? m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                'Cannot get platform information yet. Please try later.'
              )
            : -1 === o.webOSVersion
              ? m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                  'Cannot get platform information.'
                )
              : 'number' == typeof o.webOSVersion
                ? m.CallbackHandler.callSuccessCallback(e, {
                    webOSVersion: o.webOSVersion.toFixed(1),
                  })
                : m.CallbackHandler.callFailureCallback(
                    a,
                    {},
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Cannot get platform information.'
                  );
        });
      },
      getApplicationInfo: function (e, a) {
        g('getApplicationInfo', a, function () {
          if (
            (function () {
              if (window.PalmSystem) return PalmSystem.identifier.split(' ')[0];
              var e = location.href;
              return -1 !== e.indexOf(r.APPLICATION.IPK_TYPE)
                ? r.APPLICATION.IPK_TYPE
                : -1 !== e.indexOf(r.APPLICATION.ZIP_TYPE + '.debug')
                  ? r.APPLICATION.ZIP_TYPE + '.debug'
                  : -1 !== e.indexOf(r.APPLICATION.ZIP_TYPE)
                    ? r.APPLICATION.ZIP_TYPE
                    : '__UNKNOWN__';
            })() === r.APPLICATION.IPK_TYPE
          ) {
            var l = new XMLHttpRequest();
            (l.onreadystatechange = function () {
              if (4 == this.readyState)
                try {
                  var l = JSON.parse(this.responseText);
                  m.CallbackHandler.callSuccessCallback(e, l);
                } catch (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    {},
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to get application information.'
                  );
                }
            }),
              (l.onerror = function (e) {
                m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                  'Failed to get application information.'
                );
              }),
              l.open('GET', 'appinfo.json', !0),
              l.send();
          } else
            m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
              'This application is not IPK type.'
            );
        });
      },
      switchApplication: function (e, a, l) {
        g('switchApplication', a, function () {
          var t, i;
          !1 !== m.ParameterChecker.checkMissingParameters(l, ['application'])
            ? 'string' == typeof l.application &&
              !1 !==
                m.ParameterChecker.checkParametersValidation(
                  r.APPLICATION,
                  l,
                  'application'
                )
              ? ((t = function (t) {
                  var i, c;
                  (i = function (i) {
                    !0 === i && (r.APPLICATION.ZIP_TYPE += '.debug'),
                      n.Request('luna://com.webos.applicationManager', {
                        method: 'launch',
                        parameters: { id: l.application, params: { path: t } },
                        onSuccess: function () {
                          m.CallbackHandler.callSuccessCallback(e);
                        },
                        onFailure: function (e) {
                          -101 === e.errorCode
                            ? m.CallbackHandler.callFailureCallback(
                                a,
                                {},
                                r.ERROR_CODE.APPLICATION.NOT_INSTALLED,
                                'Application is not installed.'
                              )
                            : m.CallbackHandler.callFailureCallback(
                                a,
                                e,
                                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                'Failed to launch target application.'
                              );
                        },
                      });
                  }),
                    (c = function (e) {
                      m.CallbackHandler.callFailureCallback(
                        a,
                        e,
                        r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                        'Failed to get application information.'
                      );
                    }),
                    n.Request('palm://com.palm.service.devmode', {
                      method: 'getDevMode',
                      parameters: {},
                      onSuccess: function (e) {
                        i(e.enabled);
                      },
                      onFailure: function (e) {
                        c(e);
                      },
                    });
                }),
                (i = function (e) {
                  m.CallbackHandler.callFailureCallback(
                    a,
                    e,
                    r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                    'Failed to get application launch settings.'
                  );
                }),
                m.DBHandler.getValue(
                  s.COMMERCIAL,
                  [
                    'serverIpPort',
                    'siServerIp',
                    'secureConnection',
                    'appLaunchMode',
                    'fqdnAddr',
                    'fqdnMode',
                  ],
                  function (e) {
                    var a = '';
                    'none' === e.appLaunchMode
                      ? i({
                          errorCode: r.ERROR_CODE.APPLICATION.SETTINGS_ERROR,
                          errorText:
                            'Application launch mode is NONE. Set SI Server settings first.',
                        })
                      : 'local' === e.appLaunchMode
                        ? (a =
                            'file:////mnt/lg/appstore/scap/procentric/scap/application/app/index.html')
                        : 'usb' === e.appLaunchMode
                          ? (a = 'file:////tmp/usb/sda/sda/index.html')
                          : 'remote' === e.appLaunchMode
                            ? 'on' === e.fqdnMode
                              ? (a = e.fqdnAddr)
                              : 'off' === e.fqdnMode
                                ? 'on' === e.secureConnection
                                  ? (a +=
                                      'http://' +
                                      e.siServerIp +
                                      ':' +
                                      e.serverIpPort +
                                      '/procentric/scap/application/index.html')
                                  : 'on' === e.secureConnection
                                    ? (a +=
                                        'https://' +
                                        e.siServerIp +
                                        ':' +
                                        e.serverIpPort +
                                        '/procentric/scap/application/index.html')
                                    : i({
                                        errorCode:
                                          r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                        errorText:
                                          'Failed to get application installation settings.',
                                      })
                                : i({
                                    errorCode:
                                      r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                    errorText:
                                      'Failed to get application installation settings.',
                                  })
                            : i({
                                errorCode: r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                errorText:
                                  'Failed to get application installation settings.',
                              }),
                      t(a);
                  },
                  function (e) {
                    i(e);
                  }
                ))
              : m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                  'Invalid application.'
                )
            : m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Missing required parameters.'
              );
        });
      },
      disableApplication: function (e, a, l) {
        g('disableApplication', a, function () {
          var n = { appLaunchMode: 'none' };
          if (!0 === m.ParameterChecker.checkMissingParameters(l, ['reset'])) {
            if ('boolean' != typeof l.reset)
              return void m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'reset property value must be true or false boolean value, if use this property.'
              );
            !0 === l.reset &&
              ((n.siServerIp = '0.0.0.0'),
              (n.serverIpPort = '0'),
              (n.secureConnection = 'off'),
              (n.appType = 'zip'),
              (n.fqdnMode = 'off'),
              (n.fqdnAddr = 'http://'));
          } else
            m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Application will be disabled after reboot only if reset property is true.'
            );
          m.DBHandler.setValue(
            s.COMMERCIAL,
            n,
            function () {
              m.CallbackHandler.callSuccessCallback(e);
            },
            function (e) {
              m.CallbackHandler.callFailureCallback(
                a,
                e,
                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                'Failed to disable application.'
              );
            }
          );
        });
      },
    }),
    (r.prototype.VideoSync = {
      setMaster: function (e, a, l) {
        g('setMaster', a, function () {
          if (
            !1 !== m.ParameterChecker.checkMissingParameters(l, ['ip', 'port'])
          )
            if (
              'object' != typeof l ||
              'string' != typeof l.ip ||
              'number' != typeof l.port ||
              isNaN(l.port)
            )
              m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              );
            else {
              var t = l.ip.split('.');
              if (4 === t.length) {
                for (var i = 0; i < 4; i++) {
                  var c = parseInt(t[i]);
                  if (c < 0 || c > 255)
                    return void m.CallbackHandler.callFailureCallback(
                      a,
                      {},
                      r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                      'Invalid IP format.'
                    );
                }
                l.port < 0 || l.port > 65535
                  ? m.CallbackHandler.callFailureCallback(
                      a,
                      {},
                      r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                      'Invalid port value.'
                    )
                  : _(
                      function (t) {
                        n.Request('luna://com.webos.media', {
                          method: 'setMaster',
                          parameters: { mediaId: t, ip: l.ip, port: l.port },
                          onSuccess: function (a) {
                            m.CallbackHandler.callSuccessCallback(e, {
                              basetime: a.basetime,
                            });
                          },
                          onFailure: function (e) {
                            m.CallbackHandler.callFailureCallback(
                              a,
                              e,
                              r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                              'Failed to set master.'
                            );
                          },
                        });
                      },
                      function (e) {
                        m.CallbackHandler.callFailureCallback(
                          a,
                          e,
                          r.ERROR_CODE.COMMON.MEDIA_ERROR,
                          'Failed to get loaded media information.'
                        );
                      },
                      { videoEl: l.videoElement }
                    );
              } else
                m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                  'Invalid IP format.'
                );
            }
          else
            m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
        });
      },
      setSlave: function (e, a, l) {
        g('setSlave', a, function () {
          if (
            !1 !==
            m.ParameterChecker.checkMissingParameters(l, [
              'ip',
              'port',
              'basetime',
            ])
          )
            if (
              'object' != typeof l ||
              'string' != typeof l.ip ||
              'number' != typeof l.port ||
              isNaN(l.port)
            )
              m.CallbackHandler.callFailureCallback(
                a,
                {},
                r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                'Invalid parameters.'
              );
            else {
              var t = l.ip.split('.');
              if (4 === t.length) {
                for (var i = 0; i < 4; i++) {
                  var c = parseInt(t[i]);
                  if (c < 0 || c > 255)
                    return void m.CallbackHandler.callFailureCallback(
                      a,
                      {},
                      r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                      'Invalid IP format.'
                    );
                }
                l.port < 0 || l.port > 65535
                  ? m.CallbackHandler.callFailureCallback(
                      a,
                      {},
                      r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                      'Invalid port value.'
                    )
                  : parseInt(l.basetime < 0)
                    ? m.CallbackHandler.callFailureCallback(
                        a,
                        {},
                        r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                        'Invalid basetime value.'
                      )
                    : _(
                        function (t) {
                          n.Request('luna://com.webos.media', {
                            method: 'setSlave',
                            parameters: {
                              mediaId: t,
                              ip: l.ip,
                              port: l.port,
                              basetime: l.basetime,
                            },
                            onSuccess: function () {
                              m.CallbackHandler.callSuccessCallback(e);
                            },
                            onFailure: function (e) {
                              m.CallbackHandler.callFailureCallback(
                                a,
                                e,
                                r.ERROR_CODE.COMMON.INTERNAL_ERROR,
                                'Failed to set slave.'
                              );
                            },
                          });
                        },
                        function (e) {
                          m.CallbackHandler.callFailureCallback(
                            a,
                            e,
                            r.ERROR_CODE.COMMON.MEDIA_ERROR,
                            'Failed to get loaded media information.'
                          );
                        },
                        { videoEl: l.videoElement }
                      );
              } else
                m.CallbackHandler.callFailureCallback(
                  a,
                  {},
                  r.ERROR_CODE.COMMON.BAD_PARAMETERS,
                  'Invalid IP format.'
                );
            }
          else
            m.CallbackHandler.callFailureCallback(
              a,
              {},
              r.ERROR_CODE.COMMON.BAD_PARAMETERS,
              'Missing required parameters.'
            );
        });
      },
    }),
    (l.exports = r);
}),
  (Custom = cordova.require('cordova/plugin/custom'));
