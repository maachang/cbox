// cbox クライアント.
//

(function(_g) {
  'use strict';

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
      if(m=='POST') {
        x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
      }
      else if(m=='JSON') {
        x.setRequestHeader('Content-Type', 'application/json');
      }
      if(h) {
        for(var k in h) {
          x.setRequestHeader(k,h[k]);
        }
      }
    }
    var _m=function(m) {
      return m == 'JSON' ? 'POST' : m;
    }
    
    return function( method,url,params,func,errFunc,noCache,header ) {
      method = (method+"").toUpperCase() ;
      if(noCache != true) {
        url += (( url.indexOf( "?" ) == -1 )? "?":"&" )+(new Date().getTime()) ;
      }
      var pms = "" ;
      if( params ) {
        if( typeof( params ) == "string" ) {
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

  // 実行命令ヘッダ.
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

  // post通常プレインデータ用送信.
  var _sendPlainPost =  function(url, execType, header, value, noCache, result, errorResult) {
    header[_CBOX_EXECUTE_TYPE] = execType;
    xhr.setRequestHeader('Content-type', "text/plain");
    xhr.setRequestHeader('Content-Length', _utf8Length(value));
    _ajax("POST", url, value, result, errorResult, noCache, header);
  }

  // postファイルアップロード用送信.
  // urlはフォルダまで.
  var _sendUploadPost = function(url, execType, header, value, noCache, result, errorResult) {
    header[_CBOX_EXECUTE_TYPE] = execType;

    // フォルダ名に対して、ファイルアップロードファイル名をセット.
    if(url.lastIndexOf("/") == url.length - 1) {
      url += value.name;
    } else {
      url += "/" + value.name;
    }
    
    // valueは基本fileアップロードしたものを、情報として処理するようにする.
    // value.file = ファイル情報.
    xhr.setRequestHeader('Content-type', value.type);
    xhr.setRequestHeader('Content-Length', value.size);
    _ajax("POST", url, value, result, errorResult, noCache, header);
  }

  // get送信.
  var _sendGet = function(url, execType, header, value, noCache, result, errorResult) {
    header[_CBOX_EXECUTE_TYPE] = execType;
    _ajax("GET", url, value, result, errorResult, noCache, header);
  }

  




})(global);