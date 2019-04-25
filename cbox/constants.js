// cbox 定義群.
//

module.exports = (function () {
  'use strict';
  
  var o = {};
  
  // バージョン.
  o.VERSION = "0.0.1";
  
  // アプリ名.
  o.NAME = "cbox";
  
  // アプリ詳細名.
  o.DETAIL_NAME="content box";
  
  // copyright.
  o.COPY_RIGHT = "Copyright(c) 2019 maachang.";

  // サーバ名.
  o.SERVER_NAME = "" + o.NAME + "(" + o.VERSION + ")";

  // コンフィグフォルダ.
  o.CONF_DIR = "./conf";
  
  // デフォルトバインドポート.
  o.PORT = 3210;

  // デフォルトタイムアウト.
  o.TIMEOUT = 15000;

  // 通信キャッシュあり.
  o.NOT_CACHE = false;

  // 通信keepAlive.
  o.CLOSE_FLAG = false;
  
  // タイトル表示.
  o.viewTitle = function(out,enter) {
    enter = !(enter == false) ? "\n" : ""
    out(o.NAME+"(" + o.DETAIL_NAME + ") v" + o.VERSION + enter);
    out(o.COPY_RIGHT + enter);
  };
  
  return o;
})();
