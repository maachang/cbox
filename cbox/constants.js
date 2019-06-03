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

  // ログフォルダ.
  o.LOG_DIR = "./log";
  
  // デフォルトバインドポート.
  o.PORT = 3210;

  // デフォルトタイムアウト.
  o.TIMEOUT = 15000;

  // 通信キャッシュあり.
  o.NOT_CACHE = false;

  // 通信keepAlive.
  o.CLOSE_FLAG = false;

  // 環境変数: バインドポート.
  o.ENV_PORT = "CBOX_PORT";

  // 環境変数: 通信タイムアウト.
  o.ENV_TIMEOUT = "CBOX_TIMEOUT";

  // 環境変数: 実行環境.
  o.ENV_ENV = "CBOX_ENV";

  // 環境変数: 通信キャッシュ.
  o.ENV_NOT_CACHE ="CBOX_NOT_CACHE";

  // 環境変数: 通信クローズ.
  o.ENV_CLOSE_FLAG = "CBOX_CLOSE_FLAG";

  // デフォルト実行環境名.
  o.DEFAULT_ENV = "development";

  // ロガー定義ファイル名.
  o.LOGGER_CONF = "logConf";
  
  // タイトル表示.
  o.viewTitle = function(out,enter) {
    enter = !(enter == false) ? "\n" : ""
    out(o.NAME+"(" + o.DETAIL_NAME + ") v" + o.VERSION + enter);
    out(o.COPY_RIGHT + enter);
  };
  
  return o;
})();
