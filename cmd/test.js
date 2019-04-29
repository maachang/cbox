// テスト.

psync.async.readLock("hoge", null, function(obj, result) {
  console.log("obj: " + obj);
  console.log("lock: " + result);
});