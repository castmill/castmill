const express = require("express");
const app = express();
const fs = require("fs");
const _ = require("lodash");

const CASTMILL_SRC = "/castmill.es.js";

const widgetTmpl = _.template(fs.readFileSync("./templates/widget.html"));

app.use("/", express.static(__dirname + "/demos"));
app.use("/", express.static(__dirname + "/dist"));

app.get("/videos/:id", function(req, res) {
  //
  // render widget template
  //
  var result = widgetTmpl({
    widgetId: req.params.id,
    widgetSrc: CASTMILL_SRC,
    baseUrl: "http://localhost:4000/widgets",
    widgetConstructor: "Castmill.Video",
  });
  res.send(result);
});

app.get("/:id", function(req, res) {
  //
  // render widget template
  //
  var result = widgetTmpl({
    widgetId: req.params.id,
    widgetSrc: CASTMILL_SRC,
    baseUrl: "http://localhost:4000/widgets",
    widgetConstructor: "Castmill.Image",
  });
  res.send(result);
});

app.get("/widgets/:id", function(req, res) {
  switch (req.params.id) {
    case "0":
      res.json({
        // src: 'http://www.html5videoplayer.net/videos/madagascar3.mp4'
        src:
          "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      });
      break;
    case "1":
      res.json({
        src: "http://www.sembo.se/media/8238016/nice_950x350_top.jpg",
      });
      break;
    case "2":
      res.json({
        src:
          "http://www.stockvault.net/blog/wp-content/uploads/2013/11/Portrait-8.jpg",
      });
      break;
    case "3":
      res.json({
        src:
          "https://i.pinimg.com/originals/75/fe/c1/75fec1c2731e49bcb1922beaa3311f80.jpg",
      });
      break;
    case "4":
      res.json({
        src:
          "https://s-media-cache-ak0.pinimg.com/originals/ef/83/60/ef83604a2bedd8043ccc2fe56fed3bc7.jpg",
      });
      break;
    case "5":
      res.json({
        src: "https://tekeye.uk/html/images/Joren_Falls_Izu_Jap.mp4",
      });
      break;
    case "6":
      res.json({
        src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
      });
      break;
  }
});

app.listen(4000, function() {
  console.log("Example app listening on port 4000!");
});
