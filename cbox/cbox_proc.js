// cbox プロセス管理.
//
//

module.exports = (function () {
  'use strict';

  var file = require("../lib/file");
  var _FILE_NAME = "./.cbox_process";

  var o = {};

  // CBOXの起動.
  o.startCbox = function(mainPid) {
    if(!mainPid) {
      mainPid = process.pid;
    }
    file.writeByString(_FILE_NAME, mainPid);
  }

  // CBOXの停止.
  o.exitCbox = function() {
    file.removeFile(_FILE_NAME);
  }

  // CBOXが起動中かチェック.
  o.isStartCbox = function() {
    return file.isFile(_FILE_NAME);
  }

  // CBOXの起動idを取得.
  o.getPID = function() {
    var ret = null;
    if(file.isFile(_FILE_NAME)) {
      try {
        ret =  parseInt(file.readByString(_FILE_NAME));
      } catch(e) {
        ret = null;
      }
    }
    return ret;
  }

  return o;
})();