import { Playlist } from './playlist';
import { PlayServer} from './play-server';
import { Layout } from './layout';
import { Widget } from './widget';
import { Layer } from './layer';

document.addEventListener("DOMContentLoaded", function() {

  /*
  Promise.config({
    cancellation: true
  });
  */
  
  var layer0 = new Layer({
    widgetId: '0',
    config: {
      widgetBase: 'http://localhost:3000/videos'
    },
    volume: 0,
    _duration: 0
  })
  
  var layer1 = new Layer({
    widgetId: '1',
    config: {
      widgetBase: 'http://localhost:3000'
    },
    _duration: 3000
  });
  
  var layer2 = new Layer({
    widgetId: '2',
    config: {
      widgetBase: 'http://localhost:3000'
    },
    _duration: 3000
  });
  
  var layer3 = new Layer({
    widgetId: '3',
    config: {
      widgetBase: 'http://localhost:3000'
    },
    _duration: 3000
  });
  
  var layer4 = new Layer({
    widgetId: '4',
    config: {
      widgetBase: 'http://localhost:3000'
    },
    _duration: 3000
  });
  
  var layer5 = new Layer({
    widgetId: '5',
    config: {
      widgetBase: 'http://localhost:3000/videos'
    },
    _duration: 0,
    volume: 0
  });
  
  var layer6 = new Layer({
    widgetId: '6',
    config: {
      widgetBase: 'http://localhost:3000/videos'
    },
    _duration: 0,
    volume: 0
  });
  
  var server = new PlayServer($('#wrapper')[0]);
  
  var playlist = new Playlist(function(){
    console.log('Playlist ended');
    playlist.play(server);
  });
  
  var layout = new Layout();
  playlist.add(layout);
  
  var container0 = layout.add({
    top: '0%',
    left: '0%',
    width: '50%',
    height: '50%'
  });
  
  container0.add(layer1);
  container0.add(layer2);
  container0.add(layer3);
  container0.add(layer4);
  
  var container1 = layout.add({
    top: '50%',
    left: '0%',
    width: '100%',
    height: '50%'
  });
  
  container1.add(layer0);
  
  var container2 = layout.add({
    top: '0%',
    left: '50%',
    width: '50%',
    height: '50%'
  });
  
  container2.add(layer5);
  container2.add(layer6);
  
  playlist.add(layer5);
  
  playlist.play(server);
  });