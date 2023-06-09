// Require our dependencies
const autoprefixer = require('autoprefixer');
const babel = require('gulp-babel');
const browserSync = require('browser-sync').create();
const concat = require('gulp-concat');
const cssnano = require('cssnano');
const eslint = require('gulp-eslint');
const fs = require('fs');
const gulp = require('gulp');
const iife = require('gulp-iife');
const imagemin = require('gulp-imagemin');
const packagejson = JSON.parse(fs.readFileSync('./package.json'));
const mqpacker = require( 'css-mqpacker' );
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const rename = require('gulp-rename');
const sass = require('gulp-sass')(require('sass'));
const sassGlob = require('gulp-sass-glob');
const sort = require( 'gulp-sort' );
const gulpStylelint = require('gulp-stylelint');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const wpPot = require('gulp-wp-pot');
const exec = require('child_process').exec;

// Some config data for our tasks
const config = {
  styles: {
    admin_src: 'assets/sass/**/*.scss',
    lint_dest: 'assets/sass/',
    dest: 'assets/css'
  },
  scripts: {
    admin_src: './assets/js/src/*.js',
    uglify: [ 'assets/js/*.js', '!assets/js/*.min.js' ],
    dest: './assets/js'
  },
  images: {
  	docs_src: './docs/assets/img/**/*',
  	docs_dest: './docs/assets/img/'
  },
  languages: {
    src: [ './**/*.php', '!.git/*', '!.svn/*', '!bin/**/*', '!node_modules/*', '!release/**/*', '!vendor/**/*' ],
    dest: './languages/' + packagejson.name + '.pot'
  },
  changelog: {
    src: 'changelog.md',
    edit: 'changelog.txt',
    dest: '.'
  },
  browserSync: {
    active: false,
    localURL: 'mylocalsite.local'
  }
};

function adminstyles() {
  return gulp.src(config.styles.admin_src)
    .pipe(sourcemaps.init()) // Sourcemaps need to init before compilation
    .pipe(sassGlob()) // Allow for globbed @import statements in SCSS
    .pipe(sass()) // Compile
    .on('error', sass.logError) // Error reporting
    .pipe(postcss([
      mqpacker( {
        'sort': true
      } ),
      cssnano( {
        'safe': true // Use safe optimizations.
      } ) // Minify
    ]))
    .pipe(sourcemaps.write()) // Write the sourcemap files
    .pipe(gulp.dest(config.styles.dest)) // Drop the resulting CSS file in the specified dir
    .pipe(browserSync.stream());
}

function sasslint() {
  return gulp.src(config.styles.admin_src)
    .pipe(gulpStylelint({
      fix: true
    }))
    .pipe(gulp.dest(config.styles.lint_dest));
}

function adminscripts() {
  return gulp.src(config.scripts.admin_src)
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(concat(packagejson.name + '-admin.js')) // Concatenate
    .pipe(sourcemaps.write())
    .pipe(eslint())
    .pipe(iife({
      useStrict: false,
      params: ['$'],
      args: ['jQuery']
    }))
    .pipe(gulp.dest(config.scripts.dest))
    .pipe(browserSync.stream());
}

function uglifyscripts() {
  return gulp.src(config.scripts.uglify)
    .pipe(uglify()) // Minify + compress
    .pipe(rename({
      suffix: '.min'
    }))
    //.pipe(sourcemaps.write())
    .pipe(gulp.dest(config.scripts.dest))
    .pipe(browserSync.stream());
}

// Optimize Images
function images() {
  return gulp.src(config.images.docs_src)
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.mozjpeg({ quality: 90, progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo({
          plugins: [
            {
              removeViewBox: false,
              collapseGroups: true
            }
          ]
        })
      ])
    )
    .pipe(gulp.dest(config.images.docs_dest));
}

// Generates translation file.
function translate() {
    return gulp
      .src( config.languages.src )
      .pipe( wpPot( {
        domain: packagejson.name,
        package: packagejson.name
      } ) )
      .pipe( gulp.dest( config.languages.dest ) );
}

// Generates changelog.txt as a copy of changelog.md
function changelog() {
  return gulp
    .src( config.changelog.src )
    .pipe( rename( config.changelog.edit ) )
    .pipe( gulp.dest( config.changelog.dest ) );
}

// Generate readme.txt from readme.md
function build_readme(cb) {
  exec('php bin/wp-readme.php', function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      cb(err);
  });
}

// Injects changes into browser
function browserSyncTask() {
  if (config.browserSync.active) {
    browserSync.init({
      proxy: config.browserSync.localURL
    });
  }
}

// Reloads browsers that are using browsersync
function browserSyncReload(done) {
  browserSync.reload();
  done();
}

// Watch directories, and run specific tasks on file changes
function watch() {
  gulp.watch(config.styles.admin_src, adminstyles);
  gulp.watch(config.scripts.admin_src, adminscripts);
  
  // Reload browsersync when PHP files change, if active
  if (config.browserSync.active) {
    gulp.watch('./**/*.php', browserSyncReload);
  }
}

// define complex gulp tasks
const styles  = gulp.series(sasslint, adminstyles);
const scripts = gulp.series(adminscripts, uglifyscripts);
const build   = gulp.series(gulp.parallel(styles, scripts, images, translate, changelog, build_readme));

// export tasks
exports.styles    = styles;
exports.scripts   = scripts;
exports.images    = images;
exports.translate = translate;
exports.changelog = changelog;
exports.readme    = build_readme;
exports.watch     = watch;
exports.default   = build;
