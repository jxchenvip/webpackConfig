var path = require('path');
var fs = require('fs');
var findRootDir = function () { // 猜测根目录
    var d = path.join(__dirname);
    var flag = true;
    while (flag) {
        var dir = fs.readdirSync(d).reduce(function (o, key) {
            o[key] = path.join(d, key);
            return o;
        }, {});
        if (dir['node_modules'] && dir['webpack.config.js'] && dir['package.json']) {
            flag = false;
        } else {
            d = path.join(d, '../');
        }
    }
    return d;
};
var rootdir = findRootDir();
if (!fs.existsSync(rootdir + 'webpack.config.js')) {
    console.log("\033[0;31m" + "[ERROR]" + "\033[0m" + '没有找到webpack.config.js文件')
    console.log("\033[0;36m" + "[ TIP ]" + "\033[0m" + '放置您的配置文件在' + rootdir + '下')
    return false;
}
var config = require(rootdir + 'webpack.config.js')
module.exports = config;