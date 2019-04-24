// cbox処理.js
//
//

module.exports.create = function(notCache, closeFlag, systemNanoTime) {
  'use strict';
  var o = {};

  var fs = require("fs");
  var file = require("../lib/file");
  var http = require("./http");
  var psync = require("../lib/psync")(systemNanoTime);
  var uniqueId = require("../lib/uniqueId");

  // コンフィグ(実行環境用)
  var envConf = null;

  // テンポラリファイルのunique数.
  var _TMP_UNIQUE_LENGTH = 32;

  // ロックタイムアウト(5秒).
  var _LOCK_TIMEOUT = 5000;

  // テンポラリファイルの拡張子.
  var _TMP_EXTENSION = ".tmp";

  // cboxデータ格納フォルダ名.
  var _CBOX_FOLDER = "./cbox";

  // favicon.ico.
  var _FAVICON_ICO = "/favicon.ico";

  // cbox 書き込み許可シグニチャ.
  var _WRITE_SIGNATURES = "x-cbox-write-signatures"

  // cboxフォルダが存在しない場合は作成する.
  if(!file.isDir(_CBOX_FOLDER)) {
    file.mkdir(_CBOX_FOLDER);
  }

  // ファイルに対するフォルダ情報を取得.
  var _getFolder = function(name) {
    var p = name.lastIndexOf("/");
    return name.substring(0, p+1);
  }

  // 正しいURLを取得.
  var _getUrl = function (req) {
    var u = req.url;
    var p = u.indexOf("?");
    if (p == -1) {
      return u;
    }
    return u.substring(0, p);
  }

  // 元のファイルを一時ファイルにリネーム.
  var _moveByTmp = function(name) {
    var ret = null;
    while(true) {

      // テンポラリファイル名を生成.
      ret = name + "." + uniqueId.getId(_TMP_UNIQUE_LENGTH) + _TMP_EXTENSION;

      // ファイル名が存在する場合やり直し.
      if(file.isFile(ret)) {
        ret = null;
        continue;
      }

      // 空のファイルを作成する.
      file.rename(name, ret);
      break;
    }
    return ret;
  }

  // トップフォルダ名を取得.
  var _topFolderName = function(name) {
    return name.substring(1, name.indexOf("/", 1));
  }

  // ロックタイムアウトエラー.
  var _errorLockTimeout = function(url, res, notCache, closeFlag) {
    http.errorFileResult(500,
      {message: "ロックタイムアウト:" + url},
      res,
      closeFlag);
  }

  // CBOX: 処理区分.
  var _CBOX_EXECUTE_TYPE = "x-cbox-execute-type";

  // CBOX: 処理区分: フォルダ作成.
  var _CBOX_EXECUTE_TYPE_CREATE_FOLDER = "create-folder";

  // CBOX: 処理区分: フォルダ削除.
  var _CBOX_EXECUTE_TYPE_REMOVE_FOLDER = "remove-folder";

  // CBOX: 処理区分: ファイル作成・上書き.
  var _CBOX_EXECUTE_TYPE_CREATE_FILE= "create-file";

  // CBOX: 処理区分: ファイル取得.
  var _CBOX_EXECUTE_TYPE_GET_FILE= "get-file";

  // CBOX: 処理区分: ファイル削除.
  var _CBOX_EXECUTE_TYPE_REMOVE_FILE= "remove-file";

  // CBOX: 処理区分: リスト一覧.
  var _CBOX_EXECUTE_TYPE_LIST= "list";

  // CBOX: 処理区分: ファイル存在.
  var _CBOX_EXECUTE_TYPE_IS_FILE= "is-file";

  // CBOX: 処理区分: フォルダ存在.
  var _CBOX_EXECUTE_TYPE_IS_FOLDER= "is-folder";

  // 環境コンフィグ情報をセット.
  o.setEnvConf = function(c) {
    envConf = c;
  }

  // 環境コンフィグ情報を取得.
  o.getEnvcConf = function() {
    return envConf;
  }

  // cbox処理.
  o.executeCbox = function(req, res) {
    try {
      var executeType = req.headers[_CBOX_EXECUTE_TYPE];
      var method = req.method.toLowerCase();
      var url = _getUrl(req);
      var name = _CBOX_FOLDER + url;

      // methodで処理を分ける.
      if(method == "post") {

        // ファイル作成・更新処理.
        if(executeType == _CBOX_EXECUTE_TYPE_CREATE_FILE) {
          return this.createFile(name, url, req, res);
        }
        
        // リクエストを閉じる.
        try {req.end();} catch(e) {}
        try {req.close();} catch(e) {}

        // エラー返却.
        http.errorFileResult(500,
          {message: "処理タイプ[" + executeType + "]に対してmethodが POST で処理できません:" + url},
          res,
          closeFlag);
        return false;

      } else if(method == "get") {

        // 各処理.
        switch(executeType) {
          case _CBOX_EXECUTE_TYPE_CREATE_FOLDER:
            return this.createFolder(name, url, req, res);
          case _CBOX_EXECUTE_TYPE_REMOVE_FOLDER:
            return this.removeFolder(name, url, req, res);
          case _CBOX_EXECUTE_TYPE_REMOVE_FILE:
            return this.removeFile(name, url, req, res);
          case _CBOX_EXECUTE_TYPE_LIST:
            return this.list(name, url, req, res);
          case _CBOX_EXECUTE_TYPE_IS_FILE:
            return this.isFile(name, url, req, res);
          case _CBOX_EXECUTE_TYPE_IS_FOLDER:
            return this.isFolder(name, url, req, res);
          
          // GETファイル指定、もしくは指定なしは[getFile処理]
          case _CBOX_EXECUTE_TYPE_GET_FILE:
          case "":
          case undefined:
            return this.getFile(name, url, req, res);
        }
      }

      // リクエストを閉じる.
      try {req.end();} catch(e) {}
      try {req.close();} catch(e) {}

      // エラー返却.
      http.errorFileResult(500,
        {message: "処理タイプ[" + executeType + "]に対してmethodが " + method.toUpperCase() + " で処理できません:" + url},
        res,
        closeFlag);
      return false;
    
    } catch(error) {
      http.errorFileResult(500, error, res, closeFlag);
      return false;
    }
  }

  // 指定フォルダ作成.
  o.createFolder = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        if(file.mkdirs(name)) {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "フォルダの作成に成功しました:" + url},
            200,
            notCache, closeFlag);
          return true;
        } else {
          http.errorFileResult(500,
            {message: "フォルダの作成に失敗しました:" + url},
            res,
            closeFlag);
          return false;
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      } finally {
        psync.unlock(topName);
      }
    });
  }

  // 指定フォルダ削除.
  o.removeFolder = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        if(file.delete(name)) {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "フォルダの削除に成功しました:" + url},
            200,
            notCache, closeFlag);
          return true;
        } else {
          http.errorFileResult(500,
            {message: "フォルダの削除に失敗しました:" + url},
            res,
            closeFlag);
          return false;
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      } finally {
        psync.unlock(topName);
      }
    });
  }

  // ファイルの作成、上書き.
  o.createFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        if(file.isDir(name)) {

          // アンロック.
          psync.unlock(topName);

          http.errorFileResult(403,
            {message: "ファイル作成に失敗しました: 同じフォルダ名が存在します:" + url},
            res,
            closeFlag);
          return false;
        }
        if(!file.isDir(_getFolder(name))) {

          // アンロック.
          psync.unlock(topName);

          http.errorFileResult(403,
            {message: "ファイル作成に失敗しました: フォルダが存在しません:" + url},
            res,
            closeFlag);
          return false;
        }

        // 既に元のファイルが存在するかチェック.
        var oldFile = null;

        // 元のファイルが存在する場合.
        if(file.isFile(name)) {

          // 元のファイル名をテンポラリファイルに移動.
          oldFile = _moveByTmp(name);
        }

        // データ書き込み先.
        var out = fs.createWriteStream(name);

        // データ書き込み中.
        req.on("data", function (chunk) {
          out.write(chunk);
        });

        // データ終了.
        req.on("end", function () {
          out.end();
          out.close();
          out = null;

          // 元のファイルが存在する場合.
          if(oldFile != null) {

            // 元のファイルを削除.
            file.removeFile(oldFile);
          }

          // アンロック.
          psync.unlock(topName);

          // 正常終了を返却.
          http.sendJson(res, null,
            {result:"success", status: 200, message: "ファイルの作成に成功しました:" + url},
            200,
            notCache, closeFlag);
        });

        // 処理中エラー.
        req.on("error", function(err) {
          console.debug(err);

          // 書き込み途中のデータを破棄.
          try {out.end();} catch(e) {}
          try {out.close();} catch(e) {}
          out = null;

          // リクエストを閉じる.
          try {req.end();} catch(e) {}
          try {req.close();} catch(e) {}

          // 書き込み中のファイルを削除.
          file.removeFile(name);

          // 元のファイルが存在する場合.
          if(oldFile != null) {

            // テンポラリファイルを元のファイルに戻す.
            file.rename(oldFile, name);
          }

          // アンロック.
          psync.unlock(topName);
        
          // エラー返却.
          http.errorFileResult(500, err, res, closeFlag);
        });
      } catch(e) {

        // アンロック.
        psync.unlock(topName);
        return false;
      }
    });
  }

  // ファイルの取得.
  o.getFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        // favicon.icoの場合は404 返却.
        if(url == _FAVICON_ICO) {
          return http.sendFaviconIco(res, {}, closeFlag);
        }
        if(!file.isFile(name)) {

          // アンロック.
          psync.unlock(topName);

          http.errorFileResult(404,
            {message: "指定ファイルは存在しません:" + url},
            res,
            closeFlag);
          return false;
        }
        var stat = file.stat(name);
        var headers = {};
        var mime = http.mimeType(name, envConf);
        var mtime = new Date(stat.mtime.getTime());

        // ヘッダ情報をセット.
        headers['Content-Type'] = mime;
        headers['Last-Modified'] = http.toRfc822(mtime);

        // キャッシュ情報の場合.
        // notCache = true の場合はキャッシュは取らない.
        if (!notCache && req.headers["if-modified-since"] && http.isCache(mtime, req.headers["if-modified-since"])) {

          // 返却処理.
          try {
            // クロスヘッダ対応. 
            http.setCrosHeader(headers, 0, notCache, closeFlag);
            res.writeHead(304, headers);
            res.end("");
            return true;
          } catch(e) {
            http.errorFileResult(500, e, res, closeFlag);
          } finally {

            // アンロック.
            psync.unlock(topName);
          }
          return false;
        }

        // キャッシュでない場合.
        try {
          // クロスヘッダ対応.
          http.setCrosHeader(headers, stat.size, notCache, closeFlag);
          res.writeHead(200, headers);

          // ファイルの返信は「生データ」を返却.
          var rs = fs.createReadStream(name);
          rs.on('data', function (data) {
            res.write(data);
          });
          rs.on('end', function () {
            res.end();

            // アンロック.
            psync.unlock(topName);
          });
          rs.on("error", function(err) {
            try { res.end(); } catch(e) {}
            try { rs.close(); } catch(e) {}

            // アンロック.
            psync.unlock(topName);
            console.debug(e);
          })
        } catch(e) {

          // アンロック.
          psync.unlock(topName);
          http.errorFileResult(500, e, res, closeFlag);
          return false;
        }
        return true;
      } catch(e) {

        // アンロック.
        psync.unlock(topName);
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      }
    });
  }

  // 指定ファイルの削除.
  o.removeFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        if(file.removeFile(name)) {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "ファイルの削除に成功しました:" + url},
            200,
            notCache, closeFlag);
          return true;
        } else {
          http.errorFileResult(500,
            {message: "ファイルの削除に失敗しました:" + url},
            res,
            closeFlag);
          return false;
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      } finally {
        psync.unlock(topName);
      }
    });
  }

  // 対象フォルダ配下のファイル・フォルダ一覧を取得.
  o.list = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        if(!file.isDir(name)) {
          http.errorFileResult(403,
            {message: "リスト取得に失敗しました: フォルダではありません: " + url},
            res,
            closeFlag);
          return false;
        }

        // 指定フォルダ以下のリストを取得.
        var ret = [];
        var n = null;
        var stat = null;
        var list = file.list(name);
        var len = list.length;
        for(var i = 0; i < len; i ++) {
          n = list[i];
          stat = file.stat(name + "/" + n);
          if(stat == null) {
            continue;
          }
          ret.push({
            name: name,                     // ファイル/フォルダ名
            fileSize: stat.size,            // ファイルサイズ(byte)
            fileTime: stat.mtime.getTime(), // ファイルタイム(unixTime)
            isFile: stat.isFile,            // ファイルの場合[true]
            isDir: stat.isDir               // フォルダの場合[true]
          });
        }

        // 処理結果返却.
        http.sendJson(res, null,
          {result:"success", status: 200, message: "リスト取得に成功しました:" + url, value: ret},
          200,
          notCache, closeFlag);
        return true;

      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      } finally {
        psync.unlock(topName);
      }
    });
  }

  // 指定ファイルが存在するかチェック.
  o.isFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        http.sendJson(res, null,
          {result:"success", status: 200, message: "ファイルチェック結果:" + url, value: file.isFile(name)},
          200,
          notCache, closeFlag);
        return true;
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      } finally {
        psync.unlock(topName);
      }
    });
  }

  // 指定フォルダが存在するかチェック.
  o.isFolder = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          return false;
        }
        http.sendJson(res, null,
          {result:"success", status: 200, message: "フォルダチェック結果:" + url, value: file.isDir(name)},
          200,
          notCache, closeFlag);
        return true;
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        return false;
      } finally {
        psync.unlock(topName);
      }
    });
  }

  return o;
}