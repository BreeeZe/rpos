var gulp = require('gulp'),
    ts = require('gulp-typescript'),
    tsd = require('gulp-tsd')

gulp.task('default', function () {
    return gulp.src(["**/*.ts","!./node_modules/**/*","!./typings/**/*"])
        .pipe(ts('tsconfig.json'));
});

gulp.task('typings', function(cb){
    tsd({
        command:"reinstall",
        config:"./tsd.json"
    },cb);
});