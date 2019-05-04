// テスト.



  // 基本キーコード.
  var _KEYCODE = "_#cbox_$_UaccExce8s%Uu1d$_C0d3#_";

  // 管理者アクセスコードヘッダ.
  var _UACCESS_ADMIN_CODE_HEADER = "_uaccess_admin_";

  // uuid を設定して、管理者アクセスコードを取得.
  // uuid: アクセスコード生成用のUUIDをセット.
  // expire: このアクセスコードの有効期間を設定(ミリ秒).
  // 
  // 戻り値: 変換されたアクセスコード有効時間情報が返却されます.
  var _uuidByAdminAccessCode = function(uuid, expire) {
    expire = parseInt(expire);
    var key = fcipher.key(_KEYCODE, uuid);
    var src = "{\"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ADMIN_CODE_HEADER);
  }

  // 管理者アクセスコードが正しいかチェックして、有効期間を取得(ミリ秒).
  // uuid: 対象のUUIDを設定します.
  // code: 変換されたアクセスコード有効時間情報と設定します.
  // 
  // 戻り値: アクセスコード有効時間情報と、タイムアウト結果が返却されます.
  //         {expire: アクセスコード有効時間情報, timeout: タイムアウト結果(true or false)};
  var _isAdminAccessCode = function(uuid, code) {
    try {
      var key = fcipher.key(_KEYCODE, uuid);
      var res = fcipher.dec(code, key, _UACCESS_ADMIN_CODE_HEADER);
      var expire = JSON.parse(res).expire;
      return {expire: expire, timeout: expire < Date.now()};
    } catch(e) {
      throw new Error("管理者アクセスコードの解析に失敗しました")
    }
  }


  var code = _uuidByAdminAccessCode(serverId, 1000);
  var res = _isAdminAccessCode(serverId, code);

  console.log("code:" + code);
  console.log("expireTime:" + res.expire + " timeout:" + res.timeout);

  console.log(uniqueId.code64(uniqueId.getId(500)));