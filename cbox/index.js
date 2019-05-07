// cbox実行.js
//
//

module.exports.create = function(port, timeout, env, serverId, notCache, closeFlag, systemNanoTime) {
  'use strict';

  var http = require('http');
  var sysParams = require("./sysparams").create(
    port, timeout, env, serverId, notCache, closeFlag, systemNanoTime);

  // httpサーバ生成.
  var createHttp = function () {
    return http.createServer(function (req, res) {
      // cboxを実行.
      cbox.execute(req, res);
    })
  }

  // プロセス例外ハンドラ.
  process.on('uncaughtException', function(e) {
    console.trace(e, e);
  });

  // promise例外ハンドラ.
  process.on('unhandledRejection', function(reason) {
    console.trace(reason, reason);
  });

  // cbox処理を生成.
  var cbox = require("./cbox").create(
    sysParams.isNotCache(), sysParams.isCloseFlag(), sysParams.getServerId(), sysParams.getSystemNanoTime());

  // cboxに対して現在の実行環境コンフィグをセット.
  cbox.setEnvConf(sysParams.getEnvConf())

  // サーバー生成.
  var server = createHttp();
  
  // タイムアウトセット.
  server.setTimeout(sysParams.getTimeout());

  // 指定ポートで待つ.
  server.listen(sysParams.getPort());

  // 起動結果をログ出力.
  console.info("## (" + sysParams.getPort() +
    ") " + sysParams.getEnvironment() +
    " timeout:" + (sysParams.getTimeout() / 1000) + "s" +
    " noCache:" + sysParams.isNotCache() +
    " close:" + sysParams.isCloseFlag() +
    " pid:" + process.pid);
  
  server = null;
};