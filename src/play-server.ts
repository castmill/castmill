/**
 *
 * This module helps in playing content in order without risk for
 * overlapping content and other issues. It also allows to use
 * transitions between elements.
 *
 * Basically a play-server manages one DOM element and the content just beneath it.
 * It can also be seen as a playables orchestrator in a given element.
 *
 */
/// <reference path="../node_modules/@types/bluebird/index.d.ts" />
/// <reference path="../node_modules/@types/lodash/index.d.ts" />
/// <reference path="../node_modules/@types/jquery/index.d.ts" />
/// <reference path="layer.ts" />

var PLAY_TIMEOUT = 5000; //to prevent infinite waiting for misbehaving layers.

/*
var transitions = [
  Transitions.crossFade,
  Transitions.zoom,
  Transitions.stretch
];
*/
namespace Castmill {
  export class PlayServer {
    private el: HTMLElement;
    public volume: number;

    private currentLayer: Layer;
    private shown: boolean;

    constructor(el: HTMLElement, opts?: {}) {
      _.extend(this, opts);
      this.el = el;
    }

    private show(layer: Layer, offset: number, performTransition: boolean): Promise<void> {
      var prevLayer = this.currentLayer;
      //
      // Put the previous layer in front.
      //
      if (prevLayer && prevLayer !== layer) {
        $(prevLayer.el).css({ 'z-index': 1000 });
      }

      $(layer.el).css({ 'z-index': 0 });
      layer.el.style.display = "none";
      this.el.appendChild(layer.el);

      //
      // Load the new layer
      // Not sure finally is the proper one here.
      //
      this.currentLayer = layer;
      return layer.load()
        .then(() => layer.seek(offset || 0))
        .finally(() => {
          layer.el.style.display = 'block';
          if(prevLayer && prevLayer !== layer){
            prevLayer.unload();
            this.el.removeChild(prevLayer.el);
          }
        });
    }

    play(layer: Layer, offset: number, volume: number, performTransition: boolean) {
      return this.show(layer, offset, performTransition).then(function () {
        return layer.play();
      });
    }

    seek(offset: number): Promise<void> {
      return this.currentLayer.seek(offset);
    }

    /**
      Stop whatever is currently being played.
    */
    stop() {
      //this.showing && this.showing.cancel();
      this.currentLayer && this.currentLayer.stop();
    }

    clean() {
      this.stop();
      if (this.currentLayer) {
        this.currentLayer.unload();
        this.currentLayer = null;
      }
      this.shown = false;
    }

    /*
    showLayer(layer, volume, performTransition) {
      var _this = this;
      var $el = this.$el;

      var prevLayer = _this.currentLayer;

      // Special case handling when prev and new layer and the same.
      var WidgetVideoView = VideoWidget.prototype.View;
      var isVideo = layer.widgetView instanceof WidgetVideoView;

      if (prevLayer && prevLayer._cid === layer._cid) {
        if (layer.duration <= 1000 || !isVideo) {
          _this.shown = true;
          return waitUntilPlaying(layer);
        }

        // Due to a bug in xwalk seek, we need to clean the layer for videos longer than 30 seconds.
        layer.clean();
        performTransition = false;
      }

      // Disable transtions for videos.
      if (isVideo || (prevLayer && (prevLayer.widgetView instanceof WidgetVideoView))) {
        performTransition = false;
      }

      _this.currentLayer = layer.retain();

      this.showing && this.showing.cancel();

      //
      // Put the previous layer in front.
      //
      if (prevLayer && prevLayer.view && prevLayer.view.$el) {
        prevLayer.view.$el.css({ 'z-index': 1000 });
      }

      return this.showing = layer.then(function () {
        //
        // Render the layer
        //
        return layer.render($el[0]);
      }).then(function ($layer) {
        //
        // Put the new layer back of the previous layer.
        //
        layer.view.$el.css({ 'z-index': 0 });
        return waitUntilPlaying(layer);
      }).then(function () {
        _this.emit('shown:', layer);

        _this.setEntryVolume(volume);

        _this.background && _this.$el.css({ background: _this.background });
        if (performTransition) {
          return transitions[Math.floor(Math.random() * transitions.length)](layer, prevLayer, { duration: 500 });
        }
      }).ensure(function () {
        cleanPrevLayer();
      });

      function cleanPrevLayer() {
        _this.shown = true;
        if (prevLayer && prevLayer != layer) {
          _this.cleanLayer(prevLayer);
        }
      }
    }
    */
    /*
    cleanLayer(layer) {
      layer.pause();
      layer.clean();
      this.emit('cleaned:', layer);
      layer.release();
    }

    setMasterVolume(volume) {
      this.volume = volume;
      this._setOutputVolume()
    }
    setEntryVolume(volume) {
      this.entryVolume = volume;
      this._setOutputVolume();
    }
    mute(mute) {
      this.muted = mute;
      this._setOutputVolume();
    }
    _setOutputVolume() {
      var layer = this.currentLayer;
      var volume = this.entryVolume || 60;

      if (!this.muted) {
        volume = (this.volume * volume) / 100;
      } else {
        volume = 0;
      }
      layer && layer.setVolume(volume);
    }
    */
  }

  /*
  function waitUntilPlaying(layer) {
    var timeout;
    return (new Gnd.Promise(function (resolve, reject) {
      timeout = Gnd.Promise.delay(PLAY_TIMEOUT).then(resolve, reject);

      layer.whenPlaying().then(function () {
        resolve();
        timeout.cancel();
      }, reject);
    }, function () {
      timeout.cancel();
    }));
  }
  */
}