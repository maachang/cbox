// cbox処理.js
//
//

module.exports.create = function(notCache, closeFlag, serverId, systemNanoTime, notCmdFlg) {
  'use strict';
  var o = {};

  var fs = require("fs");
  var file = require("../lib/file");
  var http = require("./http");
  var psync = require("../lib/psync")(systemNanoTime);
  var uniqueId = require("../lib/uniqueId");
  var uaccess = require("./uaccess").create(notCache, closeFlag, serverId, systemNanoTime, notCmdFlg);
  var nums = require("../lib/nums");

  // コンフィグ(実行環境用)
  var envConf = null;

  // テンポラリファイルのunique数.
  var _TMP_UNIQUE_LENGTH = 48;

  // テンポラリファイルの拡張子.
  var _TMP_EXTENSION = ".tmp";

  // cboxデータ格納フォルダ名.
  var _CBOX_FOLDER = "./cbox";

  // favicon.ico.
  var _FAVICON_ICO = "/favicon.ico";
  

  // cbox: 処理タイムアウト.
  var _CBOX_EXECUTE_TIMEOUT = "x-cbox-execute-timeout";

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

  // CBOX: 処理区分: expire時間設定.
  var _CBOX_EXECUTE_TYPE_SET_EXPIRE= "set-expire";

  // CBOX: 処理区分: expire時間取得.
  var _CBOX_EXECUTE_TYPE_GET_EXPIRE= "get-expire";

  // CBOX: ロック状態を取得.
  var _CBOX_EXECUTE_TYPE_IS_LOCK = "is-lock";

  // CBOX: 強制ロック会場.
  var _CBOX_EXECUTE_TYPE_FORCED_LOCK = "forced-lock";

  // cbox: ファイル寿命(ミリ秒)
  var _CBOX_FILE_EXPIRE = "x-cbox-file-expire";

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
    // 隠しファイルや[@]が入ったを指定されている場合は、処理しない.
    if(url.indexOf("/.") != -1 || url.indexOf("/@") != -1) {
      http.errorFileResult(403,
        {message: "隠しファイル・フォルダ、[@]先頭名のファイル：フォルダは禁止です:" + url},
        res,
        closeFlag);
      return false;
    }
    return true;
  }

  // URLにTOPフォルダにファイルを指定している場合はエラー返却.
  // ファイルのI/Oに対して有効.
  var _topUrlCheck = function(url, res, closeFlag, noError) {
    noError = noError == true;
    var p = url.indexOf("/", 1);
    if(p == -1 || p + 1 == url.length) {
      if(!noError) {
        http.errorFileResult(403,
          {message: "ルートフォルダにファイルは設定できません:" + url},
          res,
          closeFlag);
      }
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
  var _topFolderName = function(name, off) {
    off = off|0;
    var p = name.indexOf("/", off);
    if(p == off) {
      name = name.substring(off + 1);
      if((p = name.indexOf("/", off + 1)) == -1) {
        return name;
      }
    }
    return name.substring(off, p);
  }

  // expireファイル名を取得.
  var _expireFileName = function(name) {
    var p = name.lastIndexOf("/");
    return name.substring(0,p+1) + "." + name.substring(p+1);
  }

  // expire時間を取得.
  var _getExpire = function(name) {
    var expire = -1;
    name = _expireFileName(name);
    if(file.isFile(name)) {
      try {
        expire = +file.readByString(name);
      } catch(e) {}
      if(expire <= 0) {
        expire = -1;
      }
    }
    return expire;
  }

  // expireファイルが存在する場合、そのファイルがexpire値を超えているかチェック.
  var _isExpireFile = function(name) {
    var time = _getExpire(name);
    return (time > 0 && time < Date.now())
  }

  // ファイル寿命が過ぎたファイルの削除時間.
  // １日後.
  var _CBOX_DELETE_FILE_BY_EXPIRE_TIME = 1000 * 60 * 60 * 24;

  // expire時間が一定を過ぎている場合、ファイル削除.
  var _removeExpireFile = function(topName, lockTimeout, name) {
    var time = _getExpire(name);
    if(time > 0 && (time + _CBOX_DELETE_FILE_BY_EXPIRE_TIME) < Date.now()) {
      // topNameが設定されてる場合は、ロック処理.
      if(topName) {
        psync.lock(topName, lockTimeout, function(successFlag) {
          try {
            if(successFlag) {
              // 元のファイルと、expireファイルを削除する.
              file.removeFile(name);
              file.removeFile(_expireFileName(name));
            }
          } catch(e) {
            console.debug(e);
          } finally {
            // アンロック.
            psync.unLock(topName);
          }
        });
      // top処理が設定されていない場合は、ロック処理は行わない.
      } else {
        try {
          // 元のファイルと、expireファイルを削除する.
          file.removeFile(name);
          file.removeFile(_expireFileName(name));
        } catch(e) {
          console.debug(e);
        }
      }
      return true;
    }
    return false;
  }

  // 正常JSONを返却.
  var _successJSON = function(res, message, value, status) {
    if(!nums.isNumeric(status)) {
      status = 200;
    }
    var json = {result: "success", status: 200, message: message};
    if(value) {
      json.value = value;
    }
    http.sendJson(res, null, json, status, notCache, closeFlag);
  }

  // エラーJSONを返却.
  var _errorJSON = function(res, message, status) {
    if(!nums.isNumeric(status)) {
      status = 500;
    }
    http.errorFileResult(status, message, res, closeFlag);
  }

  // ロックタイムアウトエラー.
  var _errorLockTimeout = function(url, res, notCache, closeFlag) {
    _errorJSON(res, "ロックタイムアウト:" + url)
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
  o.execute = function(req, res) {
    try {
      var ret = true;
      var executeType = req.headers[_CBOX_EXECUTE_TYPE];
      var lockTimeout = req.headers[_CBOX_EXECUTE_TIMEOUT];
      var method = req.method.toLowerCase();
      var url = _getUrl(req);

      // URL不正チェック.
      if(!_checkUrl(url, res, closeFlag)) {
        ret = false;
      
      // methodで処理を分ける.
      } else if(method == "post") {

        // [書き込み系処理]ファイル作成・更新処理.
        if(executeType == _CBOX_EXECUTE_TYPE_CREATE_FILE) {
          return this.createFile(req, res, lockTimeout);
        }

        // エラー返却.
        _errorJSON(res, "処理タイプ[" + executeType + "]に対してmethodが POST で処理できません:" + url);
        ret = false;
      } else if(method == "get") {

        // uaccessの実行条件の場合.
        if(uaccess.isExecute(req)) {
          return uaccess.execute(req, res);
        }

        // executeTypeが空の場合は、ファイル取得で処理.
        if(executeType ==  "" || executeType == undefined || executeType == null) {
          executeType = _CBOX_EXECUTE_TYPE_GET_FILE;
        }

        // ファイル取得のみ[uaccessアカウント認証無し]で処理する.
        // GETファイル指定、もしくは指定なし [getFile処理]
        if(_CBOX_EXECUTE_TYPE_GET_FILE == executeType) {
          return this.getFile(req, res, lockTimeout);
        }

        // uaccessアカウント認証ありで処理する.
        uaccess.authAccount(req, function(result) {
          if(result == false) {
            // エラー返却.
            _errorJSON(res, "cboxの処理タイプ " + executeType + " のアクセスには認証が必要です:" + url);
            return false;
          }

          // 書き込み系処理.
          switch(executeType) {
            case _CBOX_EXECUTE_TYPE_CREATE_FOLDER:
              return o.createFolder(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_REMOVE_FOLDER:
              return o.removeFolder(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_REMOVE_FILE:
              return o.removeFile(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_SET_EXPIRE:
              return o.setExpire(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_FORCED_LOCK:
              return o.forcedLock(req, res);
          }

          // 読み込み系処理.
          switch(executeType) {
            case _CBOX_EXECUTE_TYPE_LIST:
              return o.list(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_IS_FILE:
              return o.isFile(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_IS_FOLDER:
              return o.isFolder(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_GET_EXPIRE:
              return o.getExpire(req, res, lockTimeout);
            case _CBOX_EXECUTE_TYPE_IS_LOCK:
              return o.isLock(req, res, lockTimeout);
          }

          // エラー返却.
          _errorJSON(res, "処理タイプ[" + executeType + "]に対してmethodが " + method.toUpperCase() + " で処理できません:" + url);
          return false;
        }, null, lockTimeout);
      }

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
  o.createFolder = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.lock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // フォルダ作成失敗.
        } else if(!file.mkdirs(name)) {
          _errorJSON(res, "フォルダの作成に失敗しました:" + url);
          ret = false;
        // 処理成功.
        } else {
          _successJSON(res, "フォルダの作成に成功しました:" + url);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定フォルダ削除.
  o.removeFolder = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.lock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 削除フォルダが存在しない.
        } else if(!file.delete(name)) {
          _errorJSON(res, "フォルダの削除に失敗しました:" + url);
          ret = false;
        // 処理成功.
        } else {
          _successJSON(res, "フォルダの削除に成功しました:" + url);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // ファイルの作成、上書き.
  o.createFile = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);

    // ファイル寿命を設定.
    var expire = req.headers[_CBOX_FILE_EXPIRE]|0;
    if(expire <= 0) {
      expire = -1;
    }
    psync.lock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      var eventFlag = false;
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
          _errorJSON(res, "ファイル作成に失敗しました: 同じフォルダ名が存在します:" + url, 403);
          ret = false;
        // ファイルを設置するフォルダ名が存在しない場合エラー..
        } else if(!file.isDir(_getFolder(name))) {
          _errorJSON(res, "ファイル作成に失敗しました: フォルダが存在しません:" + url, 403);
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

          // イベント処理開始.
          eventFlag = true;

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

            // expireが存在する場合、アクセス不能にするunixTimeをファイル出力.
            if(expire > 0) {
              file.writeByString(_expireFileName(name), Date.now() + expire);
            } else {
              try {
                file.removeFile(_expireFileName(name));
              } catch(e){}
            }

            // アンロック.
            psync.unLock(topName);

            // 正常終了を返却.
            _successJSON(res, "ファイルの作成に成功しました:" + url, "" + (oldFile == null));
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
            psync.unLock(topName);
          
            // エラー返却.
            http.errorFileResult(500, err, res, closeFlag);

            // リクエストを閉じる.
            _closeReq(req);
          });
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        var ret = false;
      } finally {

        // イベント側で処理しない場合.
        if(!eventFlag) {
          psync.unLock(topName);
          if(!ret) {
            // リクエストを閉じる.
            _closeReq(req);
          }
        }
      }
      return ret;
    });
  }

  // ファイルの取得.
  o.getFile = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.readLock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      var statFlag = false;
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
        } else if(!_topUrlCheck(url, res, closeFlag, true)) {
          // 空のデータ送信.
          var headers = {};
          headers['Content-Type'] = "text/plain; charset=utf-8;";
          http.setCrosHeader(headers, 0, notCache, closeFlag);
          res.writeHead(200, headers);
          res.end("");
        // ファイルが存在しない場合は404エラー.
        // 対象ファイルがexpireしている場合.
        } else if(!file.isFile(name) || _isExpireFile(name)) {
          // 寿命に達したファイルは物理削除.
          _removeExpireFile(null, null, name);
          _errorJSON(res, "指定ファイルは存在しません:" + url, 404);
          ret = false;
        // ファイル読み込み.
        } else {
          // 非同期statで処理するので、ここでは後処理は行わない.
          statFlag = true;

          // ファイル存在チェック.
          fs.stat(name, function(err, stat) {
            var eventFlag = false;
            try {
              // エラー処理.
              if (err) throw err;

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

                // クロスヘッダ対応.
                http.setCrosHeader(headers, stat.size, notCache, closeFlag);
                res.writeHead(200, headers);

                // ファイルの返信は「生データ」を返却.
                var rs = fs.createReadStream(name);

                // イベント開始.
                eventFlag = true;

                rs.on('data', function (data) {
                  res.write(data);
                });
                rs.on('end', function () {
                  res.end();

                  // アンロック.
                  psync.readUnLock(topName);
                });
                rs.on("error", function(err) {
                  try { res.end(); } catch(e) {}
                  try { rs.close(); } catch(e) {}

                  // アンロック.
                  psync.readUnLock(topName);

                  // リクエストを閉じる.
                  _closeReq(req);
                })
              }
            }catch(e) {
              http.errorFileResult(500, e, res, closeFlag);
              ret = false;
            } finally {
              if(!eventFlag) {
                psync.readUnLock(topName);
                if(!ret) {
                  // リクエストを閉じる.
                  _closeReq(req);
                }
              }
            }
          });
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // statで処理していない場合.
        if(!statFlag) {
          psync.readUnLock(topName);
          if(!ret) {
            // リクエストを閉じる.
            _closeReq(req);
          }
        }
      }
      return ret;
    });
  }

  // 指定ファイルの削除.
  o.removeFile = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.lock(topName, lockTimeout, function(successFlag) {
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
          _errorJSON(res, "ファイルの削除に失敗しました:" + url);
          ret = false;
        // 処理成功.
        } else {
          // expireファイルを削除.
          file.removeFile(_expireFileName(name));
          _successJSON(res, "ファイルの削除に成功しました:" + url);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 対象フォルダ配下のファイル・フォルダ一覧を取得.
  o.list = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.readLock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 指定フォルダが存在しない.
        } else if(!file.isDir(name)) {
          _errorJSON(res, "リスト取得に失敗しました: フォルダではありません:" + url, 403);
          ret = false;
        // リスト一覧取得.
        } else {
          // 指定フォルダ以下のリストを取得.
          var ret = [];
          var n = null;
          var expire = -1;
          var stat = null;
          var list = file.list(name);
          var len = list.length;
          var nowDate = Date.now();
          var pathName = null;
          for(var i = 0; i < len; i ++) {
            n = list[i];
            // 隠しファイルは非表示.
            if(n.indexOf(".") == 0) {
              continue;
            }
            // パス名変換.
            pathName = name + "/" + n;
            // statの取得に失敗の場合は処理しない.
            if((stat = file.stat(pathName)) == null) {
              continue;
            }
            // ファイルの場合.
            if(stat.isFile()) {
              // expire値を取得.
              expire = _getExpire(pathName);
              // 寿命に達したファイルは物理削除.
              if(expire > 0 && expire < nowDate) {
                // ファイルが削除された場合は、非表示.
                if(_removeExpireFile(null, null, pathName)) {
                  continue;
                }
              }
            } else {
              expire = -1;
            }
            ret.push({
              name: n,                        // ファイル/フォルダ名
              fileSize: stat.size,            // ファイルサイズ(byte)
              fileTime: stat.mtime.getTime(), // ファイルタイム(unixTime)
              expire: expire,                 // expire時間.
              isExpire: (expire > 0 && expire < nowDate), // expire中ファイルの場合[true]
              isFile: stat.isFile(),          // ファイルの場合[true]
              isDir: stat.isDirectory(),      // フォルダの場合[true]
              isLock: psync.isLock(name)      // ロック状態.
            });
          }

          // 処理結果返却.
          _successJSON(res, "リスト取得に成功しました:" + url, {parent: url, list: ret});
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定ファイルが存在するかチェック.
  o.isFile = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.readLock(topName, lockTimeout, function(successFlag) {
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
          var result = (file.isFile(name) && !_isExpireFile(name));
          if(!result) {
            // 寿命に達したファイルは物理削除.
            _removeExpireFile(null, null, pathName);
          }
          _successJSON(res, "ファイルチェック結果:" + url, "" + result);
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定フォルダが存在するかチェック.
  o.isFolder = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.readLock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          _successJSON(res, "フォルダチェック結果:" + url, "" + file.isDir(name));
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定ファイルのexpire値設定.
  o.setExpire = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);

    // ファイル寿命を設定.
    var expire = req.headers[_CBOX_FILE_EXPIRE]|0;
    if(expire <= 0) {
      expire = -1;
    }
    psync.lock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // URLが不正な場合.
        } else if(!_topUrlCheck(url, res, closeFlag)) {
          ret = false;
        // 処理成功.
        } else {
          // expireが存在する場合、アクセス不能にするunixTimeをファイル出力.
          var result = true;
          if(expire > 0) {
            result = file.writeByString(_expireFileName(name), Date.now() + expire);
          } else {
            try {
              file.removeFile(_expireFileName(name));
            } catch(e){
            }
          }
          if(result) {
            _successJSON(res, "指定ファイルの寿命設定に成功しました:" + url);
          } else {
            _errorJSON(res, "指定ファイルの寿命設定に失敗しました:" + url);
          }
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 指定ファイルの寿命を取得.
  o.getExpire = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.readLock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          _successJSON(res, "ファイル寿命:" + url, "" + _getExpire(name));
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(topName);
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
  o.isLock = function(req, res, lockTimeout) {
    var url = _getUrl(req);
    var name = _CBOX_FOLDER + url;
    var topName = _topFolderName(url);
    psync.readLock(topName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          _successJSON(res, "ロックチェック結果:" + url, "" + psync.isLock(name));
        }
      } catch(e) {
        http.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(topName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 強制ロック解除処理を実行.
  o.forcedLock = function(req, res) {
    var url = _getUrl(req);
    var topName = _topFolderName(url);
    var ret = true;
    try {
      _successJSON(res, "強制ロック解除結果:" + url, "" + psync.forcedLock(topName));
    } catch(e) {
      http.errorFileResult(500, e, res, closeFlag);
      ret = false;
    } finally {
      if(!ret) {
        // リクエストを閉じる.
        _closeReq(req);
      }
    }
    return ret;
  }

  // uaccessオブジェクトを取得.
  o.uaccess = function() {
    return uaccess
  }

  // expire監視: 監視フォルダ.
  var _EXPIRE_CHECK_FOLDER = _CBOX_FOLDER;
  var _EXPIRE_CHECK_FOLDER_LENGTH = _EXPIRE_CHECK_FOLDER.length;

  // expire監視: ロックタイムアウト(１秒).
  var _EXPIRE_CHECK_LOCK_TIMEOUT = 1000;

  // expire監視: 処理キュー.
  var _EXPIRE_CHECK_QUEUE = [];

  // expire監視: フォルダ監視タイミング.
  var _EXPIRE_CHECK_TIMEOUT = 5000;

  // expire監視: １つのフォルダ配下のexpire監視.
  var _expireCheckOne = function(path) {
    var n = null;
    var list = file.list(path);
    var len = list.length;
    var name = null;
    var topName = _topFolderName(path, _EXPIRE_CHECK_FOLDER_LENGTH);
    // topNameが ./cbox の場合は、top名は無効.
    if(topName == _EXPIRE_CHECK_FOLDER) {
      topName = null;
    }
    for(var i = 0; i < len; i ++) {
      n = list[i];
      // 隠しファイルは非表示.
      if(n.indexOf(".") == 0) {
        continue;
      }
      // パス名変換.
      name = path + "/" + n;
      // 対象がフォルダの場合は、億の処理を実行.
      if(file.isDir(name)) {
        // 処理キューに追加.
        _EXPIRE_CHECK_QUEUE.push(name);
      } else {
        // expire削除チェック.
        _removeExpireFile(topName, _EXPIRE_CHECK_LOCK_TIMEOUT, name);
      }
    }
  }

  // expire監視: キュー管理.
  var _managerQueueByExpireCheck = function() {
    setTimeout(_executeQueueByExpireCheck, _EXPIRE_CHECK_TIMEOUT);
  }

  // expire監視: キュー実行.
  var _executeQueueByExpireCheck = function() {
    try {
      // 次の処理キューに溜まっている処理を実行.
      var path = _EXPIRE_CHECK_QUEUE.shift();
      if(!path) {
        // キューに情報が無い場合は、最初のパスを監視.
        path = _EXPIRE_CHECK_FOLDER;
      }
      // 対象パスのExpire監視実行.
      _expireCheckOne(path);
    } catch(e) {
      console.debug("error", e);
    }

    // 次のキュー管理を行う.
    _managerQueueByExpireCheck();
  }

  // expire処理監視.
  o.expireService = function() {
    // キュー管理を呼び出す.
    _managerQueueByExpireCheck();
  }

  return o;
}