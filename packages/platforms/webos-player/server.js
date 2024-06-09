var express = require('express');
var onFinished = require('on-finished');
var app = express();

const {version} = require('./appinfo/appinfo.json');

// LATEST BUILD
const CURRENT_BUILD = {
  file: `com.lg.app.signage_${version}_all.ipk`,
  root: './build',
};

// LATEST RELEASE
const CURRENT_RELEASE = {
  file: `player.ipk`,
  root: './releases/latest',
};

// LATEST TPD
const CURRENT_TPD = {
  file: `com.lg.app.signage_${version}_all.ipk`,
  root: './releases/tpd',
};

// LATEST Test
const CURRENT_TEST = {
  file: `com.lg.app.signage_${version}_all.ipk`,
  root: './releases/test',
};

let path;
const args = process.argv.slice(2);
console.log('args: ', args);

switch ((args[0] || '').toLowerCase()) {
  case 'tpd':
    path = CURRENT_TPD;
    break;
  case 'latest':
    path = CURRENT_RELEASE;
    break;
  case 'build':
    path = CURRENT_BUILD;
    break;
  case 'test':
    path = CURRENT_TEST;
    break;
  default:
    path = CURRENT_BUILD;
    break;
}

console.log('Server publishing ipk', path);

app.use((req, res, next) => {
  console.log('got request', req.originalUrl);
  onFinished(res, (err, res) => {
    console.log('finished downloading');
  });
  next();
});

app.use('/application/com.lg.app.signage.ipk', (req, res, next) => {
  console.log('got request for com.lg.app.signage.ipk');
  console.log(`Sending file ${path.root}/${path.file}`);
  res.contentType('application/octet-stream; charset=UTF-8');
  res.sendFile(path.file, {root: path.root});
});

// static serve of the dist folder
app.use('/dist', express.static('dist'));

app.listen(3232);
