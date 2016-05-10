var gulp = require('gulp'),
    ts = require('gulp-typescript'),
    tsd = require('gulp-tsd'),
    runSequence = require('run-sequence'),
    sourcemaps = require('gulp-sourcemaps')

gulp.task('default',function(cb){
    runSequence('typings','compile',cb);
})

gulp.task('compile', function () {
    return gulp.src(["**/*.ts","!./node_modules/**/*","!./typings/**/*"])
        .pipe(sourcemaps.init())
        .pipe(ts('tsconfig.json'))
        .js
        .pipe(sourcemaps.write("./"))
        .pipe(gulp.dest("./"));
});

gulp.task('typings', function(cb){
    tsd({
        command:"reinstall",
        config:"./tsd.json"
    },cb);
});