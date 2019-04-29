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

  // 起動パラメータを取得.
  var port = argsCmd.registrationParams("number", "サーバ-バインドポートを設定します", ["-p", "--port"]);
  var timeout = argsCmd.registrationParams("number", "レスポンスタイムアウト値を設定します", ["-t", "--timeout"]);
  var env = argsCmd.registrationParams("string", "実行環境名を設定します", ["-e", "--env"]);
  var notCache = argsCmd.registrationParams("boolean", "レスポンスキャッシュを行わない場合[true]", ["-n", "--notCache"]);
  var closeFlag = argsCmd.registrationParams("boolean", "keepAliveを行わない場合[true]", ["-c", "--close"]);
  var csize = argsCmd.registrationParams("number", "クラスタ数を設定します", ["-l", "--cluster"]);
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
      console.log("   [cmd] [コマンド名.jsファイル] コマンド名を実行します.")
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
    
    // バージョン番号のみを表示.
    } else if (cmd == "--version") {
      console.log(constants.VERSION);
      return;
    }
  }
  
  // argsCmdのヘルプ情報を破棄.
  argsCmd.destroy();

  // コマンド実行起動ができるかチェック.
  if (cmd != null) {
    if(cmd == "cmd") {
      // cmd終了時に安全に終了結果を送る.
      var exitCode = 0;
      process.on('exit', function() {
        process.exit(exitCode);
      });
      
      if (argv_params.length > 3) {
        var cmdName = "" + argv_params[3];
        var res = require("./cbox/cmd").create(cmdName, port, timeout, env, serverId, notCache, closeFlag, systemNanoTime)
        if(!res) {
          exitCode = 1;
        }
      } else {
        console.log("指定コマンドが設定されていません");
        exitCode = 1;
      }
      return;
    }
  }

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