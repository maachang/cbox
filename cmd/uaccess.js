// uaccessコマンド.
//

// 実行パラメータを取得.
var cmd = argsCmd.registrationParams("string", "実行コマンドを設定します", ["-c", "--cmd"]);
var type = argsCmd.registrationParams("string", "実行コマンドタイプを設定します", ["-t", "--type"]);
var value = argsCmd.registrationParams("string", "実行パラメータを設定します", ["-v", "--val", "--value"]);

// uaccessコマンドヘルプ情報.
var help = function() {
  console.log("uaccess コマンド実行")
  console.log(argsCmd.getHelp());
  if(!value || value == "all") {
    console.log("\n [コマンド名一覧]:");
    console.log("  $ cbox cmd uaccess -c help -v [コマンド名] でコマンド詳細.\n");
    console.log("   [cmd] コマンド実行可能かチェック.");
    console.log("   [pass] パスコード操作.");
    console.log("   [admin] 管理者コード操作.");
    console.log("   [security] セキュリティコード操作.");
    console.log("   [account] アカウントコード操作.");

    console.log("\n   [all] 全コマンド表示.");
  }
  if(value == "pass" || value == "all") {
    console.log("\n [passcode コマンド名一覧]:");
    console.log("  $ cbox cmd uaccess -c pass -t [コマンド詳細] -v [パラメータ]\n")
    console.log("   [set] パスコード設定. -v に設定パスコード.");
    console.log("   [remove] パスコード削除.");
    console.log("   [get] パスコード表示.");
  }
  if(value == "admin" || value == "all") {
    console.log("\n [admin コマンド名一覧]:");
    console.log("  $ cbox cmd uaccess -c admin -t [コマンド詳細] -v [パラメータ]\n")
    console.log("   [add] 管理者コード追加.");
    console.log("   [remove] 管理者コード削除. -v に削除用管理者コード.");
    console.log("   [get] 管理者コードリスト一覧.");
  }
  if(value == "security" || value == "all") {
    console.log("\n [security コマンド名一覧]:");
    console.log("  $ cbox cmd uaccess -c security -t [コマンド詳細] -v [パラメータ]\n")
    console.log("   [add] セキュリティコード追加.");
    console.log("   [remove] セキュリティコード削除. -v に削除用セキュリティコード.");
    console.log("   [get] セキュリティコードリスト一覧.");
  }
  if(value == "account" || value == "all") {
    console.log("\n [account コマンド名一覧]:");
    console.log("  $ cbox cmd uaccess -c account -t [コマンド詳細] -v [パラメータ]\n")
    console.log("   [create] アカウントコード作成. -v にアカウント名.");
    console.log("   [remove] アカウントコード削除. -v にアカウント名.");
    console.log("   [get] アカウントに対するコード取得. -v にアカウント名.");
    console.log("   [list] アカウント名一覧.");
  }

  console.log("");
}

// コマンドが設定されていない場合.
cmd = (!cmd || cmd == "") ? "" : cmd;
cmd = cmd.toLowerCase();

// タイプを整形.
type = (!type || type == "") ? "" : type;
type = type.toLowerCase();

// ユーザアクセスコマンド.
var ucmd = uaccess.cmd;

// uaccessコマンドの実行が可能かチェック. 
if(cmd == "cmd") {
  console.log(ucmd.isCmd());
  return true;
}

// リスト形式のコンソール出力用.
var listConsole = function(list) {
  var len = list.length;
  var ret = "";
  for(var i = 0; i < len; i ++) {
    ret += "[" + (i+1) + "]: " + list[i] + "\n";
  }
  return ret;
}

// タイプが追加系.
var typeAdd = function(type) {
  return type == "add" || type == "set";
}

// タイプが生成系.
var typeCreate = function(type) {
  return type == "create" || type == "new";
}

// タイプが生成系.
var typeGet = function(type) {
  return type == "get" || type == "read";
}

// タイプが削除系.
var typeDel = function(type) {
  return type == "clear" || type == "cls" || type == "remove" || type == "rm" || type == "delete" || type == "del";
}

// パスコードの設定、取得.
if(cmd == "ps" || cmd == "pass") {
  if(typeAdd(type)) {
    ucmd.createPassCode(value);
  } else if(typeDel(type)) {
    ucmd.createPassCode("");
  }
  console.log(ucmd.getPassCode());
  return true;
}
// adminコードの設定、取得.
else if(cmd == "ad" || cmd == "admin") {
  if(typeAdd(type)) {
    ucmd.addAdminCode();
  } else if(typeDel(type)) {
    ucmd.removeAdminCode(value);
  }
  console.log(listConsole(ucmd.getAdminCodeList()));
}
// シークレットコードの設定、取得.
else if(cmd == "sec" || cmd == "security") {
  if(typeAdd(type)) {
    ucmd.addSecurityCode();
  } else if(typeDel(type)) {
    ucmd.removeSecurityCode(value);
  }
  console.log(listConsole(ucmd.getSecurityCodeList()));
}
// ユーザアカウントの設定、取得.
else if(cmd == "acc" || cmd == "account") {
  if(typeCreate(type)) {
    console.log(ucmd.createAccountCode(value));
  } else if(typeDel(type)) {
    console.log(ucmd.removeAccountCode(value));
  } else if(typeGet(type)) {
    console.log(ucmd.getAccountCode(value));
  } else {
    console.log(listConsole(ucmd.listAccountCode()));
  }
} else {
  cmd = "help";
}

// ヘルプコマンド.
if(cmd == "h" || cmd == "help") {
  help();
}

return true;