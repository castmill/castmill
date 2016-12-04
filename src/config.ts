/// <reference path="../node_modules/@types/bluebird/index.d.ts" />

namespace Castmill {
  window['Bluebird'] = Promise;

  Bluebird.config({
    cancellation: true,
  });

  export interface Config {
    widgetBase: string;
  }
}