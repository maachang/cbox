// ファイル寿命を監視します.
//

module.exports.create = function(notCache, closeFlag, serverId, systemNanoTime, notCmdFlg) {
  var cbox = require("./cbox").create(notCache, closeFlag, serverId, systemNanoTime, notCmdFlg);

  // ファイル寿命監視開始.
  cbox.expireService();

  // ログ出力.
  console.info("## (File life monitoring service)" + " pid:" + process.pid);
}