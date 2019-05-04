// console msful.
//

module.exports.create = function(cmdName, port, timeout, env, serverId, notCache, closeFlag, systemNanoTime) {
  'use strict';
  try {
    var vm = require('vm');
    var file = require("../lib/file");
    var BASE_DIR = "./";

    // 利用標準モジュール.
    var _globalList = [
      "Buffer",
      //"__dirname",
      //"__filename",
      "clearImmediate",
      "clearInterval",
      "clearTimeout",
      "console",
      "exports",
      "module",
      "process",
      "setImmediate",
      "setInterval",
      "setTimeout"
    ];

    // システムパラメータを取得.
    var sysParams = require("./sysparams").create(
      port, timeout, env, serverId, notCache, closeFlag, systemNanoTime);

    // ファイルに対するフォルダ情報を取得.
    var getFolder = function(name) {
      var p = name.lastIndexOf("/");
      return name.substring(0, p);
    }

    // グローバルモジュールをセット.
    var setGlobalModules = function(out) {
      // グローバルセット.
      var len = _globalList.length;
      for(var i = 0; i < len; i ++) {
        out[_globalList[i]] = global[_globalList[i]];
      }

      // requireは直接セットが必要.
      out["require"] = require;

      // 標準セット.
      //out["global"] = global
      out["global"] = out;
    }
    
    // 指定ファイルを実行.
    var executeFile = function(cmdName) {
      try {
        if(!cmdName || cmdName == "") {
          console.log("指定コマンドが設定されていません");
          return false;
        }
        var fileName = cmdName;
        if(cmdName.lastIndexOf(".js") != cmdName.length -1) {
          fileName += ".js";
        }
        if(fileName.indexOf("/") == -1) {
          fileName = "/" + fileName;
        }

        // cbox実行先カレントディレクトリ.
        var cboxCurrentDir = getFolder(process.argv[1]);

        // cboxCurrentDir(現在cboxを実行しているフォルダ) にファイルが存在する場合.
        if(file.isFile(cboxCurrentDir + fileName)) {
          fileName = cboxCurrentDir + fileName;

        // 現在実行中のフォルダに コマンドが指定されている場合.
        } else if(file.isFile(BASE_DIR + fileName)) {
          fileName = BASE_DIR + fileName;

        // cboxCurrentDir(現在cboxを実行しているフォルダ) のcmd フォルダ配下に、ファイルが存在する場合.
        } else if(file.isFile(cboxCurrentDir + "/cmd" + fileName)) {
          fileName = cboxCurrentDir + "/cmd" + fileName;

        // 現在実行中のフォルダのcmd フォルダ配下に、コマンドが指定されている場合.
        } else if(file.isFile(BASE_DIR + "/cmd" + fileName)) {
          fileName = BASE_DIR + "/cmd" + fileName;
        }

        if(!file.isFile(fileName)) {
          console.log("指定コマンドは存在しません: " + cmdName);
          return false;
        }
        
        // 実行スクリプトを合成.
        var srcScript = "(function(){\n" +
          "'use strict';\n" +
          file.readByString(fileName) + "\n" +
          "})();";

        // コンテキスト内容セット.
        var memory = {};
        var context = vm.createContext(memory);

        // グローバルモジュールをセット.
        setGlobalModules(memory);

        // メモリにcboxで利用するライブラリをセット.
        memory.sysParams = Object.freeze(sysParams);
        memory.file = Object.freeze(file);
        memory.constants = Object.freeze(require("./constants"));
        memory.fcipher = Object.freeze(require("../lib/fcipher"));
        memory.fcomp = Object.freeze(require("../lib/fcomp"));
        memory.jwt = Object.freeze(require("../lib/jwt"));
        memory.nums = Object.freeze(require("../lib/nums"));
        memory.psync = Object.freeze(require("../lib/psync")(systemNanoTime));
        memory.uniqueId = Object.freeze(require("../lib/uniqueId"));

        // argsCmd.getParams を利用可能にする.
        var args = require("../lib/subs/args");
        memory.argsCmd = Object.freeze({"getParams": args.getParams});
        args = null;

        // cbox は readLock, writeLock を利用可能にする.
        var cbox = require("./cbox").create(notCache, closeFlag, systemNanoTime);
        memory.cbox = Object.freeze({"readLock": cbox.readLock, "writeLock": cbox.writeLock});
        cbox = null;

        // サーバID.
        memory.serverId = Object.freeze(serverId);

        // 実行環境名.
        memory.env = Object.freeze(env);
      
        // 実行処理. 
        var script = new vm.Script(srcScript);
        srcScript = null;
        script.runInContext(context);
        context = null;
        return true;
      } catch(e) {
        console.log(e, e);
        return false;
      }
    }

    // プロセス例外ハンドラ.
    process.on('uncaughtException', function(e) {
      console.trace(e, e);
      return false;
    });

    // promise例外ハンドラ.
    process.on('unhandledRejection', (reason) => {
      console.trace(reason, e);
      return false;
    });
    
    return executeFile(cmdName);

  }catch(e) {
    console.log(e, e);
    return false;
  }
}
