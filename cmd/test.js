// テスト.

var n = uniqueId.getId(128)

console.log("n:" + n);
console.log("code64:" + uniqueId.code64(n));


console.log("argsCmd:" + argsCmd.getParams("string", ["-y", "--yes"]));

psync.async.lock("hoge", null, function(obj, result) {
  console.log("obj: " + obj);
  console.log("lock: " + result);
});