// cbox プロセス管理.
//
//

module.exports = (function () {
  'use strict';

  var file = require("../lib/file");
  var _DIR_NAME = "./.cbox_process";
  var o = {};

  // CBOXの起動.
  o.startCbox = function() {
    file.mkdir(_DIR_NAME);
  }

  // CBOXの停止.
  o.exitCbox = function() {
    file.removeDir(_DIR_NAME);
  }

  // CBOXが起動中かチェック.
  o.isStartCbox = function() {
    return file.isDir(_DIR_NAME);
  }

  return o;
})();