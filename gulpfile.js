/**
 * Gulpfile for building the castmill widgets.
 *
 */
var gulp = require('gulp');
var ts = require('gulp-typescript');
var uglify = require('gulp-uglify');
var pump = require('pump');
var rename = require("gulp-rename");

gulp.task('dist', ['default'], function (cb) {
  var fs = require('fs');
  var package = JSON.parse(fs.readFileSync('./package.json'));

  pump([
        gulp.src('build/*.js'),
        uglify(),
        rename('castmill.min.js'),
        gulp.dest('dist/')
    ],
    cb
  );
});

gulp.task('default', function () {
  return gulp.src('src/**/*.ts')
    .pipe(ts({
      noImplicitAny: true,
      out: 'castmill.js'
    }))
    .pipe(gulp.dest('build'));
});

gulp.task('watch', ['default'], function () {
  gulp.watch('src/**/*.ts', ['default']);
});
