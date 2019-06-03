#!/usr/bin/env node

/*!
 * cbox(content box(content-storage-server).
 * Copyright(c) 2019 maachang.
 * MIT Licensed
 */

(function(_g) {
  'use strict';

  // クラスタ.
  var cluster = require('cluster');

  // 基本定義情報を取得.
  var constants = require('./cbox/constants');

  // プロセスタイトルをセット.
  process.title = "node-" + constants.NAME;

  // コマンド引数処理.
  var argsCmd = require('./lib/subs/args');

  // サーバID生成情報を取得.
  var serverId = require("./lib/subs/serverId");

  // 数値情報.
  var nums = require("./lib/nums");

  // ファイル.
  var file = require("./lib/file");

  // コンフィグ.
  var conf = null;

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
    csize = require('os').cpus().length;
  }
  csize += 1;

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

  // systemNanoTimeを保持するファイル名.
  var _SYSTEM_NANO_TIME_FILE = "./.systemNanoTime";

  // systemNanoTimeを生成.
  var _createSystemNanoTime = function() {
    var nano = nums.getNanoTime();
    file.writeByString(_SYSTEM_NANO_TIME_FILE, ""+ nano);
    return nano;
  }

  // systemNanoTimeを取得.
  var _getSystemNanoTime = function() {
    return parseInt(file.readByString(_SYSTEM_NANO_TIME_FILE));
  }

  // コマンド実行フラグを取得.
  var cmdFlag = (cmd != null && cmd == "cmd");

  // クラスタがマスターでない、コンソール起動の場合.
  if(!cluster.isMaster || cmdFlag) {
    // 実行環境名を取得.
    var targetEnv = env;
    if(!targetEnv) {
      targetEnv = process.env[constants.ENV_ENV];
      if(!targetEnv) {
        // 何も設定されていない場合のデフォルト値.
        targetEnv = constants.DEFAULT_ENV;
      }
    }

    // コンフィグ情報.
    conf = require("./cbox/conf")(constants.CONF_DIR);

    // 実行環境用のコンフィグが存在する場合は、そちらを取得.
    var envConf = (!conf.getConfig()[targetEnv]) ?
      conf.getConfig() : conf.getConfig()[targetEnv];

    // 基本ログの初期化.
    var baseLogger = require("./lib/base_logger");

    // 基本ログ定義.
    var logs = null;
    if(envConf[constants.LOGGER_CONF]) {
      
      // conf情報が存在する場合.
      logs = baseLogger.load(envConf[constants.LOGGER_CONF]);
    } else {

      // デフォルト設定.
      baseLogger.setting("info", null, constants.LOG_DIR);
      logs = [baseLogger.create("system")];
    }

    // 出力先のログフォルダ作成.
    if(!file.isDir(baseLogger.logDir())) {
      file.mkdirs(baseLogger.logDir());
    }

    // ロガー定義.
    var logger = require("./cbox/logger");
    var len = logs.length;
    for(var i = 0; i < len; i ++) {
      logger.setup(logs[i].name(), logs[i]);
    }
    _g.logger = logger;
  }

  // コマンド実行起動ができるかチェック.
  if (cmdFlag) {
    // cmd終了時に安全に終了結果を送る.
    var exitCode = 0;
    process.on('exit', function() {
      process.exit(exitCode);
    });

    if (argv_params.length > 3) {

      // サーバの最後に起動した起動時間を取得.
      var nanoTime = file.isFile(_SYSTEM_NANO_TIME_FILE) ?
        _getSystemNanoTime() : nums.getNanoTime();

      // コマンド実行.
      var cmdName = "" + argv_params[3];
      var res = require("./cbox/cmd").create(cmdName, conf, port, timeout, env, serverId, notCache, closeFlag, nanoTime)
      if(!res) {
        exitCode = 1;
      }
    } else {
      console.log("指定コマンドが設定されていません");
      exitCode = 1;
    }
    return;
  }

  // クラスタ起動.
  if (cluster.isMaster) {

    // cbox プロセス管理.
    var cboxProc = require("./cbox/cbox_proc");

    // システム起動時のnanoTimeは、１度生成して、ファイル経由でcluster共有.
    var nanoTime = _createSystemNanoTime();

    // psync初期化.
    require("./lib/psync")(nanoTime).init();
    
    // 起動時に表示する内容.
    constants.viewTitle(function(n){console.log(n);}, false);
    console.log(" id: " + serverId);
    console.log("");
    constants = null;
    
    // マスター起動.
    for (var i = 0; i < csize; ++i) {
      cluster.fork({clusterNo: i});
    }

    // プロセスが落ちた時の処理.
    var _exitNode = function() {
      process.exit();
    };

    // node処理終了.
    process.on('exit', function() {
      // cbox停止.
      cboxProc.exitCbox();
    });

    // 割り込み系と、killコマンド終了.
    process.on('SIGINT', _exitNode);
    process.on('SIGBREAK', _exitNode);
    process.on('SIGTERM', _exitNode);

    // ワーカーが落ちた場合は再起動させる.
    cluster.on('exit', function (worker, code, signal) {
      console.debug("## cluster exit to reStart.")
      cluster.fork();
    });

    // cbox起動.
    cboxProc.startCbox();
  } else {
    
    // 最後のクラスタでは、cbox-expireを起動する.
    if((process.env.clusterNo|0) + 1 == csize) {
      // cbox-expire起動.
      require("./cbox/cbox_expire").create(port, timeout, env, serverId, notCache, closeFlag, _getSystemNanoTime())
    } else {
      // ワーカー起動.
      require("./cbox/index").create(conf, port, timeout, env, serverId, notCache, closeFlag, _getSystemNanoTime())
    }
  }
})(global);