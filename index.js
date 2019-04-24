#!/usr/bin/env node

/*!
 * cbox(content box(content-storage-server).
 * Copyright(c) 2019 maachang.
 * MIT Licensed
 */

(function() {
  'use strict';

  // 基本定義情報を取得..
  var constants = require('./cbox/constants');

  // コマンド引数処理.
  var argsCmd = require('./lib/subs/args');

  // サーバID生成情報を取得.
  var serverId = require("./lib/subs/serverId");

  // 数値情報.
  var nums = require("./lib/nums");

  // システム開始nanoTimeを取得.
  var systemNanoTime = nums.getNanoTime();

  // サーバID.
  var serverId = serverId.getId();

  // 起動パラメータをargsCmdにセット.
  var argv_params = argsCmd.getArgv();

  // 起動時のパラメータ情報を取得.
  var startParams = function(message, options) {
    var params = [message];
    var len = options.length;
    for(var i = 0;i < len;i ++) {
      params.push(options[i]);
    }
    var ret = null
    try {
      ret = argsCmd.get.apply(null, params);
      if (ret) {
        argsCmd.remove.apply(null, options);
      } else {
        ret = null;
      }
    } catch (e) {
      ret = null
    }
    return ret;
  }

  // 数字変換.
  var toNum = function(n) {
    if(n) {
      try { n = parseInt(n); } catch(e) { n = null; }
    } else {
      n = null;
    }
    return n;
  }

  // boolean変換.
  var toBool = function(n) {
    if(n) {
      try {
        if(n == "true" || n == "t" || n == "on") n = true;
        else if(n == "false" || n == "f" || n == "off") n = false;
      } catch(e) { n = null; }
    } else {
      n = null;
    }
    return n;
  }

  // 起動パラメータを取得.
  var port = toNum(startParams("サーバ-バインドポートを設定します", ["-p", "--port"]));
  var timeout = toNum(startParams("レスポンスタイムアウト値を設定します", ["-t", "--timeout"]));
  var env = startParams("実行環境名を設定します", ["-e", "--env"]);
  var notCache = toBool(startParams("レスポンスキャッシュを行わない場合[true]", ["-n", "--notCache"]));
  var closeFlag = toBool(startParams("keepAliveを行わない場合[true]", ["-c", "--close"]));
  var csize = toNum(startParams("クラスタ数を設定します", ["-l", "--cluster"]));
  if(csize == null) {
    csize = require('os').cpus().length;;
  }

  // コマンドが存在するかチェック.
  var cmd = null;
  if (argv_params.length > 2) {
    cmd = "" + argv_params[2];
  }

  // コマンド設定が行われている場合.
  if (cmd != null) {

    // ヘルプコマンド.
    if(cmd == "help") {
      constants.viewTitle(console.log, false);
      console.log("");
      console.log("   [help] ヘルプコマンドです.")
      console.log("   [serverId] サーバIDを更新します.")
      console.log("   [version] バージョン情報を表示します.")
      console.log("   [--version] バージョン情報だけを表示します.")
      console.log(argsCmd.getHelp());
      return;

    // サーバIDを再生成.
    } else if (cmd == "serverId") {
      // サーバIDを再生成して終了.
      serverId = serverId.createId();
      console.log("new id: " + serverId);
      return;
    
    // バージョン情報を出力.
    } else if (cmd == "version") {
      constants.viewTitle(console.log, false);
      return;
    } else if (cmd == "--version") {
      console.log(constants.VERSION);
      return;
    }
  }
  
  // argsCmdのヘルプ情報を破棄.
  argsCmd.destroy();

  // クラスタ起動.
  var cluster = require('cluster');
  if (cluster.isMaster) {
    
    // 起動時に表示する内容.
    constants.viewTitle(function(n){console.log(n);}, false);
    console.log(" id: " + serverId);
    console.log("");
    constants = null;
    
    // マスター起動.
    for (var i = 0; i < csize; ++i) {
      cluster.fork();
    }
    cluster.on('exit', function (worker, code, signal) {
      console.debug("## cluster exit to reStart.")
      cluster.fork();
    });
  } else {
    
    // ワーカー起動.
    require("./cbox/index").create(port, timeout, env, serverId, notCache, closeFlag, systemNanoTime)
  }
})();