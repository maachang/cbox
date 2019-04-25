// システムパラメータ.
//
// 起動引数で渡されるもの.
// システムが発行するもの.
// これらの情報と、環境変数から取得されるものなど.
// 
// 他必要な情報を保持します.
//
//

module.exports.create = function(port, timeout, env, serverId, notCache, closeFlag, systemNanoTime) {

  var constants = require("./constants");
  var conf = require("./conf")(constants.CONF_DIR);

  // バインドポート.
  var _PORT = port;
  var _ENV_PORT = "CBOX_PORT";

  // 通信タイムアウト.
  var _TIMEOUT = timeout;
  var _ENV_TIMEOUT = "CBOX_TIMEOUT";

  // 実行環境.
  var _ENV = env;
  var _ENV_ENV = "CBOX_ENV";

  // 通信キャッシュ.
  var _NOT_CACHE = notCache;
  var _ENV_NOT_CACHE ="CBOX_NOT_CACHE";

  // 通信クローズ.
  var _CLOSE_FLAG = closeFlag;
  var _ENV_CLOSE_FLAG = "CBOX_CLOSE_FLAG";

  // サーバ固有ID.
  var _SERVER_ID = serverId;

  // SystemNanoTime.
  var _SYSTEM_NANO_TIME = systemNanoTime;

  var o = {};

  // 現状の動作条件を取得.
  o.getEnvironment = function() {
    if(!_ENV) {
      _ENV = process.env[_ENV_ENV];
      if(!_ENV) {
        // 何も設定されていない場合のデフォルト値.
        _ENV = "development";
      }
    }
    return _ENV;
  }

  // バインドポートを取得.
  o.getPort = function() {
    if(!_PORT) {
      _PORT = process.env[_ENV_PORT];
      if(!_PORT) {
        // 何も設定されていない場合のデフォルト値.
        _PORT = constants.PORT;
      }
    }
    return _PORT;
  }

  // 通信タイムアウトを取得.
  o.getTimeout = function() {
    if(!_TIMEOUT) {
      _TIMEOUT = process.env[_ENV_TIMEOUT];
      if(!_TIMEOUT) {
        // 何も設定されていない場合のデフォルト値.
        _TIMEOUT = constants.TIMEOUT;
      }
    }
    return _TIMEOUT;
  }

  // 通信キャッシュOffを取得.
  o.isNotCache = function() {
    if(!_NOT_CACHE) {
      _NOT_CACHE = process.env[_ENV_NOT_CACHE];
      if(!_NOT_CACHE) {
        // 何も設定されていない場合のデフォルト値.
        _NOT_CACHE = constants.NOT_CACHE;
      }
    }
    return _NOT_CACHE;
  }

  // 通信Close条件を取得.
  o.isCloseFlag = function() {
    if(!_CLOSE_FLAG) {
      _CLOSE_FLAG = process.env[_ENV_CLOSE_FLAG];
      if(!_CLOSE_FLAG) {
        // 何も設定されていない場合のデフォルト値.
        _CLOSE_FLAG = constants.CLOSE_FLAG;
      }
    }
    return _CLOSE_FLAG;
  }

  // serverId固有IDを取得.
  o.getServerId = function() {
    return _SERVER_ID;
  }
  
  // systemNanoTimeを取得.
  o.getSystemNanoTime = function() {
    return _SYSTEM_NANO_TIME;
  }

  // コンフィグ情報を取得.
  o.getConfig = function() {
    return conf;
  }

  // 現状の動作環境のコンフィグを取得.
  o.getEnvConf = function() {
    var env = this.getEnvironment();
    var target = conf.getConfig();
    if(target[env]) {
      return target[env];
    }
    return conf;
  }

  return o;
}