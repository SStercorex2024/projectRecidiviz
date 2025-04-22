const {src, dest, watch, series, parallel} = require('gulp');

const scss = require('gulp-sass')(require('sass'));
const concat = require('gulp-concat');
const uglify = require('gulp-uglify-es');
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const browserSync = require('browser-sync').create();
const fileInclude = require('gulp-file-include');
const del = require('del');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
const image = require('gulp-image');
const webp = require('gulp-webp');
const webpHtml = require('gulp-webp-html');
const webpCss = require('gulp-webp-css');
const data = require('gulp-data');
const newer = require('gulp-newer');
const changed = require('gulp-changed');
const sassGlob = require('gulp-sass-glob');
const svgSpriteModule = require('gulp-svg-sprite');

// Пути
const themeName = 'project'; // Название темы

const paths = {
    html: {
        src: 'src/html/index.html',  // Исходник HTML
        watch: 'src/html/**/*.html', // Для наблюдения за HTML
        json: 'src/html/data/maps.json', // Данные
        dest: `wp-content/themes/${themeName}/` // Путь для HTML в тему WordPress
    },
    styles: {
        src: 'src/scss/style.scss', // Исходник SCSS
        dest: `wp-content/themes/${themeName}/assets/css` // Путь для стилей в тему WordPress
    },
    scripts: {
        src: 'src/js/main.js', // Исходник JS
        dest: `wp-content/themes/${themeName}/assets/js` // Путь для скриптов в тему WordPress
    },
    images: {
        src: 'src/images/**/*', // Все изображения
        dest: `wp-content/themes/${themeName}/assets/images`, // Путь для изображений в тему
        webpDest: `wp-content/themes/${themeName}/assets/images/webp` // Для WebP изображений
    },
    fonts: {
        src: 'src/fonts/**/*', // Папка с шрифтами
        dest: `wp-content/themes/${themeName}/assets/fonts` // Путь для шрифтов в тему
    },
    files: {
        src: 'src/files/**/*', // Все остальные файлы
        dest: `wp-content/themes/${themeName}/assets/files` // Для других файлов в тему
    }
};

// Обработка ошибок
const plumberNotify = (title) => plumber({
    errorHandler: notify.onError({
        title,
        message: "<%= error.message %>",
        sound: false
    })
});

// SCSS → CSS
function styles() {
    return src(paths.styles.src)
        .pipe(plumberNotify("SCSS Error"))
        .pipe(sassGlob())
        .pipe(scss())
        .pipe(webpCss())
        .pipe(autoprefixer())
        .pipe(concat('style.min.css'))
        .pipe(cleanCSS({level: 2}))
        .pipe(dest(paths.styles.dest))
        .pipe(browserSync.stream());
}

// JS
function scripts() {
    return src(paths.scripts.src)
        .pipe(plumberNotify("JS Error"))
        .pipe(concat('main.min.js'))
        .pipe(uglify())
        .pipe(dest(paths.scripts.dest))
        .pipe(browserSync.stream());
}

// HTML
function html() {
    return src(paths.html.src)
        .pipe(fileInclude({
            prefix: '@@',
            basepath: '@file'
        }))
        .pipe(data(() => require(`./${paths.html.json}`))) // Пример для использования JSON данных
        .pipe(webpHtml()) // Для вставки WebP изображений в HTML
        .pipe(dest(`wp-content/themes/${themeName}/`)) // Генерация HTML в тему
        .pipe(browserSync.stream());
}

// Оптимизация изображений (только новые)
function optimizeImages() {
    return src(paths.images.src)
        .pipe(newer(paths.images.dest))  // Это для новых изображений
        .pipe(image())
        .pipe(dest(paths.images.dest)); // Путь для WP
}

// WebP (только новые)
function webpConversion() {
    return src(paths.images.src)
        .pipe(newer({
            dest: paths.images.webpDest,
            ext: '.webp'
        }))  // Только новые изображения для конвертации в WebP
        .pipe(webp())
        .pipe(dest(paths.images.webpDest)); // Путь для WP
}

function generateSvgSprite() {
    return src('src/images/icons/*.svg')
        .pipe(svgSpriteModule({
            mode: {
                symbol: {
                    sprite: 'sprite.svg', // название спрайта
                    example: false
                }
            },
            shape: {
                transform: [
                    {
                        svgo: {
                            plugins: [
                                {removeAttrs: {attrs: '(fill|stroke|style)'}}
                            ]
                        }
                    }
                ]
            }
        }))
        .pipe(dest(`wp-content/themes/${themeName}/assets/images/icons`)); // Путь для WP
}

function processJsonData() {
    return src('src/data/**/*.json')
        .pipe(changed('dist/data', {hasChanged: changed.compareContents}))  // Проверка изменения содержимого
        .pipe(dest('dist/data'));
}

// Копирование
const copy = {
    images: () => src(paths.images.src).pipe(dest(paths.images.dest)),
    fonts: () => src(paths.fonts.src).pipe(dest(paths.fonts.dest)),
    files: () => src(paths.files.src).pipe(dest(paths.files.dest))
};

// Очистка
function cleanDist() {
    return del(['dist']);
}

// Watch + Server
function watching() {
    browserSync.init({
        server: {baseDir: 'dist'}
    });
    watch('src/scss/**/*.scss', styles);
    watch(paths.html.watch, html);
    watch('src/images/icons/*.svg', generateSvgSprite);
    watch('dist/*.html').on('change', browserSync.reload);
    watch(paths.images.src, series(optimizeImages, webpConversion)); // Слежка за изображениями
    watch('src/data/**/*.json', processJsonData); // Пример слежки за другими файлами (JSON)
}

// Сборка
const build = series(
    cleanDist,
    parallel(styles, scripts, html, optimizeImages, webpConversion, generateSvgSprite, processJsonData, copy.fonts, copy.files)
);

// CLI
exports.styles = styles;
exports.scripts = scripts;
exports.html = html;
exports.optimizeImages = optimizeImages;
exports.webpConversion = webpConversion;
exports.processJsonData = processJsonData;
exports.cleanDist = cleanDist;
exports.images = copy.images;
exports.fonts = copy.fonts;
exports.files = copy.files;
exports.build = build;

exports.default = series(
    parallel(styles, scripts, html),
    watching
);
