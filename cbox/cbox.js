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
  var _TMP_UNIQUE_LENGTH = 48;

  // ロックタイムアウト(5秒).
  var _LOCK_TIMEOUT = 5000;

  // テンポラリファイルの拡張子.
  var _TMP_EXTENSION = ".tmp";

  // cboxデータ格納フォルダ名.
  var _CBOX_FOLDER = "./cbox";

  // favicon.ico.
  var _FAVICON_ICO = "/favicon.ico";


  // cbox 書き込み許可シグニチャ.
  var _CBOX_WRITE_SIGNATURES = "x-cbox-write-signatures"


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

  // CBOX: ロック状態を取得.
  var _CBOX_EXECUTE_TYPE_IS_LOCK = "is-lock";

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

  // urlに./ や ..が存在するかチェック.
  var _checkUrl = function(url, res, closeFlag) {
    if(url.indexOf("../") != -1) {
      http.errorFileResult(403,
        {message: "不正なURLを検知:" + url},
        res,
        closeFlag);
      return false;
    }
    // 隠しファイルを指定されている場合は、処理しない.
    if(url.indexOf("/.") != -1) {
      http.errorFileResult(403,
        {message: "隠しファイル、フォルダは禁止です:" + url},
        res,
        closeFlag);
      return false;
    }
    return true;
  }

  // URLにTOPフォルダにファイルを指定している場合はエラー返却.
  // ファイルのI/Oに対して有効.
  var _topUrlCheck = function(url, res, closeFlag) {
    var p = url.indexOf("/", 1);
    if(p == -1 || p + 1 == url.length) {
      http.errorFileResult(403,
        {message: "ルートフォルダにファイルは設定できません:" + url},
        res,
        closeFlag);
      return false;
    }
    return true;
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

  // リクエストを閉じる処理.
  var _closeReq = function(req) {
    // リクエストを閉じる.
    try {req.end();} catch(e) {}
    try {req.close();} catch(e) {}
  }

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
      var ret = true;
      var executeType = req.headers[_CBOX_EXECUTE_TYPE];
      var method = req.method.toLowerCase();
      var url = _getUrl(req);
      var name = _CBOX_FOLDER + url;

      // URL不正チェック.
      if(!_checkUrl(url, res, closeFlag)) {
        ret = false;
      
      // methodで処理を分ける.
      } else if(method == "post") {

        // ファイル作成・更新処理.
        if(executeType == _CBOX_EXECUTE_TYPE_CREATE_FILE) {
          return this.createFile(name, url, req, res);
        }

        // エラー返却.
        http.errorFileResult(500,
          {message: "処理タイプ[" + executeType + "]に対してmethodが POST で処理できません:" + url},
          res,
          closeFlag);
        
        ret = false;
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
          case _CBOX_EXECUTE_TYPE_IS_LOCK:
            return this.isLock(name, url, req, res);
          
          // GETファイル指定、もしくは指定なしは[getFile処理]
          case _CBOX_EXECUTE_TYPE_GET_FILE:
          case "":
          case undefined:
            return this.getFile(name, url, req, res);
        }
      }
      // エラー返却.
      http.errorFileResult(500,
        {message: "処理タイプ[" + executeType + "]に対してmethodが " + method.toUpperCase() + " で処理できません:" + url},
        res,
        closeFlag);

      ret = false;
      return ret;
    
    } catch(error) {
      http.errorFileResult(500, error, res, closeFlag);

      ret = false;
      return ret;
    } finally {
      if(!ret) {
        // リクエストを閉じる.
        _closeReq(req);
      }
    }
  }

  // 指定フォルダ作成.
  o.createFolder = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // フォルダ作成失敗.
        } else if(!file.mkdirs(name)) {
          http.errorFileResult(500,
            {message: "フォルダの作成に失敗しました:" + url},
            res,
            closeFlag);
          ret = false;
        // 処理成功.
        } else {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "フォルダの作成に成功しました:" + url},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定フォルダ削除.
  o.removeFolder = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 削除フォルダが存在しない.
        } else if(!file.delete(name)) {
          http.errorFileResult(500,
            {message: "フォルダの削除に失敗しました:" + url},
            res,
            closeFlag);
          ret = false;
        // 処理成功.
        } else {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "フォルダの削除に成功しました:" + url},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // ファイルの作成、上書き.
  o.createFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // URLが不正な場合.
        } else if(!_topUrlCheck(url, res, closeFlag)) {
          ret = false;
        // 同じファイル名で既にフォルダが存在している.
        } else if(file.isDir(name)) {
          http.errorFileResult(403,
            {message: "ファイル作成に失敗しました: 同じフォルダ名が存在します:" + url},
            res,
            closeFlag);
          ret = false;
        // ファイルを設置するフォルダ名が存在しない場合エラー..
        } else if(!file.isDir(_getFolder(name))) {
          http.errorFileResult(403,
            {message: "ファイル作成に失敗しました: フォルダが存在しません:" + url},
            res,
            closeFlag);
          ret = false;
        
        // ファイル書き込み.
        } else {

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
              {result:"success", status: 200, message: "ファイルの作成に成功しました:" + url, newFile: oldFile == null},
              200,
              notCache, closeFlag);
          });

          // 処理中エラー.
          req.on("error", function(err) {
            // 書き込み途中のデータを破棄.
            try {out.end();} catch(e) {}
            try {out.close();} catch(e) {}
            out = null;

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

            // リクエストを閉じる.
            _closeReq(req);
            console.debug(err);
          });
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        var ret = false;
      } finally {

        // アンロック.
        psync.unlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // ファイルの取得.
  o.getFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.readLock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // favicon.icoの場合は404 返却.
        } else if(url == _FAVICON_ICO) {
          http.sendFaviconIco(res, {}, closeFlag);
          ret = false;
        // URLが不正な場合.
        } else if(!_topUrlCheck(url, res, closeFlag)) {
          ret = false;
        // ファイルが存在しない場合は404エラー.
        } else if(!file.isFile(name)) {
          http.errorFileResult(404,
            {message: "指定ファイルは存在しません:" + url},
            res,
            closeFlag);
          ret = false;
        
        // ファイル読み込み.
        } else {

          // キャッシュありのチェック.
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
            // クロスヘッダ対応. 
            http.setCrosHeader(headers, 0, notCache, closeFlag);
            res.writeHead(304, headers);
            res.end("");
          } else {

            // キャッシュなしの場合.
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
                psync.readUnlock(topName);
              });
              rs.on("error", function(err) {
                try { res.end(); } catch(e) {}
                try { rs.close(); } catch(e) {}

                // アンロック.
                psync.readUnlock(topName);

                // リクエストを閉じる.
                _closeReq(req);
                console.debug(err);
              })
            } catch(e) {
              http.errorFileResult(500, e, res, closeFlag);
              ret = false;
            }
          }
        }

      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定ファイルの削除.
  o.removeFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.lock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // URLが不正な場合.
        } else if(!_topUrlCheck(url, res, closeFlag)) {
          ret = false;
        // ファイルが存在しない.
        } else if(!file.removeFile(name)) {
          http.errorFileResult(500,
            {message: "ファイルの削除に失敗しました:" + url},
            res,
            closeFlag);
          ret = false;
        // 処理成功.
        } else {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "ファイルの削除に成功しました:" + url},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 対象フォルダ配下のファイル・フォルダ一覧を取得.
  o.list = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.readLock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 指定フォルダが存在しない.
        } else if(!file.isDir(name)) {
          http.errorFileResult(403,
            {message: "リスト取得に失敗しました: フォルダではありません: " + url},
            res,
            closeFlag);
          ret = false;
        // リスト一覧取得.
        } else {
          // 指定フォルダ以下のリストを取得.
          var ret = [];
          var n = null;
          var stat = null;
          var list = file.list(name);
          var len = list.length;
          for(var i = 0; i < len; i ++) {
            n = list[i];
            // 隠しファイルは非表示.
            if(n.indexOf(".") == 0) {
              continue;
            }
            stat = file.stat(name + "/" + n);
            if(stat == null) {
              continue;
            }
            ret.push({
              name: n,                        // ファイル/フォルダ名
              fileSize: stat.size,            // ファイルサイズ(byte)
              fileTime: stat.mtime.getTime(), // ファイルタイム(unixTime)
              isFile: stat.isFile(),          // ファイルの場合[true]
              isDir: stat.isDirectory(),      // フォルダの場合[true]
              isLock: psync.isLock(name)      // ロック状態.
            });
          }

          // 処理結果返却.
          http.sendJson(res, null,
            {result:"success", status: 200, message: "リスト取得に成功しました:" + url, value: ret},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定ファイルが存在するかチェック.
  o.isFile = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.readLock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // URLが不正な場合.
        } else if(!_topUrlCheck(url, res, closeFlag)) {
          ret = false;
        // 正常処理.
        } else {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "ファイルチェック結果:" + url, value: file.isFile(name)},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定フォルダが存在するかチェック.
  o.isFolder = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.readLock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "フォルダチェック結果:" + url, value: file.isDir(name)},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 対象フォルダ・ファイルはロックされているかチェック.
  // 先頭フォルダ名で読み込み、書き込みロックを行います.
  o.isLock = function(name, url, req, res) {
    var topName = _topFolderName(url);
    psync.readLock(topName, _LOCK_TIMEOUT, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          http.sendJson(res, null,
            {result:"success", status: 200, message: "ロックチェック結果:" + url, value: psync.isLock(name)},
            200,
            notCache, closeFlag);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnlock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  return o;
}