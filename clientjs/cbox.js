// cbox クライアント.
//

if(!window["global"]) {
  window["global"] = window;
}

(function(_g) {
  'use strict';

  var _u = undefined;

  ////////////////////////////////////////////////////////////////////////////////
  // 通常Ajax処理.
  // method : POST or GET.
  // URL : 接続先URL.
  // params : パラメータ設定(Map定義).
  // func : コールバックファンクション.
  //        コールバックファンクションを設定しない場合は、同期取得(非推奨).
  // errorFunc : エラー発生時のコールバックファンクション.
  // noCache : キャッシュなしの場合は[true].
  // header : ヘッダ情報.
  ////////////////////////////////////////////////////////////////////////////////
  var _ajax = (function(){
    var ie = false ;
    var xdom = false ;
    var ia = 'Msxml2.XMLHTTP' ;
    try {
      new XDomainRequest() ;
      ie = true ;
      xdom = true ;
    } catch( ee ) {
      try {
        new ActiveXObject(ia) ;
        ie = true ;
      } catch( e ) {
      }
    }
    var ax =(function(){
      var a ;
      if( ie ) {
        try {
          a = new XMLHttpRequest() ;
          a = function() { return new XMLHttpRequest() ; }
        } catch( e ) {
        }
        if( a == _u ) {
          try {
            new ActiveXObject( ia+".6.0" ) ;
            a = function() { return new ActiveXObject( ia+".6.0" ) ; } ;
          } catch( e ) {}
        }
        if( a == _u ) {
          try {
            new ActiveXObject( ia+".3.0" ) ;
            a = function() { return new ActiveXObject( ia+".3.0" ) ; } ;
          } catch( e ) {}
        }
        if( a == _u ) {
          try {
            new ActiveXObject( ia ) ;
            a = function() { return new ActiveXObject( ia ) ; } ;
          } catch( e ) {}
        }
        if( a == _u ) {
          a = function() { return new ActiveXObject( "Microsoft.XMLHTTP" ) ; } ;
        }
      }
      if( a == _u ) {
        a = function(){
          return new XMLHttpRequest()
        }
      }
      if( xdom ) {
          return function(d) {
              if( d == 1 ) {
                  var n = new XDomainRequest() ;
                  n.ie = 0 ;
                  return n ;
              }
              return a() ;
          }
      }
      return a ;
    })();
    
    var head = function(m,x,h){
      if(!h["Content-Type"]) {
        if(m=='POST') {
          x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        }
        else if(m=='JSON') {
          x.setRequestHeader('Content-Type', 'application/json');
        }
      }
      if(h) {
        for(var k in h) {
          // コンテンツ長は設定すると警告が出るので居れない.
          if(k != "Content-Length") {
            x.setRequestHeader(k,h[k]);
          }
        }
      }
    }
    var _m=function(m) {
      return m == 'JSON' ? 'POST' : m;
    }
    
    return function(method ,url, params, func, errFunc, noCache, header) {
      method = (method+"").toUpperCase() ;
      if(noCache != true) {
        url += (( url.indexOf( "?" ) == -1 )? "?":"&" )+(new Date().getTime()) ;
      }
      var pms = "" ;
      if( params ) {
        if( typeof( params ) == "string" ||
          params instanceof Blob || params instanceof File ||
          params instanceof Uint8Array || params instanceof ArrayBuffer) {
          pms = params ;
        }
        else {
          var cnt = 0;
          for( var k in params ) {
              if(cnt != 0) {
                  pms += "&";
              }
              pms += k + "=" + encodeURIComponent( params[ k ] ) ;
              cnt ++;
          }
        }
      }
      if( method == "GET" ) {
        url += pms ;
        pms = null ;
      }
      if( func == _u ) {
        var x=ax();
        x.open(_m(method),url,false);
        head(method,x,header);
        x.send(pms);
        var state = x.status;
        if(state == 0) {
            state = 500;
        }
        var ret = x.responseText;
        x.abort() ;
        if(state < 300) {
            return ret ;
        }
        throw new Error("response status:" + state + " error");
      }
      else {
        var x = ax((/^https?:\/\//i.test(url))?1:0);
        if( x.ie == 0 ) {
          x.onprogress = function() {}
          x.onload = function() {
            try {
              var status = x.status;
              if(!status || status == 0) {
                status = 500;
              }
              if( status < 300 ) {
                func(status,x.responseText) ;
              } else if( errFunc != _u ) {
                errFunc(status,x.responseText) ;
              } else {
                func(status,x.responseText) ;
              }
            } finally {
              x.abort() ;
              x = null;
              func = null;
              errFunc = null;
            }
          }
          if( errFunc != _u ) {
              x.onerror = function() {
                var status = x.status;
                if(!status || status == 0) {
                  status = 500;
                }
                errFunc(status,x.responseText) ;
                x.abort() ;
                x = null;
                func = null;
                errFunc = null;
              }
          } else {
            x.onerror = function() {
              var status = x.status;
              if(!status || status == 0) {
                status = 500;
              }
              func(status,x.responseText) ;
              x.abort() ;
              x = null;
              func = null;
              errFunc = null;
            }
          }
          x.open(_m(method),url);
        }
        else {
          x.open(_m(method),url,true);
          if( ie ) {
            x.onreadystatechange=function(){
              if(x.readyState==4) {
                  try {
                    var status = x.status;
                    if(!status || status == 0) {
                      status = 500;
                    }
                    if( status < 300 ) {
                      func(status,x.responseText) ;
                    } else if( errFunc != _u ) {
                      errFunc(status,x.responseText) ;
                    } else {
                      func(status,x.responseText) ;
                    }
                  } finally {
                    x.abort() ;
                    x = null;
                    func = null;
                    errFunc = null;
                  }
                }
            };
          }
          else {
              x.onload = function(){
                if(x.readyState==4) {
                  try {
                    var status = x.status;
                    if(!status || status == 0) {
                      status = 500;
                    }
                    if( status < 300 ) {
                      func(status,x.responseText) ;
                    } else if( errFunc != _u ) {
                      errFunc(status,x.responseText) ;
                    } else {
                      func(status,x.responseText) ;
                    }
                  } finally {
                    x.abort() ;
                    x = null;
                    func = null;
                    errFunc = null;
                  }
                }
              };
              if( errFunc != _u ) {
                x.onerror = function() {
                  var state = x.status;
                  if(!status || status == 0) {
                    status = 500;
                  }
                  errFunc(status,x.responseText ) ;
                  x.abort() ;
                  x = null;
                  func = null;
                  errFunc = null;
                }
              } else {
                x.onerror = function() {
                  var status = x.status;
                  if(!status || status == 0) {
                    status = 500;
                  }
                  func( status,x.responseText ) ;
                  x.abort() ;
                  x = null;
                  func = null;
                  errFunc = null;
                }
              }
          };
        }
        head(method,x,header);
        x.send(pms);
      }
    };
  })() ;

  // UTF8文字列のバイナリ長を取得.
  var _utf8Length = function (n) {
    var c;
    var ret = 0;
    var len = n.length;
    for (var i = 0; i < len; i++) {
      if ((c = n.charCodeAt(i)) < 128) {
        ret++;
      } else if ((c > 127) && (c < 2048)) {
        ret += 2;
      } else {
        ret += 3;
      }
    }
    return ret;
  }

   // ファイル拡張子からMimeTypeを返却.
   var _mimeType = function (name) {
    var p = name.lastIndexOf(".");
    if (p == -1) {
      return "application/octet-stream";
    }
    var n = name.substring(p + 1)
    switch (n) {
      case "htm": case "html": return "text/html; charset=utf-8;";
      case "xhtml": case "xht": return "application/xhtml+xml; charset=utf-8;";
      case "js": return "text/javascript; charset=utf-8;";
      case "css": return "text/css; charset=utf-8;";
      case "rtf": return "text/rtf";
      case "tsv": return "text/tab-separated-values";
      case "gif": return "image/gif";
      case "jpg": case "jpeg": return "image/jpeg";
      case "png": return "image/png";
      case "svg": return "image/svg+xml";
      case "rss": case "xml": case "xsl": return "application/xml";
      case "pdf": return "application/pdf";
      case "doc": return "application/msword";
      case "xls": return "application/vnd.ms-excel";
      case "ppt": return "application/vnd.ms-powerpoint";
      case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document docx";
      case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet xlsx";
      case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation pptx";
      case "dtd": return "application/xml-dtd";
      case "sh": return "application/x-sh";
      case "tar": return "application/x-tar";
      case "zip": return "application/zip";
      case "jar": return "application/java-archive";
      case "swf": return "application/x-shockwave-flash";
      case "mpga": case "mp2": case "mp3": return "audio/mpeg";
      case "wma": return "audio/x-ms-wma";
      case "wav": return "audio/x-wav";
      case "3gp": return "video/3gpp";
      case "3g2": return "video/3gpp2";
      case "mpeg": case "mpg": case "mpe": return "video/mpeg";
      case "qt": case "mov": return "video/quicktime";
      case "mxu": case "m4u": return "video/vnd.mpegurl";
      case "asf": case "asx": return "video/x-ms-asf";
      case "avi": return "video/x-msvideo";
      case "wmv": return "video/x-ms-wmv";
      case "flv": return "video/x-flv";
      case "ogg": return "application/ogg";
      case "mpg4": return "video/mp4";
      case "ico": return "image/x-icon";
    }

    // 条件が無い場合.
    return "application/octet-stream";
  }

  // デフォルトURLヘッド(http://domain).
  var DEF_HEAD_URL = location.protocol + "://" + location.host;

  // URLを取得.
  var _getUrl = function(url, head) {
    if(!url || url == "") {
      return null;
    }
    // URLがフルパスの場合はそのまま.
    if(url.indexOf("http://") == 0 || url.indexOf("https://") == 0) {
      return url;
    }
    // 先頭のURLが不正な場合.
    if(url.indexOf("/") != 0) {
      url = "/" + url;
    }
    // http://domain が指定されていない場合は、現在のURLをセット.
    if(!head || head == "") {
      return DEF_HEAD_URL + url;
    }
  }

  // 実行命令ヘッダ.
  var _CBOX_EXECUTE_TYPE = "X-Cbox-Execute-Type";

  // cbox: 処理タイムアウト.
  var _CBOX_EXECUTE_TIMEOUT = "X-Cbox-Execute-Timeout";

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

  // CBOX: 強制ロック会場.
  var _CBOX_EXECUTE_TYPE_FORCED_LOCK = "forced-lock";

  // デフォルト非キャッシュ： キャッシュなし.
  var _DEF_NO_CACHE = true;

  // POSTデータ用送信.
  var _sendPost =  function(url, execType, header, value, noCache, timeout, result, errorResult) {
    
    // URLの整形.
    url = _getUrl(url);

    // urlのmimeタイプを取得.
    var mimeType = _mimeType(url);

    // キャッシュが設定されていない場合.
    if(!noCache) {
      noCache = _DEF_NO_CACHE;
    }

    // 実行命令をセット.
    header[_CBOX_EXECUTE_TYPE] = execType;
    header[_CBOX_EXECUTE_TIMEOUT] = (!timeout) ? "" : "" + timeout;

    // ヘッダ情報をセット.
    header['Content-Type'] = mimeType;
    header['Content-Length'] = _utf8Length(value);
    _ajax("POST", url, value, result, errorResult, noCache, header);
  }

  // postファイルアップロード用送信.
  // urlはフォルダまで.
  var _sendUploadPost = function(url, execType, header, value, noCache, timeout, result, errorResult) {

    // URLの整形.
    url = _getUrl(url);

    // フォルダ名に対して、ファイルアップロードファイル名をセット.
    if(url.lastIndexOf("/") == url.length - 1) {
      url += value.name;
    } else {
      url += "/" + value.name;
    }

    // キャッシュが設定されていない場合.
    if(!noCache) {
      noCache = _DEF_NO_CACHE;
    }
    
    // 実行命令をセット.
    header[_CBOX_EXECUTE_TYPE] = execType;
    header[_CBOX_EXECUTE_TIMEOUT] = (!timeout) ? "" : "" + timeout;
    
    // valueは基本fileアップロードしたものを、情報として処理するようにする.
    // value.file = ファイル情報.
    header['Content-Type'] = value.type;
    header['Content-Length'] = value.size;
    _ajax("POST", url, value, result, errorResult, noCache, header);
  }

  // get送信.
  var _sendGet = function(url, execType, header, params, noCache, timeout, result, errorResult) {

    // URLの整形.
    url = _getUrl(url);

    // キャッシュが設定されていない場合.
    if(!noCache) {
      noCache = _DEF_NO_CACHE;
    }

    header[_CBOX_EXECUTE_TYPE] = execType;
    header[_CBOX_EXECUTE_TIMEOUT] = (!timeout) ? "" : "" + timeout;
    _ajax("GET", url, params, result, errorResult, noCache, header);
  }

  // デフォルトexpire値(１分).
  var _DEF_EXPIRE_TIME = 1000 * 60 * 1;

  // ユーザアカウントコード用ヘッダ名.
  var _UACCESS_ACCOUNT_CODE_KEY_HEADER = "_uaccess_user_account_";

  // アクセス許可シグニチャ.
  var _UACCESS_SIGNATURES = "x-uaccess-signatures";

  // uaccessアクセスアカウント情報.
  var _uaccessAccountName = "a";
  var _uaccessAccountCode = "b";
  var _uaccessSecurityCode = "c";

  // ユーザアカウント認証コードのexpire値.
  var _uaccessExpire = _DEF_EXPIRE_TIME;

  // アカウント名、アカウントID、セキュリティIDをセットする.
  var _setUAccessAccount = function(name, accountCode, securityCode) {
    _uaccessAccountName = name;
    _uaccessAccountCode = accountCode;
    _uaccessSecurityCode = securityCode;
  }

  // ユーザアカウント認証コードの作成.
  var _createAuthAccountCode = function(expire) {
    expire = expire | 0;
    if(expire <= 0) {
      expire = _uaccessExpire;
    }
    var key = fcipher.key(_uaccessAccountCode, _uaccessAccountName);
    var src = "{\"securityCode\": \"" + _uaccessSecurityCode + "\", \"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ACCOUNT_CODE_KEY_HEADER);
  }

  // ユーザアカウント認証コード用ヘッダを生成.
  var _getAuthHeader = function(expire) {
    var ret = {}
    ret[_UACCESS_SIGNATURES] = _createAuthAccountCode(expire);
    return ret;
  }

  // オブジェクト.
  var o = {};

  // ユーザアカウント認証コードのexpire値を設定.
  o.setUAccessExpire = function(expire) {
    expire = expire | 0;
    if(expire >= 1000) {
      _uaccessExpire = expire;
    }
  }

  // ユーザアカウント認証コードのexpire値を取得.
  o.getUAccessExpire = function() {
    return _uaccessExpire;
  }

  // ユーザアカウント認証コード生成用情報の作成.
  o.setUAccessAccount = function(name, accountCode, securityCode) {
    _setUAccessAccount(name, accountCode, securityCode);
  }

  // フォルダ作成.
  o.createFolder = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_CREATE_FOLDER, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  // フォルダ削除.
  // フォルダ配下は全削除します.
  o.removeFolder = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_REMOVE_FOLDER, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }
  
  // [HTML5のFileオブジェクト]を使ってファイルアップロードでファイル登録・更新.
  // urlはフォルダまで.
  o.updateFile = function(url, value, result, errorResult, noCache, timeout) {
    _sendUploadPost(url, _CBOX_EXECUTE_TYPE_CREATE_FILE, _getAuthHeader(), value, noCache, timeout, result, errorResult);
  }

  // データアップロードでファイル登録・更新.
  // url の拡張子でmimeTypeの設定が可能.
  o.updateData = function(url, value, result, errorResult, noCache, timeout) {
    _sendPost(url, _CBOX_EXECUTE_TYPE_CREATE_FILE, _getAuthHeader(), value, noCache, timeout, result, errorResult);
  }

  // ファイル取得.
  o.getFile = function(url, result, errorResult, noCache, timeout) {
    // キャッシュが設定されていない場合.
    if(!noCache) {
      
      // getFileの場合のみ、キャッシュ条件が設定されていない場合[キャッシュなし]で処理する.
      noCache = false;
    }
    _sendGet(url, _CBOX_EXECUTE_TYPE_GET_FILE, {}, null, noCache, timeout, result, errorResult);
  }

  // ファイル削除.
  o.removeFile = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_REMOVE_FILE, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  // フォルダ配下のリスト一覧取得.
  o.getList = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_LIST, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  // 指定ファイルが存在するかチェック.
  o.isFile = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_IS_FILE, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  // 指定フォルダが存在するかチェック.
  o.isFolder = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_IS_FOLDER, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  // 指定ファイル・フォルダのロック状態を取得.
  o.isLock = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_IS_LOCK, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  // 指定ファイル・フォルダのロック状態を取得.
  o.forcedLock = function(url, result, errorResult, noCache, timeout) {
    _sendGet(url, _CBOX_EXECUTE_TYPE_FORCED_LOCK, _getAuthHeader(), null, noCache, timeout, result, errorResult);
  }

  _g.cbox = o;
})(global);