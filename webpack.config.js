// webpack 最基本的启动webpack命令
// webpack -w 提供watch方法，实时进行打包更新
// webpack -p 对打包后的文件进行压缩
// webpack -d 提供SourceMaps，方便调试
// webpack --colors 输出结果带彩色，比如：会用红色显示耗时较长的步骤
// webpack --profile 输出性能数据，可以看到每一步的耗时
// webpack --display- modules 默认情况下 node_modules 下的模块会被隐藏，加上这个参数可以显示这些被隐藏的模块
// webpack --config webpack.min.js
// webpack --display-error-details
// 前面的四个命令比较基础，使用频率会比较大，后面的命令主要是用来定位打包时间较长的原因，方便改进配置文件，提高打包效率。
var webpack = require('webpack');
var path = require('path');
var fs = require('fs');
var autoprefixer = require('autoprefixer-loader');
var ncp = require("copy-paste"); // 复制，粘贴
var childProcess = require('child_process');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var HtmlWebpackPlugin = require('html-webpack-plugin');
var pkg = require('./package.json');
var cwd = process.cwd();
// 处理参数
var argvs = process.argv.reduce(function(o, key, index, arr) {
    if (key.charAt(0) == '-') {
        o[key.substr(1)] = key;
    }
    return o;
}, {});


/** 部署到哪个环境 默认为branches S*/
// tags: 源文件
// branches: 测试线文件
// trunk: 正式线文件
// 执行列表
// webpack -d -w 默认压缩到branches
// webpack -boss 压缩全部
// webpack -trunk压缩到trunk 不可能-move-to同时使用
// webpack -move-path 压缩到指定文件路径不可与trunk同时使用
var sls = {
    deep: argvs.boss, // 是否压缩文件夹下所有文件（包含文件夹内的文件夹）
    entry: {}, // 入口文件处理
    root:  path.join(__dirname),
    output: path.join(process.cwd(), 'dist') // 输出路径branches
};

(function() {
    // 定义输出路径
    // -move-path:E:\xxx\xxx\xxx
    var TRUNK = 'trunk'; // 输出到trunk
    var DEFINE_OUTPUT = /^move-path:/;
    Object.keys(argvs).forEach(function(item) {
        if (TRUNK == item) {
            sls.output = cwd.replace('tags', TRUNK);
        } else if (DEFINE_OUTPUT.test(item)) { // 自己定义输出路径
            sls.output = path.join(item.replace(DEFINE_OUTPUT, ''));
        }
    })
})();


(function() {
    // 打开压缩到的目录
    var interval = setInterval(function() {
        if (fs.existsSync(sls.output)) {
            ncp.copy(sls.output); // 复制输出路径
            open_dir(sls.output);
            clearInterval(interval);
            interval = null;
        }
    }, 100);

    // 打开目录
    function open_dir(d) {
        var cmd = '';
        if (process.platform === 'darwin') {
            cmd = 'open';
        } else if (process.platform === 'win32') {
            cmd = 'start';
        }
        childProcess.execSync(cmd + ' ' + d);
    }
})();

// 入口处理
(function() {
    var files = {};
    var cwd = path.join(process.cwd(), 'src' + path.sep + 'js');

    function readdir(p, deep = false) {
        fs.readdirSync(p).forEach(function(sPath) {
            var fileName = path.join(p, sPath);
            if (fs.lstatSync(fileName).isDirectory() && sPath != '') {
                if (deep) readdir(fileName, deep);
            } else {
                if (!/(^(_|grunt|gulp|webpack)|\.map$)/.test(sPath) && /\.js$/.test(sPath)) {
                    // if (!/(^(_|grunt|gulp|webpack)|\.map$)/.test(sPath)) {
                    var name = path.relative(cwd, fileName);
                    files[name.replace(/\.js$/, '')] = fileName;
                }
            }
        })
    };
    readdir(cwd, false);
    sls.entry = files;
})();


module.exports = {
    //支持数组形式，将加载数组中的所有模块，但以最后一个模块作为输出
    entry: sls.entry,
    output: {
        path: sls.output, // tags: 源码环境 branches: 测试环境 trunk: 正式环境
        filename: "js/[name].js",
        libraryTarget: "umd"
    },
    module: {
        //加载器配置
        loaders: [{
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                query: { presets: ['es2015'] }
            },
            { test: /\.jade$/, loader: 'jade?pretty=true' },
            // { test: /\.html$/, loader: "html" },
            //.css 文件使用 style-loader 和 css-loader 来处理
            { test: /\.styl$/, loader: ExtractTextPlugin.extract(["css", "autoprefixer-loader?browsers=last 9 version", "stylus"]) },
            { test: /\.css$/, loader: ExtractTextPlugin.extract("style-loader", "css-loader") },
            //.scss 文件使用 style-loader、css-loader 和 sass-loader 来编译处理
            { test: /\.scss$/, loader: 'style!css!sass?sourceMap' },
            //图片文件使用 url-loader 来处理，小于8kb的直接转为base64
            { test: /\.(png|jpg)$/, loader: 'url-loader?limit=8192&name=images/[name].[ext]' }
        ]
    },
    // stylusOther: {
    //     use: [autoprefixer]
    // },
    externals: {
        // jquery: 'jQuery',
        zepto: '$',
    },
    resolve: {
        //查找module的话从这里开始查找
        root: sls.root,
        //自动扩展文件后缀名，意味着我们require模块可以省略不写后缀名
        extensions: ['', '.js', '.json', '.scss', '.styl', '.jade'],
        //模块别名定义，方便后续直接引用别名，无须多写长长的地址
        alias: {}
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
            },
            output: {
                comments: false,
            },
        }),
        new ExtractTextPlugin("css/style.css")
    ]
}

// 打包jade页面
Object.keys(module.exports.entry).forEach(function(page) {
    if (page !== 'vendors') {
        module.exports.plugins.push(new HtmlWebpackPlugin({
            // title: 用来生成页面的 title 元素
            // filename: 输出的 HTML 文件名，默认是 index.html, 也可以直接配置带有子目录。
            // template: 模板文件路径，支持加载器，比如 html!./index.html
            // inject: true | 'head' | 'body' | false  ,注入所有的资源到特定的 template 或者 templateContent 中，如果设置为 true 或者 body，所有的 javascript 资源将被放置到 body 元素的底部，'head' 将放置到 head 元素中。
            // favicon: 添加特定的 favicon 路径到输出的 HTML 文件中。
            // minify: {} | false , 传递 html-minifier 选项给 minify 输出
            // hash: true | false, 如果为 true, 将添加一个唯一的 webpack 编译 hash 到所有包含的脚本和 CSS 文件，对于解除 cache 很有用。
            // cache: true | false，如果为 true, 这是默认值，仅仅在文件修改之后才会发布文件。
            // showErrors: true | false, 如果为 true, 这是默认值，错误信息会写入到 HTML 页面中
            // chunks: 允许只添加某些块 (比如，仅仅 unit test 块)
            // chunksSortMode: 允许控制块在添加到页面之前的排序方式，支持的值：'none' | 'default' | {function}-default:'auto'
            // excludeChunks: 允许跳过某些块，(比如，跳过单元测试的块) 
            inject: 'body',
            title: page,
            filename: page + '.html',
            minify: false,
            template: path.join(process.cwd(), 'src') + path.sep + page + '.jade',
            chunks: [page]
        }));
    }
})
