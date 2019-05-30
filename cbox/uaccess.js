// [uaccess] ユーザ権限・アクセス関連.
//
// 概要:
// 
// 以下4つのコードを管理します.
//
// ・パスコード.
//   管理者向けのアクセスに対して、パスコードを設定すると、セキュリティが向上します.
// 
// ・管理者コード.
//   複数の管理者コードが設定でき、どれかのコードで、ユーザアカウント作成が行えます.
//   「管理者アクセス認証コード」を使って認証します.
//
// ・セキュリティコード.
//   複数のセキュリティコードが設定でき、ユーザアカウントのアクセス時に認証として利用します.
//   「管理者アクセス認証コード」を使って認証します.
//
// ・ユーザアカウントコード.
//   セキュリティコードと合わせて、アクセス許可をもらいます.
//   「管理者認証コード」を使って認証します.
//   この情報を使って、基本的に認証させます.
// 
// また、以下の認証コードには、必ず「寿命(expire)」が設定されて、認証コードの有効期限が儲けられます.
// ・管理者アクセス認証コード.
// ・管理者認証コード.
// ・ユーザアカウント認証コード.
//

module.exports.create = function(notCache, closeFlag, serverId, systemNanoTime, notCmdFlg) {
  'use strict';
  var o = {};

  var file = require("../lib/file");
  var httpCore = require("./httpCore_core");
  var psync = require("../lib/psync")(systemNanoTime);
  var uniqueId = require("../lib/uniqueId");
  var fcipher = require("../lib/fcipher");
  var nums = require("../lib/nums");

  // uaccessデータ格納フォルダ名.
  var _UACCESS_FOLDER = "./.uaccess";

  // uaccessフォルダが存在しない場合は作成する.
  if(!file.isDir(_UACCESS_FOLDER)) {
    file.mkdir(_UACCESS_FOLDER);
  }

  // 管理者コード・セキュリティコードの区切り開始文字.
  var _START_BRAKE_CODE = "::";
  var _END_BREAK_CODE = ";;";

  // 管理者コード・セキュリティコードの管理数を取得.
  var _getCodeFileByLength = function(value) {
    var p = 0;
    var n = 0;
    var ret = 0;
    while(true) {
      p = value.indexOf(_START_BRAKE_CODE, n);
      if(p == -1) {
        return ret;
      }
      n = p + 1;
      p = value.indexOf(_END_BREAK_CODE, n);
      if(p == -1) {
        return ret;
      }
      ret ++;
    }
  }

  // 管理者コード・セキュリティコードの管理情報をArray変換.
  var _getCodeFileByList = function(value) {
    var p = 0;
    var n = 0;
    var ret = [];
    while(true) {
      p = value.indexOf(_START_BRAKE_CODE, n);
      if(p == -1) {
        return ret;
      }
      n = p + 1;
      p = value.indexOf(_END_BREAK_CODE, n);
      if(p == -1) {
        return ret;
      }
      ret.push(value.substring(n + 1, p));
    }
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
  
  // トップフォルダ名を取得.
  // トップフォルダ名がアカウント名となる.
  var _topFolderName = function(name) {
    var p = name.indexOf("/");
    if(p == 0) {
      name = name.substring(1);
      if((p = name.indexOf("/", 1)) == -1) {
        return name;
      }
    }
    return name.substring(0, p);
  }

  // ロックタイムアウトエラー.
  var _errorLockTimeout = function(url, res, notCache, closeFlag) {
    httpCore.errorFileResult(500,
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

  // コール実行.
  var _execCall = function(res, call, errorCall) {
    try {
      if(!res) {
        errorCall(res);
      } else {
        call(res);
      }
    } catch(e) {
      // エラー情報を返却.
      _errorJSON(res, "エラーが発生しました: " + e.message, 500);
    }
  }

  // デフォルトexpire値(５分).
  var _DEF_EXPIRE_TIME = 1000 * 60 * 5;

  // expire値を取得
  // 設定されていない場合は、デフォルトの値を割り当てます.
  var _getExpire = function(expire) {
    if(nums.isNumeric(expire)) {
      return parseInt(expire);
    }
    return _DEF_EXPIRE_TIME;
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
    httpCore.sendJson(res, null, json, status, notCache, closeFlag);
  }

  // エラーJSONを返却.
  var _errorJSON = function(res, message, status) {
    if(!nums.isNumeric(status)) {
      status = 500;
    }
    httpCore.errorFileResult(status, message, res, closeFlag);
  }

  // パスコードファイル名.
  var _UACCESS_PASSCODE_FILE = "uaccess_pass_code.ual"

  // 空のパスコードファイルを作成.
  if(!file.isFile(_UACCESS_FOLDER + "/" + _UACCESS_PASSCODE_FILE)) {
    file.writeByString(_UACCESS_FOLDER + "/" + _UACCESS_PASSCODE_FILE, "");
  }

  // パスコードを設定.
  var _setPassCode = function(value) {
    // パスコードが空の場合は、空で保存.
    if(!value || typeof(value) != "string" || value == "") {
      value = "";
    // パスコードがセットされている場合は、fcipher.fhashでハッシュ化.
    } else {
      value = fcipher.fhash(value);
    }
    file.writeByString(_UACCESS_FOLDER + "/" + _UACCESS_PASSCODE_FILE, value);
  }

  // パスコードを取得.
  var _getPassCode = function() {
    try {
      return file.readByString(_UACCESS_FOLDER + "/" + _UACCESS_PASSCODE_FILE);
    } catch(e) {
      return "";
    }
  }

  // 管理者アクセスコードキーコード.
  var _UACCESS_ADMIN_ACCESS_CODE_KEYCODE = "_#_$_UaccExce8s%Uu1d$_C0d3#_";

  // 管理者アクセスコードヘッダ.
  var _UACCESS_ADMIN_ACCESS_CODE_HEADER = "_uaccess_admin_access";

  // 管理者アクセス認証コードを生成.
  // uuid: アクセスコード生成用のUUIDをセット.
  // expire: このアクセスコードの有効期間を設定(ミリ秒).
  // 
  // 戻り値: パックされた変換されたアクセスコード有効時間情報が返却されます.
  var _createAuthAdminAccessCode = function(uuid, expire) {
    // パスコードを取得.
    var passCode = _getPassCode();
    if(!passCode || passCode == "") {
      passCode = _UACCESS_ADMIN_ACCESS_CODE_KEYCODE;
    }
    // パック化.
    expire = _getExpire(expire);
    var key = fcipher.key(passCode, uuid);
    var src = "{\"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ADMIN_ACCESS_CODE_HEADER);
  }

  // 管理者アクセス認証コードが正しいかチェックして、有効期間を取得(ミリ秒).
  // uuid: 対象のUUIDを設定します.
  // code: 変換されたアクセスコード有効時間情報と設定します.
  // 
  // 戻り値: アンパックされたアクセスコード有効時間情報と、タイムアウト結果が返却されます.
  //         {expire: 有効時間情報, timeout: タイムアウト結果(true or false)};
  var _isAuthAdminAccessCode = function(uuid, code) {
    try {
      // パスコードを取得.
      var passCode = _getPassCode();
      if(!passCode || passCode == "") {
        passCode = _UACCESS_ADMIN_ACCESS_CODE_KEYCODE;
      }
      // アンパック化.
      var key = fcipher.key(passCode, uuid);
      var res = fcipher.dec(code, key, _UACCESS_ADMIN_ACCESS_CODE_HEADER);
      var expire = JSON.parse(res).expire;
      return {expire: expire, timeout: expire < Date.now()};
    } catch(e) {
      throw new Error("管理者アクセスコードの解析に失敗しました")
    }
  }

  // ユーザ管理者コード基本コード.
  var _UACCESS_ADMIN_CODE_KEYCODE = "_#_$_UaccExce8s%Acc0uNt_C0d3#_";

  // 管理者アクセスコードヘッダ.
  var _UACCESS_ADMIN_CODE_HEADER = "_uaccess_admin_";

  // ユーザ管理者コード長(数字羅列の長さ).
  var _UACCESS_ADMIN_CODE_LENGTH = 100;

  // ユーザ管理者コード登録最大数.
  var _UACCESS_ADMIN_CODE_MAX = 25;

  // ユーザ管理コードを管理するファイル名.
  var _UACCESS_ADMIN_CODE_FILE = "uaccess_admin_code.ual";

  // ユーザ管理者コードの管理ファイル存在チェック.
  if(!file.isFile(_UACCESS_FOLDER + "/" + _UACCESS_ADMIN_CODE_FILE)) {
    file.writeByString(_UACCESS_FOLDER + "/" + _UACCESS_ADMIN_CODE_FILE, "");
  }

  // 管理者認証コードの作成.
  // name 処理対象のユーザ名を設定します.
  // adminCode 管理者コードを設定します.
  // expire 認証キーの期限を設定します.
  //
  // 戻り値: パックされた管理者認証コードが作成されます.
  var _createAuthAdminCode = function(name, adminCode, expire) {
    // パスコードを取得.
    var passCode = _getPassCode();
    if(passCode == "") {
      passCode = _UACCESS_ADMIN_CODE_KEYCODE;
    }
    // パック化.
    expire = _getExpire(expire);
    var key = fcipher.key(passCode, name);
    var src = "{\"adminCode\": \"" + adminCode + "\", \"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ADMIN_CODE_HEADER);
  }

  // 管理者認証コードの認証.
  // name ユーザ名を設定します.
  // code 認証キーを設定します.
  //
  // 戻り値: アンパックされた管理者認証コード情報が返却されます.
  //         {adminCode: 管理者コード, expire: 有効時間情報, timeout: タイムアウト結果(true or false)}
  var _authAdminCode = function(name, code) {
    try {
      // パスコードを取得.
      var passCode = _getPassCode();
      if(passCode == "") {
        passCode = _UACCESS_ADMIN_CODE_KEYCODE;
      }
      // アンパック化.
      var key = fcipher.key(passCode, name);
      var ret = fcipher.dec(code, key, _UACCESS_ADMIN_CODE_HEADER);
      ret = JSON.parse(ret);
      ret.timeout = ret.expire < Date.now();
      return ret;
    } catch(e) {
      throw new Error("管理者コードの認証に失敗しました")
    }
  }

  // 管理者コードが登録されているかチェック.
  var _isAdminCode = function(code) {
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_ADMIN_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    var checkCode = _START_BRAKE_CODE + code + _END_BREAK_CODE;
    return list.indexOf(checkCode) != -1;
  }

  // 新しい管理者コードを１件登録します.
  var _addAdminCode = function() {
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_ADMIN_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    if(_getCodeFileByLength(list) > _UACCESS_ADMIN_CODE_MAX) {
      throw new Error("管理者コードの登録件数が最大値: " +
        _UACCESS_ADMIN_CODE_MAX + " を超えているので追加できません");
    }
    var code = uniqueId.code64(uniqueId.getId(_UACCESS_ADMIN_CODE_LENGTH));
    list += _START_BRAKE_CODE + code + _END_BREAK_CODE;
    file.writeByString(name, list);
    return code;
  }

  // 管理者コードの削除.
  var _removeAdminCode = function(code) {
    if(!code) {
      return false;
    }
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_ADMIN_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    var target = _START_BRAKE_CODE + code + _END_BREAK_CODE;
    var p = list.indexOf(target);
    if(p != -1) {
      list = list.substring(0, p) + list.substring(p + target.length);
      file.writeByString(name, list);
      return true;
    }
    return false;
  }

  // 管理者コードリスト一覧を取得.
  var _getAdminCodeList = function() {
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_ADMIN_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    return _getCodeFileByList(list);
  }

  // 最新の管理者コードを取得.
  var _getAdminCode = function() {
    var ret = _getAdminCodeList();
    if(ret.length > 0) {
      return ret[ret.length-1];
    }
    return null;
  }

  // 一番古い管理者コードを削除.
  var _removeOldAdminCode = function() {
    var ret = _getAdminCodeList();
    if(ret.length > 0) {
      return _removeAdminCode(ret[0]);
    }
    return false;
  }

  // セキュリティコード長(数字羅列の長さ).
  var _UACCESS_SECURITY_CODE_LENGTH = 150;

  // セキュリティコード登録最大数.
  var _UACCESS_SECURITY_CODE_MAX = 25;

  // セキュリティコードを管理するファイル名.
  var _UACCESS_SECURITY_CODE_FILE = "uaccess_security_code.ual";

  // セキュリティコードの管理ファイル存在チェック.
  if(!file.isFile(_UACCESS_FOLDER + "/" + _UACCESS_SECURITY_CODE_FILE)) {
    file.writeByString(_UACCESS_FOLDER + "/" + _UACCESS_SECURITY_CODE_FILE, "");
  }

  // セキュリティコードが登録されているかチェック.
  var _isSecurityCode = function(code) {
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_SECURITY_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    var checkCode = _START_BRAKE_CODE + code + _END_BREAK_CODE;
    return list.indexOf(checkCode) != -1;
  }

  // 新しいセキュリティコードを１件登録します.
  var _addSecurityCode = function() {
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_SECURITY_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    if(_getCodeFileByLength(list) > _UACCESS_SECURITY_CODE_MAX) {
      throw new Error("セキュリティコードの登録件数が最大値: " +
      _UACCESS_SECURITY_CODE_MAX + " を超えているので追加できません");
    }
    var code = uniqueId.code64(uniqueId.getId(_UACCESS_SECURITY_CODE_LENGTH));
    list += _START_BRAKE_CODE + code + _END_BREAK_CODE;
    file.writeByString(name, list);
    return code;
  }

  // セキュリティコードの削除.
  var _removeSecurityCode = function(code) {
    if(!code) {
      return false;
    }
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_SECURITY_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    var target = _START_BRAKE_CODE + code + _END_BREAK_CODE;
    var p = list.indexOf(target);
    if(p != -1) {
      list = list.substring(0, p) + list.substring(p + target.length);
      file.writeByString(name, list);
      return true;
    }
    return false;
  }

  // セキュリティコードリスト一覧を取得.
  var _getSecurityCodeList = function() {
    var list = "";
    var name = _UACCESS_FOLDER + "/" + _UACCESS_SECURITY_CODE_FILE;
    if(file.isFile(name)) {
      list = file.readByString(name);
    }
    return _getCodeFileByList(list);
  }

  // 最新のセキュリティコードを取得.
  var _getSecurityCode = function() {
    var ret = _getSecurityCodeList();
    if(ret.length > 0) {
      return ret[ret.length - 1];
    }
    return null;
  }

  // 一番古いセキュリティコードを削除.
  var _removeOldSecurityCode = function() {
    var ret = _getSecurityCodeList();
    if(ret.length > 0) {
      return _removeSecurityCode(ret[0]);
    }
    return false;
  }

  // ユーザアカウントコード用ヘッダ名.
  var _UACCESS_ACCOUNT_CODE_KEY_HEADER = "_uaccess_user_account_";

  // ユーザアカウントコードキー長(数字羅列の長さ).
  var _UACCESS_ACCOUNT_CODE_LENGTH = 200;

  // ユーザアカウントコードフォルダ.
  var _UACCOUNT_ACCOUNT_CODE_DIR = "/account/";

  // ユーザアカウントコードキー拡張子.
  var _UACCESS_ACCOUNT_CODE_PLUS = ".uac";
  var _UACCESS_ACCOUNT_CODE_PLUS_LEN = _UACCESS_ACCOUNT_CODE_PLUS.length;

  // アカウント格納フォルダを生成.
  if(!file.isFile(_UACCESS_FOLDER + _UACCOUNT_ACCOUNT_CODE_DIR)) {
    file.mkdir(_UACCESS_FOLDER + _UACCOUNT_ACCOUNT_CODE_DIR);
  }

  // ユーザアカウントコード分類フォルダ名を取得.
  var _accountCodeHeadFolder = function(name) {
    if(name.length <= 1) {
      return name;
    } else {
      return name.substring(0, 2);
    }
  }

  // ユーザアカウントヘッダフォルダを取得.
  var _getAccountHeaderFolder = function(name) {
    return _UACCESS_FOLDER + _UACCOUNT_ACCOUNT_CODE_DIR + _accountCodeHeadFolder(name);
  }

  // ユーザアカウント格納先を取得.
  var _getAccountFolder = function(name, makeDirFlag) {
    var head = _getAccountHeaderFolder(name);
    if(makeDirFlag == true) {
      if(!file.isDir(head)) {
        file.mkdir(head);
      }
    }
    return head + "/" + name + _UACCESS_ACCOUNT_CODE_PLUS
  }

  // ユーザアカウント認証コードの作成.
  // name ユーザ名を設定します.
  // accountCode このユーザのアカウントコードを設定します.
  // securityCode セキュリティコードを設定します.
  // expire 認証キーの期限を設定します.
  //
  // 戻り値: パックされたユーザアカウント認証コードが作成されます.
  var _createAuthAccountCode = function(name, accountCode, securityCode, expire) {
    expire = _getExpire(expire);
    var key = fcipher.key(accountCode, name);
    var src = "{\"securityCode\": \"" + securityCode + "\", \"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ACCOUNT_CODE_KEY_HEADER);
  }

  // ユーザアカウント認証コードの認証.
  // name ユーザ名を設定します.
  // accountCode このユーザのアカウントコードを設定します.
  // code 認証キーを設定します.
  //
  // 戻り値: アンパックされたユーザアカウント認証コード情報が返却されます.
  //         {securityCode: セキュリティコード, expire: 有効時間情報, timeout: タイムアウト結果(true or false)}
  var _authAccountCode = function(name, accountCode, code) {
    try {
      var key = fcipher.key(accountCode, name);
      var ret = fcipher.dec(code, key, _UACCESS_ACCOUNT_CODE_KEY_HEADER);
      ret = JSON.parse(ret);
      ret.timeout = ret.expire < Date.now();
      return ret;
    } catch(e) {
      throw new Error("ユーザアカウントコードの認証に失敗しました")
    }
  }

  // 指定ユーザのアカウントコードを生成.
  // name ユーザ名を設定します.
  //
  // 戻り値: 対象ユーザのアカウントコードが返却されます.
  var _createAccountCode = function(name) {
    var code = uniqueId.code64(uniqueId.getId(_UACCESS_ACCOUNT_CODE_LENGTH));
    file.writeByString(_getAccountFolder(name, true), code);
    return code;
  }

  // 指定ユーザのアカウントコードを削除.
  // name ユーザ名を設定します.
  // 
  // 戻り値: 処理結果が返却されます.
  var _removeAccountCode = function(name) {
    return file.removeFile(_getAccountFolder(name));
  }

  // 指定ユーザのアカウントコードを取得.
  // name ユーザ名を設定します.
  // 
  // 戻り値: アカウントコードが返されます.
  var _getAccountCode = function(name) {
    var fileName = _getAccountFolder(name);
    if(file.isFile(fileName)) {
      return file.readByString(fileName);
    } else {
      return "";
    }
  }

  // 登録されているアカウントコードのユーザID一覧を取得.
  // pos 取得ポジションを設定します.
  // endLen 取得サイズを設定します.
  // 
  // 戻り値: [ユーザ名, ユーザ名 .... ]のリストが返却されます.
  var _listAccountCode = function(pos, endLen) {
    pos = ((pos|0) <= 0) ? 0 : (pos|0);
    endLen = ((endLen|0) <= 0) ? -1 : (endLen|0);
    var list = file.list(_UACCESS_FOLDER);
    if(list) {
      var p = -1;
      var name = null;
      var parentFolder = "";
      var headFolder = "";
      var innerList = null;
      var accontList = null;
      var ret = [];
      var len = list.length;
      var count = 0;
      var off = 0;
      for(var i =0 ; i < len; i ++) {
        name = list[i];
        parentFolder = _UACCESS_FOLDER + "/" + name + "/";
        var innerList = file.list(parentFolder);
        if(innerList) {
          var lenJ = innerList.length;
          for(var j = 0; j < lenJ; j ++) {
            name = innerList[j];
            headFolder = parentFolder + name + "/";
            accontList = file.list(headFolder);
            if(accontList && accontList.length > 0) {
              if(off >= pos) {
                name = accontList[0];
                accontList = null;
                p = name.lastIndexOf(_UACCESS_ACCOUNT_CODE_PLUS);
                if (p != -1 && p == name.length - _UACCESS_ACCOUNT_CODE_PLUS_LEN) {
                  ret.push(name.substring(0,name.length - _UACCESS_ACCOUNT_CODE_PLUS_LEN));
                  count ++;
                  if(endLen != -1 && count >= endLen) {
                    return ret;
                  }
                }
              }
              off ++;
            }
          }
        }
        innerList = null;
      }
      return ret;
    }
    return [];
  }

  // 指定されたアカウント名が登録されているかチェック.
  // name アカウント名を設定します.
  // 
  // 戻り値 [true]の場合、アカウント名が登録されています.
  var _isAccountCode = function(name) {
    var fileName = _getAccountFolder(name);
    return file.isFile(fileName);
  }

  // 管理者コードロック名.
  var _ADMIN_CODE_LOCK = "@" + _UACCESS_ADMIN_CODE_FILE;

  // セキュリティコードロック名.
  var _SECURITY_CODE_LOCK = "@" + _UACCESS_SECURITY_CODE_FILE;

  // ユーザアカウントコードロック名.
  var _ACCOUNT_CODE_LOCK = "@" + _UACCESS_ACCOUNT_CODE_PLUS;

  // 管理者アクセス用認証用シグニチャ.
  var _UACCESS_ADMIN_ACCESS_SIGNATURES = "x-uaccess-admin-access-signatures";

  // 管理者アクセス用コード認証.
  var _authAdminAccess = function(req) {
    var code = req.headers[_UACCESS_ADMIN_ACCESS_SIGNATURES];
    // 書き込み許可シグニチャが存在しない場合.
    if(!code || code == "") {
      return false;
    }
    var res = _isAuthAdminAccessCode(serverId, code);
    if(res.timeout) {
      // コードの有効期限外の場合.
      return false;
    }
    return true;
  }

  // 管理者認証用シグニチャ.
  var _UACCESS_ADMIN_SIGNATURES = "x-uaccess-admin-signatures";

  // 管理者コード認証.
  var _authAdmin = function(req, call, errorCall, lockTimeout) {
    if(!errorCall) {
      errorCall = call;
    }
    var accountName = _topFolderName(_getUrl(req));
    var code = req.headers[_UACCESS_ADMIN_SIGNATURES];
    // 書き込み許可シグニチャが存在しない場合.
    if(!code || code == "") {
      // エラー処理.
      errorCall(false);
      return;
    }
    // 読み込みロック.
    psync.readLock(_ADMIN_CODE_LOCK, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          ret = false;
        } else {
          // 管理者認証.
          var res = _authAdminCode(accountName, code);
          if(res.timeout) {
            // コードの有効期限外の場合.
            ret = false;
          }
          // 管理者コードが存在するかチェック.
          else if(!_isAdminCode(res.adminCode)) {
            // 対象の管理者コードが非存在.
            ret = false;
          }
        }
      } catch(e) {
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(_ADMIN_CODE_LOCK);
      }
      // ロック解除後に、処理実行する.
      _execCall(ret, call, errorCall);
      call = null; errorCall = null;
    });
  }

  // アクセス許可シグニチャ.
  var _UACCESS_SIGNATURES = "x-uaccess-signatures";

  // アカウント認証.
  // 認証に成功した場合は[true]が設定されます.
  var _authAccount = function(req, call, errorCall, lockTimeout) {
    if(!errorCall) {
      errorCall = call;
    }
    var accountName = _topFolderName(_getUrl(req));
    var code = req.headers[_UACCESS_SIGNATURES];
    // 書き込み許可シグニチャが存在しない場合.
    if(!code || code == "") {
      // エラー処理.
      errorCall(false);
      return;
    }
    // 読み込みロック.
    psync.readLock(_ACCOUNT_CODE_LOCK, lockTimeout, function(successFlag) {
      var ret = true;
      var unlockFlag = false;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          ret = false;
        } else {
          // アカウントコードを取得.
          var accountCode = _getAccountCode(accountName);
          if(accountCode == "") {
            // アカウントコードが存在しない.
            ret = false;
          } else {
            // アカウント認証.
            var res = _authAccountCode(accountName, accountCode, code);
            if(res.timeout) {
              // コードの有効期限外の場合.
              ret = false;
            }
            // 正常処理が続いている場合.
            if(ret) {

              // セキュリティコードの読み込みなので、今のロックを解除する.
              unlockFlag = true;
              psync.readUnLock(_ACCOUNT_CODE_LOCK);

              // セキュリティコードの読み込みロック.
              psync.readLock(_SECURITY_CODE_LOCK, lockTimeout, function(successFlag) {
                // 受け取った情報に対して、登録されたセキュリティコードが存在するかチェックする.
                try {
                  // ロックタイムアウト.
                  if(!successFlag) {
                    ret = false;
                  // 指定したセキュリティコードが存在するかチェック.
                  } else if(!_isSecurityCode(res.securityCode)) {
                    // セキュリティコード非存在.
                    ret = false;
                  }
                } catch(e) {
                  ret = false;
                } finally {
                  // アンロック.
                  psync.readUnLock(_SECURITY_CODE_LOCK);
                }
                // アンロック後に行う.
                _execCall(ret, call, errorCall);
                call = null; errorCall = null;
              });
              return true;
            }
          }
        }
      } catch(e) {
        ret = false;
      } finally {
        // アンロック.
        if(!unlockFlag) {
          psync.readUnLock(_ACCOUNT_CODE_LOCK);
        }
      }
      // アンロック後に行う.
      _execCall(ret, call, errorCall);
      call = null; errorCall = null;
      return ret;
    });
  }

  // authAccountは、外部利用なので、外部公開する.
  o.authAccount = _authAccount;

  // 管理者アクセス認証コードを生成.
  // expire 認証キーの期限を設定します.
  //
  // 戻り値: パックされた管理者アクセス認証コードが作成されます.
  o.createAuthAdminAccessCode = function(expire) {
    return _createAuthAdminAccessCode(serverId, expire);
  }

  // 管理者認証コードを生成.
  // name 処理対象のユーザ名を設定します.
  // adminCode 管理者コードを設定します.
  // expire 認証キーの期限を設定します.
  //
  // 戻り値: パックされた管理者認証コードが作成されます.
  o.createAuthAdminCode = function(userName, adminCode, expire) {
    return _createAuthAdminCode(userName, adminCode, expire)
  }

  // ユーザアカウントコード認証コードを作成.
  // name ユーザ名を設定します.
  // accountCode このユーザのアカウントコードを設定します.
  // securityCode セキュリティコードを設定します.
  // expire 認証キーの期限を設定します.
  //
  // 戻り値: パックされたユーザアカウント認証コードが作成されます.
  o.createAuthAccountCode = function(name, accountCode, securityCode, expire) {
    return _createAuthAccountCode(name, accountCode, securityCode, expire);
  }

  // uaccess: 処理タイムアウト.
  var _UACCESS_TIMEOUT = "x-uaccess-timeout";

  // uaccess: 処理区分.
  var _UACCESS_TYPE = "x-uaccess-type";

  // uaccess: パラメータ情報.
  var _UACCESS_PARAMS = "x-uaccess-params";

  // 書き込み処理ベース.
  var _baseWrite = function(req, res, lockTimeout, lockName, call) {
    psync.lock(lockName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          ret = call();
        }
      } catch(e) {
        httpCore.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.unLock(lockName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 書き込み処理ベース.
  var _baseRead = function(req, res, lockTimeout, lockName, call) {
    psync.readLock(lockName, lockTimeout, function(successFlag) {
      var ret = true;
      try {
        // ロックタイムアウト.
        if(!successFlag) {
          _errorLockTimeout(url, res, notCache, closeFlag);
          ret = false;
        // 正常処理.
        } else {
          ret = call();
        }
      } catch(e) {
        httpCore.errorFileResult(500, e, res, closeFlag);
        ret = false;
      } finally {
        // アンロック.
        psync.readUnLock(lockName);
        if(!ret) {
          // リクエストを閉じる.
          _closeReq(req);
        }
      }
      return ret;
    });
  }

  // 管理者ユーザ認証コードがセットされていないかチェック.
  var __authAdminAccess = function(req, res) {
    // 管理者ユーザ認証コードがセットされていない場合.
    if(!_authAdminAccess(req)) {
      _errorJSON(res, "管理者コードにアクセスできません", 401);
      return false;
    }
    return true;
  }

  // 新しい管理者コードを生成.
  var _UACCESS_TYPE_CREATE_ADMIN_CODE = "create_admin_code";

  // 管理者コードを削除.
  var _UACCESS_TYPE_REMOVE_ADMIN_CODE = "remove_admin_code";

  // 管理者コードの一覧を取得.
  var _UACCESS_TYPE_GET_LIST_ADMIN_CODE = "get_list_admin_code";

  // 最新の管理者コードを取得.
  var _UACCESS_TYPE_GET_ADMIN_CODE = "get_admin_code";

  // 管理者コードの一番古いコードを削除.
  var _UACCESS_TYPE_REMOVE_OLD_ADMIN_CODE = "remove_old_admin_code";

  // 新しい管理者コードを生成
  o.createAdminCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseWrite(req, res, lockTimeout, _ADMIN_CODE_LOCK, function() {
      _successJSON(res, "新しい管理者コード作成しました", _addAdminCode());
      return true;
    })
  }

  // 管理者コードを削除.
  o.removeAdminCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    var code = req.headers[_UACCESS_PARAMS];
    _baseWrite(req, res, lockTimeout, _ADMIN_CODE_LOCK, function() {
      if(_removeAdminCode(code)) {
        _successJSON(res, "管理者コードの削除に成功しました");
      } else {
        _errorJSON(res, "管理者コードの削除に失敗しました");
      }
      return true;
    })
  }

  // 管理者コード一覧を取得..
  o.getAdminCodeList = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseRead(req, res, lockTimeout, _ADMIN_CODE_LOCK, function() {
      _successJSON(res, "管理者コードの一覧取得に成功しました", _getAdminCodeList());
      return true;
    })
  }

  // 最新の管理者コードを削除.
  o.getAdminCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseRead(req, res, lockTimeout, _ADMIN_CODE_LOCK, function() {
      var code = _getAdminCode();
      if(code) {
        _successJSON(res, "最新の管理者コードの取得に成功しました", code);
      } else {
        _errorJSON(res, "最新の管理者コードの取得に失敗しました");
      }
      return true;
    })
  }

  // 一番古い管理者コードを削除.
  o.removeOldAdminCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseWrite(req, res, lockTimeout, _ADMIN_CODE_LOCK, function() {
      if(_removeOldAdminCode()) {
        _successJSON(res, "一番古い管理者コードの削除に成功しました");
      } else {
        _errorJSON(res, "一番古い管理者コードの削除に失敗しました");
      }
      return true;
    })
  }

  // 新しいセキュリティコードを生成.
  var _UACCESS_TYPE_CREATE_SECURITY_CODE = "create_security_code";

  // セキュリティコードを削除.
  var _UACCESS_TYPE_REMOVE_SECURITY_CODE = "remove_security_code";

  // セキュリティコードの一覧を取得.
  var _UACCESS_TYPE_GET_LIST_SECURITY_CODE = "get_list_security_code";

  // 最新のセキュリティコードを取得.
  var _UACCESS_TYPE_GET_SECURITY_CODE = "get_security_code";

  // 一番古いセキュリティコードを削除.
  var _UACCESS_TYPE_REMOVE_OLD_SECURITY_CODE = "remove_old_security_code";

  // 新しいセキュリティコードを生成
  o.createSecurityCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseWrite(req, res, lockTimeout, _SECURITY_CODE_LOCK, function() {
      _successJSON(res, "新しいセキュリティコード作成しました", _addSecurityCode())
      return true;
    })
  }

  // セキュリティコードを削除.
  o.removeSecurityCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    var code = req.headers[_UACCESS_PARAMS];
    _baseWrite(req, res, lockTimeout, _SECURITY_CODE_LOCK, function() {
      if(_removeSecurityCode(code)) {
        _successJSON(res, "セキュリティコードの削除に成功しました");
      } else {
        _errorJSON(res, "セキュリティコードの削除に失敗しました");
      }
      return true;
    })
  }

  // セキュリティコード一覧を取得.
  o.getSecurityCodeList = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseRead(req, res, lockTimeout, _SECURITY_CODE_LOCK, function() {
      _successJSON(res, "セキュリティコードの一覧取得に成功しました", _getSecurityCodeList());
      return true;
    })
  }

  // 最新のセキュリティコードを削除.
  o.getSecurityCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseRead(req, res, lockTimeout, _SECURITY_CODE_LOCK, function() {
      var code = _getSecurityCode();
      if(code) {
        _successJSON(res, "最新のセキュリティコードの取得に成功しました", code);
        return true;
      }
      _errorJSON(res, "最新のセキュリティコードの取得に失敗しました");
      return false;
    })
  }

  // 一番古いセキュリティコードを削除.
  o.removeOldSecurityCode = function(req, res, lockTimeout) {
    if(!__authAdminAccess(req, res)) {
      return false;
    }
    _baseWrite(req, res, lockTimeout, _SECURITY_CODE_LOCK, function() {
      if(_removeOldSecurityCode()) {
        _successJSON(res, "一番古いセキュリティコードの削除に成功しました");
        return true;
      }
      _errorJSON(res, "一番古いセキュリティコードの削除に失敗しました");
      return false;
    })
  }

  // uaccess: ユーザアカウントコードを生成.
  var _UACCESS_TYPE_CREATE_ACCOUNT_CODE = "create_account_code";

  // uaccess: ユーザアカウントコードを削除.
  var _UACCESS_TYPE_REMOVE_ACCOUNT_CODE = "remove_account_code";

  // uaccess: ユーザアカウントコードを取得.
  var _UACCESS_TYPE_GET_ACCOUNT_CODE = "get_account_code";

  // uaccess: ユーザアカウントコード一覧を取得.
  var _UACCESS_TYPE_LIST_ACCOUNT_CODE = "list_account_code";

  // uaccess: ユーザアカウントコードの存在チェック.
  var _UACCESS_TYPE_IS_ACCOUNT_CODE = "is_account_code";

  // 新しいユーザアカウントコードを生成・更新.
  o.createAccountCode = function(req, res, lockTimeout) {
    // 管理者コード認証.
    _authAdmin(req, function(result) {
      if(result) {
        var userName = _topFolderName(_getUrl(req));
        _baseWrite(req, res, lockTimeout, _ACCOUNT_CODE_LOCK, function() {
          _successJSON(res, "新しいユーザアカウントコードの生成に成功しました", _createAccountCode(userName));
          return true;
        });
        return true;
      }
      _errorJSON(res, "新しいユーザアカウントコードの生成に失敗しました", 401);
      return false;
    }, null, lockTimeout);
  }

  // ユーザアカウント情報を削除.
  o.removeAccountCode = function(req, res, lockTimeout) {
    // 管理者コード認証.
    _authAdmin(req, function(result) {
      if(result) {
        var userName = _topFolderName(_getUrl(req));
        _baseWrite(req, res, lockTimeout, _ACCOUNT_CODE_LOCK, function() {
          if(_removeAccountCode(userName)) {
            _successJSON(res, "ユーザアカウント情報の削除に成功しました");
            return true;
          }
          _errorJSON(res, "ユーザアカウント情報の削除に失敗しました");
          return false;
        });
        return true;
      }
      _errorJSON(res, "ユーザアカウント情報の削除に失敗しました", 401);
      return false;
    }, null, lockTimeout);
  }

  // ユーザアカウント情報を取得.
  o.getAccountCode = function(req, res, lockTimeout) {
    // 管理者コード認証.
    _authAdmin(req, function(result) {
      if(result) {
        var userName = _topFolderName(_getUrl(req));
        _baseRead(req, res, lockTimeout, _ACCOUNT_CODE_LOCK, function() {
          var code = _getAccountCode(userName);
          if(code != "") {
            _successJSON(res, "ユーザアカウント情報の取得に成功しました", code);
            return true;
          }
          _errorJSON(res, "ユーザアカウント情報の取得に失敗しました");
          return false;
        });
        return true;
      }
      _errorJSON(res, "ユーザアカウント情報の取得に失敗しました", 401);
      return false;
    }, null, lockTimeout);
  }

  // ユーザアカウント情報を取得.
  o.listAccountCode = function(req, res, lockTimeout) {
    // 管理者コード認証.
    _authAdmin(req, function(result) {
      if(result) {
        _baseRead(req, res, lockTimeout, _ACCOUNT_CODE_LOCK, function() {
          _successJSON(res, "ユーザアカウント一覧情報の取得に成功しました", _listAccountCode());
          return true;
        });
        return true;
      }
      _errorJSON(res, "ユーザアカウント一覧情報の取得に失敗しました", 401);
      return false;
    }, null, lockTimeout);
  }

  // ユーザアカウント情報を取得.
  o.isAccountCode = function(req, res, lockTimeout) {
    // 管理者コード認証.
    _authAdmin(req, function(result) {
      if(result) {
        var userName = _topFolderName(_getUrl(req));
        _baseRead(req, res, lockTimeout, _ACCOUNT_CODE_LOCK, function() {
          _successJSON(res, "ユーザアカウント情報の存在確認", "" + _isAccountCode(userName));
          return true;
        });
        return true;
      }
      _errorJSON(res, "ユーザアカウント情報の存在確認の取得に失敗しました", 401);
      return false;
    }, null, lockTimeout);
  }

  // httpアクセスからの、uaccess実行確認.
  o.isExecute = function(req) {
    try {
      var executeType = req.headers[_UACCESS_TYPE];
      var method = req.method.toLowerCase();

      if(executeType && method == "get") {
        // 実行処理.
        switch(executeType) {
          case _UACCESS_TYPE_CREATE_ADMIN_CODE:
          case _UACCESS_TYPE_REMOVE_ADMIN_CODE:
          case _UACCESS_TYPE_GET_LIST_ADMIN_CODE:
          case _UACCESS_TYPE_GET_ADMIN_CODE:
          case _UACCESS_TYPE_REMOVE_OLD_ADMIN_CODE:
          case _UACCESS_TYPE_CREATE_SECURITY_CODE:
          case _UACCESS_TYPE_REMOVE_SECURITY_CODE:
          case _UACCESS_TYPE_GET_LIST_SECURITY_CODE:
          case _UACCESS_TYPE_GET_SECURITY_CODE:
          case _UACCESS_TYPE_REMOVE_OLD_SECURITY_CODE:
          case _UACCESS_TYPE_CREATE_ACCOUNT_CODE:
          case _UACCESS_TYPE_REMOVE_ACCOUNT_CODE:
          case _UACCESS_TYPE_GET_ACCOUNT_CODE:
          case _UACCESS_TYPE_LIST_ACCOUNT_CODE:
          case _UACCESS_TYPE_IS_ACCOUNT_CODE:
            return true;
        }
      }
    } catch(e) {}
    return false;
  }

  // httpアクセスからの、uaccess実行.
  o.execute = function(req, res) {
    try {
      var executeType = req.headers[_UACCESS_TYPE];
      var lockTimeout = req.headers[_UACCESS_TIMEOUT];
      var method = req.method.toLowerCase();

      // get以外のメソッドはエラー400にする.
      if(method != "get") {
        _errorJSON(res, "bad request.", 400);
        return;
      }

      // 実行処理.
      switch(executeType) {
      case _UACCESS_TYPE_CREATE_ADMIN_CODE:
        return this.createAdminCode(req, res, lockTimeout);
      case _UACCESS_TYPE_REMOVE_ADMIN_CODE:
        return this.removeAdminCode(req, res, lockTimeout);
      case _UACCESS_TYPE_GET_LIST_ADMIN_CODE:
        return this.getAdminCodeList(req, res, lockTimeout);
      case _UACCESS_TYPE_GET_ADMIN_CODE:
        return this.getAdminCode(req, res, lockTimeout);
      case _UACCESS_TYPE_REMOVE_OLD_ADMIN_CODE:
        return this.removeOldAdminCode(req, res, lockTimeout);
      case _UACCESS_TYPE_CREATE_SECURITY_CODE:
        return this.createSecurityCode(req, res, lockTimeout);
      case _UACCESS_TYPE_REMOVE_SECURITY_CODE:
        return this.removeSecurityCode(req, res, lockTimeout);
      case _UACCESS_TYPE_GET_LIST_SECURITY_CODE:
        return this.getSecurityCodeList(req, res, lockTimeout);
      case _UACCESS_TYPE_GET_SECURITY_CODE:
        return this.getSecurityCode(req, res, lockTimeout);
      case _UACCESS_TYPE_REMOVE_OLD_SECURITY_CODE:
        return this.removeOldSecurityCode(req, res, lockTimeout);
      case _UACCESS_TYPE_CREATE_ACCOUNT_CODE:
        return this.createAccountCode(req, res, lockTimeout);
      case _UACCESS_TYPE_REMOVE_ACCOUNT_CODE:
        return this.removeAccountCode(req, res, lockTimeout);
      case _UACCESS_TYPE_GET_ACCOUNT_CODE:
        return this.getAccountCode(req, res, lockTimeout);
      case _UACCESS_TYPE_LIST_ACCOUNT_CODE:
        return this.listAccountCode(req, res, lockTimeout);
      case _UACCESS_TYPE_IS_ACCOUNT_CODE:
        return this.isAccountCode(req, res, lockTimeout);
      }
      _errorJSON(res, "ヘッダ:" + _UACCESS_TYPE + " の値は存在しないか、内容が不正です:" + executeType);
    } catch(e) {
      httpCore.errorFileResult(500, e, res, closeFlag);
    }
  }

  // コマンド用の条件をセット.
  // notCmdFlgの場合は処理できない.
  var cmd = {};
  o.cmd = cmd;

  // コマンド実行可能かチェック.
  // 戻り値: trueの場合実行可能です.
  cmd.isCmd = function() {
    return !notCmdFlg;
  }

  // コマンド実行可能で無い場合、エラー返却.
  var _chkNotCmd = function() {
    if(notCmdFlg) {
      throw new Error("コマンド実行できません");
    }
  }

  // パスコードの登録.
  cmd.createPassCode = function(code) {
    _chkNotCmd();
    _setPassCode(code);
  }

  // パスコードの取得.
  cmd.getPassCode = function() {
    _chkNotCmd();
    return _getPassCode();
  }

  // adminコードの追加.
  cmd.addAdminCode = function() {
    _chkNotCmd();
    return _addAdminCode();
  }

  // adminコードの削除.
  cmd.removeAdminCode = function(code) {
    _chkNotCmd();
    return _removeAdminCode(code);
  }

  // adminコードのリスト.
  cmd.getAdminCodeList = function() {
    _chkNotCmd();
    return _getAdminCodeList();
  }

  // securityコードの追加.
  cmd.addSecurityCode = function() {
    _chkNotCmd();
    return _addSecurityCode();
  }

  // securityコードの削除.
  cmd.removeSecurityCode = function(code) {
    _chkNotCmd();
    return _removeSecurityCode(code);
  }

  // securityコードのリスト.
  cmd.getSecurityCodeList = function() {
    _chkNotCmd();
    return _getSecurityCodeList();
  }

  // ユーザアカウントコードを設定.
  cmd.createAccountCode = function(name) {
    _chkNotCmd();
    return _createAccountCode(name);
  }

  // ユーザアカウントコードを削除.
  cmd.removeAccountCode = function(name) {
    _chkNotCmd();
    return _removeAccountCode(name);
  }

  // ユーザアカウントコードを設定.
  cmd.getAccountCode = function(name) {
    _chkNotCmd();
    return _getAccountCode(name);
  }

  // ユーザアカウントリストを取得.
  cmd.listAccountCode = function() {
    _chkNotCmd();
    return _listAccountCode();
  }

  return o;
};
