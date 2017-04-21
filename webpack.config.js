const fs = require('fs');
const ncp = require("copy-paste"); // 复制，粘贴
const path = require('path');
const argv = require('yargs').argv; // 传入参数
const webpack = require('webpack');
const childProcess = require('child_process');

// postcss-sprite modules
const postcss = require('postcss');
const updateRule = require('postcss-sprites/lib/core').updateRule;
const postcssSprites = require('postcss-sprites');
const autoprefixer = require('autoprefixer');
const spritesmith = require('spritesmith');
const cssnano = require('cssnano');
const precss = require('precss');

// const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const FastUglifyJsPlugin = require('fast-uglifyjs-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin'); // 提取css
const UglifyJSPlugin = require('uglifyjs-webpack-plugin'); // 压缩js


const readFileName = ',';
const cwd = process.cwd();

let webpackOptions = {
    context: path.resolve(cwd),
    entry: {},
    output: {
        filename: '[name].js',
        path: '',
        libraryTarget: "umd"
    },
    node: {
        Buffer: false
    },
    module: {
        rules: [{
            test: /\.pug$/,
            use: [{
                loader: 'pug-loader?pretty=true'
            }]
        }, {
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            use: [{
                loader: 'babel-loader?presets[]=es2015'
            }]
        }, {
            test: /\.less$/,
            use: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: ['css-loader', 'postcss-loader', 'less-loader']
            })
        }, {
            test: /\.styl$/,
            use: ExtractTextPlugin.extract({
                fallback: 'style-loader',
                use: ['css-loader', 'postcss-loader', 'stylus-loader']
            })
        }, {
            test: /\.css$/,
            use: ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: ['css-loader?importLoaders=1', 'postcss-loader']
            })
        }, {
            test: /\.(jpg|png|gif)$/,
            use: ['file-loader?name=[path][name].[ext]&publicPath=../&outputPath=./', {
                loader: 'image-webpack-loader',
                options: {
                    query: {
                        progressive: true,
                        optimizationLevel: 7,
                        interlaced: false,
                        pngquant: {
                            quality: '65-90',
                            speed: 4
                        }
                    }
                }
            }]
        }, {
            test: /\.(woff|woff2|eot|ttf|svg)$/,
            use: [{
                loader: 'url-loader?name=[path][name].[ext]&publicPath=../&outputPath=./',
                options: {
                    limit: 100000
                }
            }]
        }]
    },
    resolve: {
        modules: [
            "node_modules"
        ],
        extensions: [".js", ".json", ".css", ".jade", "pug", "styl", ".less"]
    },
    plugins: [
        new webpack.LoaderOptionsPlugin({
            minimize: true,
            options: {
                context: cwd,
                postcss: function(css) {
                    return [
                        precss,
                        postcssSprites({
                            retina: true, //支持retina，可以实现合并不同比例图片
                            verbose: true,
                            spritesmith: {
                                padding: 10
                            },
                            spritePath: 'img/', //雪碧图合并后存放地址
                            stylesheetPath: 'css/',
                            basePath: getOutPutPath(),
                            hooks: {
                                onUpdateRule: function(rule, token, image) {
                                    var backgroundSizeX = (image.spriteWidth / image.coords.width) * 100;
                                    var backgroundSizeY = (image.spriteHeight / image.coords.height) * 100;
                                    var backgroundPositionX = (image.coords.x / (image.spriteWidth - image.coords.width)) * 100;
                                    var backgroundPositionY = (image.coords.y / (image.spriteHeight - image.coords.height)) * 100;

                                    backgroundSizeX = isNaN(backgroundSizeX) ? 0 : backgroundSizeX;
                                    backgroundSizeY = isNaN(backgroundSizeY) ? 0 : backgroundSizeY;
                                    backgroundPositionX = isNaN(backgroundPositionX) ? 0 : backgroundPositionX;
                                    backgroundPositionY = isNaN(backgroundPositionY) ? 0 : backgroundPositionY;

                                    var backgroundImage = postcss.decl({
                                        prop: 'background-image',
                                        value: 'url(' + image.spriteUrl + ')'
                                    });

                                    var backgroundSize = postcss.decl({
                                        prop: 'background-size',
                                        value: backgroundSizeX + '% ' + backgroundSizeY + '%'
                                    });

                                    var backgroundPosition = postcss.decl({
                                        prop: 'background-position',
                                        value: backgroundPositionX + '% ' + backgroundPositionY + '%'
                                    });

                                    rule.insertAfter(token, backgroundImage);
                                    rule.insertAfter(backgroundImage, backgroundPosition);
                                    rule.insertAfter(backgroundPosition, backgroundSize);
                                }
                            },
                            groupBy: function(image) {
                                var dirname = path.dirname(image.originalUrl),
                                    outputname = dirname.split('/').slice(2).join('.') || '__';
                                return Promise.resolve(outputname);
                            },
                            filterBy: function(image) {
                                var basename = path.basename(image.url);
                                if (/^_/.test(basename) || !/\.png$/.test(image.url))
                                    return Promise.reject();
                                return Promise.resolve();
                            }
                        }),
                        autoprefixer({
                            browsers: ['ie>=8', '>1% in CN']
                        }),
                        cssnano({
                            zindex: false
                        })
                    ];
                }
            }
        }),
        // new FriendlyErrorsWebpackPlugin(),
        new UglifyJSPlugin({
            sourceMap: true,
            compress: {
                warnings: true
            }
        }),
        new ExtractTextPlugin({
            filename: (getPath) => {
                return getPath('css/[name].css').replace('css/js', 'css');
            },
            // filename: "css/bundle.css",
            disable: false, // 禁用插件
            allChunks: true // 向所有额外的 chunk 提取（默认只提取初始加载模块）,
        })
    ]
}

/**********************************************************
如果执行为最外层webpack.config.js退出进程
***********************************************************/
{
    if (cwd === __dirname) {
        process.exit();
    }
}

/**********************************************************
部署到哪个环境 默认为branches
tags: 源文件
branches: 测试线文件
trunk: 正式线文件
执行列表
webpack -d -w 默认压缩到branches
webpack -boss 压缩全部
webpack -trunk压缩到trunk 不可能-move-to同时使用
webpack -move-path 压缩到指定文件路径不可与trunk同时使用
***********************************************************/

{
    const TAGS = 'src'; // dev环境
    const BRANCHES = 'dist'; // bch环境
    const TRUNK = 'trunk'; // 输出到trunk
    const DEFINE_OUTPUT = /^move-path:/;
    let output = cwd.replace(TAGS, BRANCHES); // 输出路径branches
    var SOURCEMAP = 'source-map';
    var sp = SOURCEMAP;

    webpackOptions.devtool = sp;
    webpackOptions.output.path = output // 设置输出路径


    if (fs.existsSync(path.join(cwd, readFileName))) {
        var json = JSON.parse(fs.readFileSync(path.join(cwd, readFileName), 'utf-8') || {});

        if (json.name && json.value) {
            var o = {
                'BRANCHES': output,
                'TRUNK': cwd.replace(TAGS, TRUNK),
                '$': path.join(json.value),
                '$$': path.join(json.value)
            };
            // 如果是绝对路径
            if (path.isAbsolute(o[json.name])) {
                webpackOptions.output.path = o[json.name]
            }
            if (json.name == '$$' || json.name == 'TRUNK') {
                delete webpackOptions.devtool;
            }
        }
    }

}

/**********************************************************
查找入口文件
***********************************************************/
{
    // 工具函数
    const findfiles = function(ipath, deep = false, json = {}) {
        fs.readdirSync(ipath).forEach(function(sPath) {
            if (/^(_|webpack|grunt|gulp|package)/.test(sPath)) return;
            var fileName = path.join(ipath, sPath);
            if (fs.lstatSync(fileName).isDirectory() && sPath != '') {
                if (deep && sPath !== 'node_modules') findfiles(fileName, deep, json);
            } else {
                var name = path.relative(cwd, fileName).replace(/\.\w+$/, ''),
                    key = path.extname(fileName).replace(/^\./, '');

                json[key] = json[key] || {};
                json[key][name] = fileName;
            }
        })
        return json;
    };
    const files = findfiles(cwd, true);
    files.type = function(str) {
        if (Object.prototype.toString.call(str) !== '[object String]') return false;
        return this[str] || {};
    }

    webpackOptions.entry = files.type('js'); // 配制js入口

    // 设置jade模板
    Object.keys(files.type('pug')).forEach(function(page) {
        if (page !== 'vendors') {
            webpackOptions.plugins.unshift(new HtmlWebpackPlugin({
                title: page,
                inject: false,
                filename: page + '.html',
                template: path.join(cwd, page + '.pug')
            }));
        }
    })
}



/**********************************************************
打开文件压缩目录并复制路径
***********************************************************/
{
    const TIME = 500;
    const openDir = function(d) { // 打开目录
        var cmd = '';
        if (process.platform === 'darwin') {
            cmd = 'open';
        } else if (process.platform === 'win32') {
            cmd = 'start';
        }
        childProcess.execSync(cmd + ' ' + d);
    };
    let interval = setInterval(function() {
        const output = getOutPutPath();
        if (fs.existsSync(output)) {
            ncp.copy(output); // 复制输出路径
            openDir(output);
            clearInterval(interval);
            interval = null;
        }
    }, TIME);
}


module.exports = webpackOptions;
// 获取输出路径
function getOutPutPath() {
    return module.exports.output.path;
}

// 删除自动生成的配置文件
{
    function unlink(filename) {
        if (fs.existsSync(filename)) fs.unlink(filename);
    }
    unlink(path.join(cwd, readFileName));
    unlink(path.join(cwd, 'webpack.config.js'));
}