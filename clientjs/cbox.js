// cbox クライアント.
//

if(!window["global"]) {
  window["global"] = window;
}

(function(_g) {
  'use strict';

  var _u = undefined;

  // 符号化処理.
  var _tally = null;

  // シグニチャー作成用.
  var fcipher = (function() {

    // CustomBase64.
    var CBase64 = (function() {
      var o = {};
      var EQ = '=';
      var ENC_CD = "0123456789+abcdefghijklmnopqrstuvwxyz/ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      var DEC_CD = (function() {
        var src = ENC_CD;
        var ret = {};
        var len = src.length;
        for(var i = 0; i < len; i ++) {
          ret[src[i]] = i;
        }
        return ret;
      })();
      o.encode = function(bin) {
        var i, j, k;
        var allLen = allLen = bin.length ;
        var etc = (allLen % 3)|0;
        var len = (allLen / 3)|0;
        var ary = new Array((len * 4) + ((etc != 0) ? 4 : 0));
        for (i = 0, j = 0, k = 0; i < len; i++, j += 3, k += 4) {
          ary[k] = ENC_CD[((bin[j] & 0x000000fc) >> 2)];
          ary[k + 1] = ENC_CD[(((bin[j] & 0x00000003) << 4) | ((bin[j+1] & 0x000000f0) >> 4))];
          ary[k + 2] = ENC_CD[(((bin[j+1] & 0x0000000f) << 2) | ((bin[j+2] & 0x000000c0) >> 6))];
          ary[k + 3] = ENC_CD[(bin[j+2] & 0x0000003f)];
        }
        switch (etc) {
        case 1:
          j = len * 3;
          k = len * 4;
          ary[k] = ENC_CD[((bin[j] & 0x000000fc) >> 2)];
          ary[k + 1] = ENC_CD[((bin[j] & 0x00000003) << 4)];
          ary[k + 2] = EQ;
          ary[k + 3] = EQ;
          break;
        case 2:
          j = len * 3;
          k = len * 4;
          ary[k] = ENC_CD[((bin[j] & 0x000000fc) >> 2)];
          ary[k + 1] = ENC_CD[(((bin[j] & 0x00000003) << 4) | ((bin[j+1] & 0x000000f0) >> 4))];
          ary[k + 2] = ENC_CD[(((bin[j+1] & 0x0000000f) << 2))];
          ary[k + 3] = EQ;
          break;
        }
        return ary.join('');
      }
      o.decode = function(base64) {
        var i, j, k;
        var allLen = base64.length ;
        var etc = 0 ;
        for (i = allLen - 1; i >= 0; i--) {
          if (base64.charAt(i) == EQ) {
            etc++;
          } else {
            break;
          }
        }
        var len = (allLen / 4)|0;
        var ret = new Uint8Array((len * 3) - etc);
        len -= 1;
        for (i = 0, j = 0, k = 0; i < len; i++, j += 4, k += 3) {
          ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
          ret[k + 1] = (((DEC_CD[base64[j+1]] & 0x0000000f) << 4) | ((DEC_CD[base64[j+2]] & 0x0000003c) >> 2));
          ret[k + 2] = (((DEC_CD[base64[j+2]] & 0x00000003) << 6) | (DEC_CD[base64[j+3]] & 0x0000003f));
        }
        switch (etc) {
        case 0:
          j = len * 4;
          k = len * 3;
          ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
          ret[k + 1] = (((DEC_CD[base64[j+1]] & 0x0000000f) << 4) | ((DEC_CD[base64[j+2]] & 0x0000003c) >> 2));
          ret[k + 2] = (((DEC_CD[base64[j+2]] & 0x00000003) << 6) | (DEC_CD[base64[j+3]] & 0x0000003f));
          break;
        case 1:
          j = len * 4;
          k = len * 3;
          ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
          ret[k + 1] = (((DEC_CD[base64[j+1]] & 0x0000000f) << 4) | ((DEC_CD[base64[j+2]] & 0x0000003c) >> 2));
          break;
        case 2:
          j = len * 4;
          k = len * 3;
          ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
          break;
        }
        return ret;
      }
      return o;
    })();

    // 指定文字の数を取得.
    var _targetCharCount = function(off,src,value) {
      var ret = 0;
      var p;
      while ((p = src.indexOf(value,off)) != -1) {
        ret ++;
        off = p + value.length;
      }
      return ret;
    }

    // 数値チェック.
    // num : チェック対象の情報を設定します.
    // 戻り値 : [true]の場合、文字列情報です.
    var _isNumeric = (function() {
      var _IS_NUMERIC_REG = /[^0-9.0-9]/g;
      return function(num){
        var n = "" + num;
        if (num == null || num == _u) {
          return false;
        } else if(typeof(num) == "number") {
          return true;
        } else if(n.indexOf("-") == 0) {
          n = n.substring(1);
        }
        return !(n.length == 0 || n.match(_IS_NUMERIC_REG)) && !(_targetCharCount(0,n,".")>1);
      }
    })();

    // UTF8文字列を、通常バイナリ(配列)に変換.
    var _utf8ToBinary = function( n,off,len ) {
      var lst = [] ;
      var cnt = 0 ;
      var c ;
      len += off ;
      for( var i = off ; i < len ; i ++ ) {
        c = n.charCodeAt(i)|0;
        if (c < 128) {
          lst[cnt++] = c|0 ;
        }
        else if ((c > 127) && (c < 2048)) {
          lst[cnt++] = (c >> 6) | 192 ;
          lst[cnt++] = (c & 63) | 128 ;
        }
        else {
          lst[cnt++] = (c >> 12) | 224 ;
          lst[cnt++] = ((c >> 6) & 63) | 128 ;
          lst[cnt++] = (c & 63) | 128 ;
        }
      }
      return lst ;
    }

    // バイナリ(配列)をUTF8文字列に変換.
    var _binaryToUTF8 = function( n,off,len ) {
      var c ;
      var ret = "" ;
      len += off ;
      for( var i = off ; i < len ; i ++ ) {
        c = n[i] & 255;
        if (c < 128) {
          ret += String.fromCharCode(c);
        }
        else if ((c > 191) && (c < 224)) {
          ret += String.fromCharCode(((c & 31) << 6) |
            ((n[i+1] & 255) & 63));
          i += 1;
        }
        else {
          ret += String.fromCharCode(((c & 15) << 12) |
            (((n[i+1] & 255) & 63) << 6) |
            ((n[i+2] & 255) & 63));
          i += 2;
        }
      }
      return ret ;
    }

    // xor128演算乱数装置.
    var _Xor128 = function(seet) {
      var r = {v:{a:123456789,b:362436069,c:521288629,d:88675123}};
      
      // シートセット.
      r.setSeet = function(s) {
        if (_isNumeric(s)) {
          var n = this.v;
          s = s|0;
          n.a=s=1812433253*(s^(s>>30))+1;
          n.b=s=1812433253*(s^(s>>30))+2;
          n.c=s=1812433253*(s^(s>>30))+3;
          n.d=s=1812433253*(s^(s>>30))+4;
        }
      }
      
      // 乱数取得.
      r.next = function() {
        var n = this.v;
        var t=n.a;
        var r=t;
        t = ( t << 11 );
        t = ( t ^ r );
        r = t;
        r = ( r >> 8 );
        t = ( t ^ r );
        r = n.b;
        n.a = r;
        r = n.c;
        n.b = r;
        r = n.d;
        n.c = r;
        t = ( t ^ r );
        r = ( r >> 19 );
        r = ( r ^ t );
        n.d = r;
        return r;
      }
      r.nextInt = function() {
        return this.next();
      }
      r.setSeet(seet) ;
      return r;
    }

    // 256フリップ.
    var _flip = function(pause, step) {
      switch (step & 0x00000007) {
      case 1:
        return ((((pause & 0x00000003) << 6) & 0x000000c0) | (((pause & 0x000000fc) >> 2) & 0x0000003f)) & 0x000000ff ;
      case 2:
        return ((((pause & 0x0000003f) << 2) & 0x000000fc) | (((pause & 0x000000c0) >> 6) & 0x00000003)) & 0x000000ff ;
      case 3:
        return ((((pause & 0x00000001) << 7) & 0x00000080) | (((pause & 0x000000fe) >> 1) & 0x0000007f)) & 0x000000ff ;
      case 4:
        return ((((pause & 0x0000000f) << 4) & 0x000000f0) | (((pause & 0x000000f0) >> 4) & 0x0000000f)) & 0x000000ff ;
      case 5:
        return ((((pause & 0x0000007f) << 1) & 0x000000fe) | (((pause & 0x00000080) >> 7) & 0x00000001)) & 0x000000ff ;
      case 6:
        return ((((pause & 0x00000007) << 5) & 0x000000e0) | (((pause & 0x000000f8) >> 3) & 0x0000001f)) & 0x000000ff ;
      case 7:
        return ((((pause & 0x0000001f) << 3) & 0x000000f8) | (((pause & 0x000000e0) >> 5) & 0x00000007)) & 0x000000ff ;
      }
      return pause & 0x000000ff ;
    }

    // 256notフリップ.
    var _nflip = function(pause, step) {
      switch (step & 0x00000007) {
      case 1:
        return ((((pause & 0x0000003f) << 2) & 0x000000fc) | (((pause & 0x000000c0) >> 6) & 0x00000003)) & 0x000000ff ;
      case 2:
        return ((((pause & 0x00000003) << 6) & 0x000000c0) | (((pause & 0x000000fc) >> 2) & 0x0000003f)) & 0x000000ff ;
      case 3:
        return ((((pause & 0x0000007f) << 1) & 0x000000fe) | (((pause & 0x00000080) >> 7) & 0x00000001)) & 0x000000ff ;
      case 4:
        return ((((pause & 0x0000000f) << 4) & 0x000000f0) | (((pause & 0x000000f0) >> 4) & 0x0000000f)) & 0x000000ff ;
      case 5:
        return ((((pause & 0x00000001) << 7) & 0x00000080) | (((pause & 0x000000fe) >> 1) & 0x0000007f)) & 0x000000ff ;
      case 6:
        return ((((pause & 0x0000001f) << 3) & 0x000000f8) | (((pause & 0x000000e0) >> 5) & 0x00000007)) & 0x000000ff ;
      case 7:
        return ((((pause & 0x00000007) << 5) & 0x000000e0) | (((pause & 0x000000f8) >> 3) & 0x0000001f)) & 0x000000ff ;
      }
      return pause & 0x000000ff ;
    }

    // ゼロサプレス.
    var _z2 = function(n) {
      return "00".substring(n.length) + n;
    }

    // 16バイトデータ(4バイト配列４つ)をUUIDに変換.
    // UUIDに変換.
    var _byte16ToUUID = function(n) {
      var a = n[0];
      var b = n[1];
      var c = n[2];
      var d = n[3];

      return _z2((((a & 0xff000000) >> 24) & 0x00ff).toString(16)) +
        _z2(((a & 0x00ff0000) >> 16).toString(16)) +
        _z2(((a & 0x0000ff00) >> 8).toString(16)) +
        _z2(((a & 0x000000ff)).toString(16)) +
        "-" +
        _z2((((b & 0xff000000) >> 24) & 0x00ff).toString(16)) +
        _z2(((b & 0x00ff0000) >> 16).toString(16)) +
        "-" +
        _z2(((b & 0x0000ff00) >> 8).toString(16)) +
        _z2(((b & 0x000000ff)).toString(16)) +
        "-" +
        _z2((((c & 0xff000000) >> 24) & 0x00ff).toString(16)) +
        _z2(((c & 0x00ff0000) >> 16).toString(16)) +
        "-" +
        _z2(((c & 0x0000ff00) >> 8).toString(16)) +
        _z2(((c & 0x000000ff)).toString(16)) +
        _z2((((d & 0xff000000) >> 24) & 0x00ff).toString(16)) +
        _z2(((d & 0x00ff0000) >> 16).toString(16)) +
        _z2(((d & 0x0000ff00) >> 8).toString(16)) +
        _z2(((d & 0x000000ff)).toString(16));
    }

    // ハッシュ計算.
    var fhash = function(code, uuidFlg) {
      var o = null;
      var n = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];
      if(typeof(code) == "string") {
        code = _utf8ToBinary(code, 0, code.length);
      }
      var len = code.length;
      for(var i = 0; i < len; i ++) {
        o = (code[i] & 0x000000ff);
        if((o & 1) == 1) {
          o = _flip(o, o);
        } else {
          o = _nflip(o, o);
        }
        if((i & 1) == 1) {
          n[0] = n[0] + o;
          n[1] = n[1] - (o << 8);
          n[2] = n[2] + (o << 16);
          n[3] = n[3] - (o << 24);
          n[3] = n[3] ^ (o);
          n[2] = n[2] ^ (o << 8);
          n[1] = n[1] ^ (o << 16);
          n[0] = n[0] ^ (o << 24);
          n[0] = (n[3]+1) + (n[0]);
          n[1] = (n[2]-1) + (n[1]);
          n[2] = (n[1]+1) + (n[2]);
          n[3] = (n[0]-1) + (n[3]);
        } else {
          n[3] = n[3] + o;
          n[2] = n[2] - (o << 8);
          n[1] = n[1] + (o << 16);
          n[0] = n[0] - (o << 24);
          n[0] = n[0] ^ (o);
          n[1] = n[1] ^ (o << 8);
          n[2] = n[2] ^ (o << 16);
          n[3] = n[3] ^ (o << 24);
          n[0] = (n[3]+1) - (n[0]);
          n[1] = (n[2]-1) - (n[1]);
          n[2] = (n[1]+1) - (n[2]);
          n[3] = (n[0]-1) - (n[3]);
        }
        n[3] = (n[0]+1) ^ (~n[3]);
        n[2] = (n[1]-1) ^ (~n[2]);
        n[1] = (n[2]+1) ^ (~n[1]);
        n[0] = (n[3]-1) ^ (~n[0]);
      }
    
      // UUIDで返却.
      if(uuidFlg != false) {
        return _byte16ToUUID(n);
      }
      // バイナリで返却.
      return [
        (n[0] & 0x000000ff),
        ((n[0] & 0x0000ff00) >> 8),
        ((n[0] & 0x00ff0000) >> 16),
        (((n[0] & 0xff000000) >> 24) & 0x00ff),
        (n[1] & 0x000000ff),
        ((n[1] & 0x0000ff00) >> 8),
        ((n[1] & 0x00ff0000) >> 16),
        (((n[1] & 0xff000000) >> 24) & 0x00ff),  
        (n[2] & 0x000000ff),
        ((n[2] & 0x0000ff00) >> 8),
        ((n[2] & 0x00ff0000) >> 16),
        (((n[2] & 0xff000000) >> 24) & 0x00ff),  
        (n[3] & 0x000000ff),
        ((n[3] & 0x0000ff00) >> 8),
        ((n[3] & 0x00ff0000) >> 16),
        (((n[3] & 0xff000000) >> 24) & 0x00ff)
      ]
    }

    // 割符コード.
    var tally = (function() {
      var _CODE = [59, 95, 36, 58, 37, 47, 38, 46, 61, 42, 44, 45, 126, 35, 94, 64];
      var _HEAD = 64;
      var _CHECK = 33;
      var _APPEND_CHECK = 124;
      var rand = _Xor128(new Date().getTime()+1) ;
      (function(){
        var n = "";
        var _x = function(a) {return String.fromCharCode(a);}
        for(var i = 0;i < _CODE.length; i ++) n += _x(_CODE[i]);
        _CODE = n;
        _HEAD = _x(_HEAD);
        _CHECK = _x(_CHECK);
        _APPEND_CHECK = _x(_APPEND_CHECK);
      })();
      var o = {};
      
      // エンコード.
      o.enc = function(value, check) {
        if(typeof(check) == "string" && check.length > 0) {
          value += _CHECK + fhash(check);
        }
        value = _utf8ToBinary(value, 0, value.length) ;  
        var i,j,n,m,c,t ;
        var len = value.length ;
        var allLen = ( len << 1 ) + 2 ;
        var v = new Array( allLen ) ;
        
        m = 255 ;
        v[ 0 ] = rand.nextInt() & m ;
        
        for( var i = 0 ; i < len ; i ++ ) {
            v[ 1 + ( i << 1 ) ] = value[ i ] ;
            v[ 2 + ( i << 1 ) ] = rand.nextInt() & m ;
        }
          v[ allLen-1 ] = rand.nextInt() & m ;
          
          len = allLen - 1 ;
          for( i = 0,t = 0 ; i < len ; i += 2 ) {
            n = v[ i ] ;
            if( ( t ++ ) & 1 == 0 ) {
              n = ~n ;
            }
            for( j = i+1 ; j < len ; j += 2 ) {
              v[ j ] = ( v[ j ] ^ n ) & m ;
            }
          }
          n = v[ 0 ] ;
          for( i = 1 ; i < len ; i ++ ) {
            v[ i ] = ( ( i & 1 == 0 ) ?
              v[ i ] ^ n :
              v[ i ] ^ (~n) )
              & m ;
          }
          n = v[ len ] ;
          for( i = len-1 ; i >= 0 ; i -- ) {
            v[ i ] = ( ( i & 1 == 0 ) ?
              v[ i ] ^ (~n) :
              v[ i ] ^ n )
              & m ;
          }
          c = _CODE ;
          var buf = "";
          for( i = 0 ; i < allLen ; i ++ ) {
            n = v[ i ] ;
            for( j = 0 ; j < 2 ; j ++ ) {
              buf += ( c.charAt( ( n & ( 0x0f << ( j << 2 ) ) ) >> ( j << 2 ) ) ) ;
            }
          }
          if(typeof(check) == "string" && check.length > 0) {
            return _HEAD + buf + _APPEND_CHECK;
          }
          return _HEAD + buf;
      }
      
      // デコード.
      o.dec = function( value,check ) {
        var useCheck = false;
        var ret = null;
        try {
          if( !(typeof(value) == "string" && value.length > 0) ||
            value.charAt( 0 ) != _HEAD ||
            value.length & 1 == 0 ) {
            return null ;
          }
          if(value[value.length-1] == _APPEND_CHECK) {
            useCheck = true;
            value = value.substring(0,value.length-1);
          }
          var i,j,k,a,b,c,m,n,t ;
          var len = value.length ;
          var v = new Array( (len-1) >> 1 ) ;
          m = 255 ;
          c = _CODE ;
          for( i = 1,k = 0 ; i < len ; i += 2 ) {
            a = c.indexOf( value.charAt( i ) ) ;
            b = c.indexOf( value.charAt( i+1 ) ) ;
            if( a == -1 || b == -1 ) {
              return null ;
            }
            v[ k ++ ] = ( a | ( b << 4 ) ) & m ;
          }
          len = v.length - 1 ;
          n = v[ len ] ;
          for( i = len-1 ; i >= 0 ; i -- ) {
            v[ i ] = ( ( i & 1 == 0 ) ?
              v[ i ] ^ (~n) :
              v[ i ] ^ n )
              & m ;
          }
          n = v[ 0 ] ;
          for( i = 1 ; i < len ; i ++ ) {
            v[ i ] = ( ( i & 1 == 0 ) ?
              v[ i ] ^ n :
              v[ i ] ^ (~n) )
              & m ;
          }
          for( i = 0,t = 0 ; i < len ; i += 2 ) {
            n = v[ i ] ;
            if( ( t ++ ) & 1 == 0 ) {
              n = ~n ;
            }
            for( j = i+1 ; j < len ; j += 2 ) {
              v[ j ] = ( v[ j ] ^ n ) & m ;
            }
          }
          var cnt = 0 ;
          var vv = new Array( (len>>1)-1 ) ;
          for( i = 1 ; i < len ; i += 2 ) {
            vv[ cnt++ ] = v[ i ] ;
          }
          ret = _binaryToUTF8(vv, 0, vv.length) ;
        } catch(e) {
          throw new Error("Analysis failed.");
        }
        
        if(typeof(check) == "string" && check.length > 0) {
          check = fhash(check);
          var p = ret.lastIndexOf(_CHECK + check);
          if(p == -1 || (ret.length - p) != check.length + 1) {
            throw new Error("Check codes do not match.");
          }
          return ret.substring(0,ret.length-(check.length + 1));
        } else if(useCheck) {
          throw new Error("Analysis failed.");
        }
        return ret;
      }
      return o;
    })();
    _tally = tally;

    // 基本セット.
    var fcipher = {};
    var _head = null;
    var rand = _Xor128(new Date().getTime());
    fcipher.fhash = fhash;

    // ヘッダデータをセット.
    fcipher.head = function(h) {
      _head = h;
    }

    // 指定文字列を保証するキーを生成.
    fcipher.key = function(word, src) {
      if(src == _u || src == null) {
        src = "-l_l-u_f-s_m-";
      }
      var srcBin = code16(src, 1) ;
      var wordBin = code16(word, 1) ;
      var ret = srcBin.concat(wordBin) ;
      for( var i = 0 ; i < 16 ; i ++ ) {
          ret[ i ] = _convert( ret, i, wordBin[ i ] ) ;
      }
      for( var i = 15,j = 0 ; i >= 0 ; i --,j ++ ) {
          ret[ i+16 ] = _convert( ret, i+16, srcBin[ j ] ) ;
      }
      return ret ;
    }

    // エンコード.
    fcipher.enc = function(value, pKey, head) {
        return fcipher.benc(strToArray( ""+value ), pKey, head) ;
    }

    // バイナリエンコード.
    fcipher.benc = function(bin, pKey, head) {
      head = head == null || head == _u ? ((_head == null) ? "" : _head) : head;
      // 第一引数がバイナリ.
      var pubKey = _randKey() ;
      var key32 = _convertKey(pKey, pubKey) ;
      var key256 = _key256(key32) ;
      key32 = null ;
      var stepNo = _getStepNo(pKey, bin) & 0x0000007f ;
      var nowStep = _convert256To(key256, pubKey, stepNo) ;
      _ed(true, bin, key256, nowStep) ;
      var eb = new Uint8Array(34+bin.length) ;
      eb[ 0 ] = rand.nextInt() & 0x000000ff;
      eb[ 1 ] = (~(stepNo^eb[ 0 ])) ;
      arraycopy(pubKey, 0, eb, 2, 32) ;
      arraycopy(bin, 0, eb, 34, bin.length) ;
      return head + CBase64.encode(eb);
    }

    // デコード.
    fcipher.dec = function(value, pKey, head) {
      return aryToString(fcipher.bdec(value, pKey, head)) ;
    }

    // バイナリデコード.
    fcipher.bdec = function(value, pKey, head) {
      head = head == null || head == _u ? ((_head == null) ? "" : _head) : head;
      var bin = CBase64.decode(value.substring(""+head.length));
      if( bin.length <= 34 ) {
        throw new Error("decode:Invalid binary length.") ;
      }
      var stepNo = ((~(bin[ 1 ]^bin[0]))&0x0000007f) ;
      var pubKey = new Uint8Array(32) ;
      arraycopy(bin, 2, pubKey, 0, 32) ;
      var bodyLen = bin.length - 34 ;
      var body = new Uint8Array(bodyLen) ;
      arraycopy(bin, 34, body, 0, bodyLen) ;
      bin = null ;
      var key32 = _convertKey(pKey, pubKey) ;
      var key256 = _key256(key32) ;
      key32 = null ;
      var nowStep = _convert256To(key256, pubKey, stepNo) ;
      _ed(false, body, key256, nowStep) ;
      var destStepNo = _getStepNo(pKey, body) & 0x0000007f;
      if( destStepNo != stepNo ) {
        throw new Error("decode:Decryption process failed.");
      }
      return body;
    }

    // ランダムキー生成.
    var _randKey = function() {
      var bin = new Uint8Array(32) ;
      for( var i = 0 ; i < 32 ; i ++ ) {
        bin[ i ] = ( rand.next() & 0x000000ff ) ;
      }
      return bin ;
    }

    // コード16データを作成.
    // s 処理対象情報.
    // mode
    //   1 : string
    //   それ以外: 配列.
    var code16 = function(s, mode) {
      var ret = mode == 1 ?
        [177, 75, 163, 143, 73, 49, 207, 40, 87, 41, 169, 91, 184, 67, 254, 89] :
        [87, 41, 169, 91, 184, 67, 254, 89, 177, 75, 163, 143, 73, 49, 207, 40] ;
      var n;
      var len = s.length;
      mode = mode|0;
      for(var i = 0; i < len; i ++) {
        n = (mode==1 ? s.charCodeAt(i)|0 : s[i]|0) & 0x00ffffff;
        if((i&0x00000001) == 0) {
          for(var j = 0; j < 16; j+= 2) {
            ret[j] = ret[j] ^ (n-(i+j));
          }
          for(var j = 1; j < 16; j+= 1) {
            ret[j] = ret[j] ^ ~(n-(i+j));
          }
        }
        else {
          for(var j = 1; j < 16; j+= 1) {
            ret[j] = ret[j] ^ (n-(i+j));
          }
          for(var j = 0; j < 16; j+= 2) {
            ret[j] = ret[j] ^ ~(n-(i+j));
          }
        }
      }
      for(var i = 0; i < 16; i++) {
        ret[i] = ret[i] & 0x000000ff;
      }
      return ret;
    }

    /// 変換処理.
    var _convert = function(key, no, pause) {
      switch ((no & 0x00000001)) {
        case 0:
          return (((pause ^ key[no])) & 0x000000ff) ;
        case 1:
          return (~(pause ^ key[no]) & 0x000000ff) ;
      }
      return 0 ;
    }

    var _convertKey = function(pKey, key) {
      var low = code16(pKey,0);
      var hight = code16(key,0);
      var ret = new Uint8Array(32);
      for (var i = 0,j = 0,k = 15; i < 16; i++, j += 2, k--) {
        ret[j] = _convert(low, i, key[j]);
        ret[j + 1] = _convert(hight, i, low[k]);
      }
      return ret;
    }

    var _key256 = function(key32) {
      var ret = new Uint8Array( 256 ) ;
      var b = new Uint8Array( 4 ) ;
      var o ;
      var n = 0 ;
      var s,e ;
      for( var i = 0,j = 0 ; i < 31 ; i += 2,j += 16 ) {
        s = ( key32[i] & 0x000000ff ) ;
        e = ( key32[i+1] & 0x000000ff ) ;
        if( ( n & 0x00000001 ) != 0 ) {
          n += s ^ (~ e ) ;
        }
        else {
          n -= (~s) ^ e ;
        }
        b[0] = (n & 0x000000ff) ;
        b[1] = (((n & 0x0000ff00)>>8)&0x000000ff) ;
        b[2] = (((n & 0x00ff0000)>>16)&0x000000ff) ;
        b[3] = (((n & 0xff000000)>>24)&0x000000ff) ;
        o = code16(b,0) ;
        arraycopy( o,0,ret,j,16 ) ;
      }
      return ret ;
    }

    var _getStepNo = function(pubKey, binary) {
      var i, j;
      var bin;
      var ret = 0;
      var len = binary.length ;
      var addCd = (pubKey[(binary[len>>1] & 0x0000001f)] & 0x00000003) + 1;
      for (i = 0, j = 0; i < len; i += addCd, j += addCd) {
        bin = ((~binary[i]) & 0x000000ff);
        ret = ((bin & 0x00000001) + ((bin & 0x00000002) >> 1)
          + ((bin & 0x00000004) >> 2) + ((bin & 0x00000008) >> 3)
          + ((bin & 0x00000010) >> 4) + ((bin & 0x00000020) >> 5)
          + ((bin & 0x00000040) >> 6) + ((bin & 0x00000080) >> 7))
          + (j & 0x000000ff) + ret;
      }
      if ((ret & 0x00000001) == 0) {
        for (i = 0; i <32; i++) {
          bin = (((pubKey[i] & 0x00000001) == 0) ? ((~pubKey[i]) & 0x000000ff)
            : (pubKey[i] & 0x000000ff));
          ret += ((bin & 0x00000001) + ((bin & 0x00000002) >> 1)
            + ((bin & 0x00000004) >> 2) + ((bin & 0x00000008) >> 3)
            + ((bin & 0x00000010) >> 4) + ((bin & 0x00000020) >> 5)
            + ((bin & 0x00000040) >> 6) + ((bin & 0x00000080) >> 7));
        }
      } else {
        for (i = 0; i < 32; i++) {
          bin = (((pubKey[i] & 0x00000001) == 0) ? ((~pubKey[i]) & 0x000000ff)
            : (pubKey[i] & 0x000000ff));
          ret -= ((bin & 0x00000001) + ((bin & 0x00000002) >> 1)
            + ((bin & 0x00000004) >> 2) + ((bin & 0x00000008) >> 3)
            + ((bin & 0x00000010) >> 4) + ((bin & 0x00000020) >> 5)
            + ((bin & 0x00000040) >> 6) + ((bin & 0x00000080) >> 7));
        }
      }
      return ((~ret) & 0x000000ff);
    }

    var _convert256To = function(key256, pKey, step) {
      var ns = step ;
      for (var i = 0, j = 0; i < 256; i++, j = ((j + 1) & 0x0000001f)) {
        ns = (ns ^ (~(key256[i]))) ;
        if( (ns & 0x00000001 ) == 0 ) {
          ns = ~ns ;
        }
        key256[i] = _convert(pKey, j, key256[i]);
        key256[i] = _flip(key256[i], ns);
      }
      return ns;
    }

    var _ed = function(mode, binary, key256, step) {
      var len = binary.length ;
      var ns = step ;
      if( mode ) {
        for (var i = 0, j = 0; i < len; i++, j = ((j + 1) & 0x000000ff)) {
          ns = (ns ^ (~( key256[j]))) ;
          if( (ns & 0x00000001 ) != 0 ) {
            ns = ~ns ;
          }
          binary[i] = _convert(key256, j, binary[i]);
          binary[i] = _flip(binary[ i ], ns) ;
        }
      }
      else {
        for (var i = 0, j = 0; i < len; i++, j = ((j + 1) & 0x000000ff)) {
          ns = (ns ^ (~( key256[j]))) ;
          if( (ns & 0x00000001 ) != 0 ) {
            ns = ~ns ;
          }
          binary[i] = _nflip(binary[ i ], ns) ;
          binary[i] = _convert(key256, j, binary[i]);
        }
      }
    }

    var strToArray = function(s) {
      var len = s.length ;
      var ret = new Uint8Array( len ) ;
      for( var i = 0 ; i < len ; i ++ ) {
        ret[ i ] = s.charCodeAt( i )|0 ;
      }
      return ret ;
    }

    var aryToString = function(s) {
      var len = s.length ;
      var ret = "";
      for( var i = 0 ; i < len ; i ++ ) {
        ret += String.fromCharCode( s[ i ] ) ;
      }
      return ret;
    }

    var arraycopy = function(s, sp, d, dp, len) {
      len = len|0;
      sp = sp|0;
      dp = dp|0;
      for( var i = 0 ; i < len ; i ++ ) {
        d[(dp+i)] = s[(sp+i)] ;
      }
    }

    return fcipher;
  })();

  //_g.fcipher = fcipher;

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
      errFunc = (typeof(errFunc) != "function") ? func : errFunc;
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
      // 同期Ajax.
      if( func == _u ) {
        var x = new XMLHttpRequest();
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
      // 非同期Ajax.
      else {
        var x = new XMLHttpRequest();
        x.open(_m(method),url,true);
        x.onload = function(){
          if(x.readyState==4) {
            try {
              var status = x.status;
              if(!status || status == 0) {
                status = 500;
              }
              if( status < 300 ) {
                func(status,x.responseText) ;
              } else {
                errFunc(status,x.responseText) ;
              }
            } finally {
              x.abort() ;
              x = null;
              func = null;
              errFunc = null;
            }
          }
        };
        x.onerror = function() {
          var status = x.status;
          if(!status || status == 0) {
            status = 500;
          }
          try {
            errFunc(status,x.responseText ) ;
          } finally {
            x.abort() ;
            x = null;
            func = null;
            errFunc = null;
          }
        }
      }
      head(method,x,header);
      x.send(pms);
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
  var DEF_HEAD_URL = location.protocol + "//" + location.host;

  // 割符コード.
  var _TALLY_CODE = _tally.dec("@&;,__::#.$;;%#,:%=;&%$&*^-%~^%^.^=*;;$/~%-&=");

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

  // uaccess: 処理タイムアウト.
  var _UACCESS_TIMEOUT = "x-uaccess-timeout";

  // uaccess: 処理区分.
  var _UACCESS_TYPE = "x-uaccess-type";

  // uaccess: パラメータ情報.
  var _UACCESS_PARAMS = "x-uaccess-params";

  // デフォルト非キャッシュ： キャッシュなし.
  var _DEF_NO_CACHE = true;

  // デフォルトexpire値(１分).
  var _DEF_EXPIRE_TIME = 1000 * 60 * 1;

  // POSTデータ用送信.
  var _sendPost =  function(url, execType, header, value, noCache, timeout, result, errorResult) {
    if(!url || url == "") {
      url = "/";
    }

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
    if(!url || url == "") {
      url = "/";
    }

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
    if(!url || url == "") {
      url = "/";
    }

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

  // uaccess送信.
  var _sendUaccess = function(url, execType, header, params, noCache, timeout, result, errorResult) {
    if(!url || url == "") {
      url = "/";
    }

    // URLの整形.
    url = _getUrl(url);

    // キャッシュが設定されていない場合.
    if(!noCache) {
      noCache = _DEF_NO_CACHE;
    }

    header[_UACCESS_TYPE] = execType;
    header[_UACCESS_TIMEOUT] = (!timeout) ? "" : "" + timeout;
    header[_UACCESS_PARAMS] = (!params) ? "" : params;
    _ajax("GET", url, null, result, errorResult, noCache, header);
  }

  // 管理者アクセスコードキーコード.
  var _UACCESS_ADMIN_ACCESS_CODE_KEYCODE = _tally.dec("@/.;:/^:$;-/&$%&#&~_^%_/.=~:;$.*@_~$-^&;.:;%~.:$&#^:;*;###~_#*^%^_.@&,;@~.%&%:.,^$#$@#&^&=*;&,/:~_&~.&_.-@,$=__/&^^@.~,~_//:*/%^/#$-@.$:;;^~:#:==:,%,~*#,_*#,-:=%*$#^@$=%-=;;$_~=^:*:;*-$/#/.;$:~.%$_.,@:;=;:%$^*%:*:&/^@-&__.^..@^*_@./-@$.%@_%##~/~^%/;:~@_;$/-@,;*-@;*|", _TALLY_CODE);

  // ユーザ管理者コード基本コード.
  var _UACCESS_ADMIN_CODE_KEYCODE = _tally.dec("@%_%^,.*;%%,#$-=@/;#&.~-%-_@=&*;@&~##~^~@**:-&%/;^,&%.=..%=:/$:~#$~_*@;./~~;.,%$=-~.^#&,/@_%*@_-%/_*,_&;/&**.$..-_^#,;^,#=~.=*_;:/_^*=&@__..=;,***,^=^;=&^$=,@%:__@$_*;%,*@;-#_&%:_.@$-,-.$..*=#_#@,;@~$:=,#&.;_=:~~,#@,-:,-^=-:,:@/-~_*%,%:^$%:_:#~./@%&*/;=.#=-@-@-;/%;*_&@__%%|", _TALLY_CODE);

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

  // ユーザアカウント認証コード用ヘッダを生成.
  var _getAuthHeader = function(expire) {
    var ret = {}
    ret[_UACCESS_SIGNATURES] = _createAuthAccountCode(expire);
    return ret;
  }

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

  // ユーザアカウント認証コード生成用情報の作成.
  o.setAuthInfo = function(name, accountCode, securityCode) {
    _setUAccessAccount(name, accountCode, securityCode);
  }

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

  
  // 管理者コード.
  var admin = {}
  o.admin = admin;

  // 管理者アクセスコードヘッダ.
  var _UACCESS_ADMIN_ACCESS_CODE_HEADER = "_uaccess_admin_access";

  // 管理者アクセス用認証用シグニチャ.
  var _UACCESS_ADMIN_ACCESS_SIGNATURES = "x-uaccess-admin-access-signatures";

  // cboxサーバUUID.
  var _cboxServerUUID = "0";

  // cboxパスコード.
  var _cboxPassCode = "";

  // uuid, パスコードを設定.
  var _setUAccessAdminAccessCode = function(uuid, passCode) {
    _cboxServerUUID = uuid;
    _cboxPassCode = passCode;
  }

  // 管理者アクセス認証コードを生成.
  var _createAuthAdminAccessCode = function(expire) {
    // パスコードを取得.
    var passCode = _cboxPassCode;
    if(passCode == "") {
      passCode = _UACCESS_ADMIN_ACCESS_CODE_KEYCODE;
    } else {
      // パスコードをfcipher.fhashで、ハッシュ変換.
      passCode = fcipher.fhash(passCode)
    }
    // パック化.
    expire = expire | 0;
    if(expire <= 0) {
      expire = _uaccessExpire;
    }
    var key = fcipher.key(passCode, _cboxServerUUID);
    var src = "{\"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ADMIN_ACCESS_CODE_HEADER);
  }

  // 管理者アクセス認証コード用ヘッダを生成.
  var _getAuthAdminAcccessCodeHeader = function(expire) {
    var ret = {}
    ret[_UACCESS_ADMIN_ACCESS_SIGNATURES] = _createAuthAdminAccessCode(expire);
    return ret;
  }

  // uuid, パスコードを設定.
  admin.setAuthInfo = function(uuid, passCode) {
    _setUAccessAdminAccessCode(uuid, passCode);
  }

  // 新しい管理者コードを生成.
  var _UACCESS_TYPE_CREATE_ADMIN_CODE = "create_admin_code";

  // 管理者コードを削除.
  var _UACCESS_TYPE_REMOVE_ADMIN_CODE = "remove_admin_code";

  // 管理者コードの一覧を取得.
  var _UACCESS_TYPE_GET_LIST_ADMIN_CODE = "get_list_admin_code";

  // 最新の管理者コードを取得.
  var _UACCESS_TYPE_GET_ADMIN_CODE = "get_admin_code";

  // 管理者コードの一番古いコードを削除.
  var _UACCESS_TYPE_REMOVE_OLD_ADMIN_CODE = "remove_old_admin_code";

  // 新しい管理者コードを生成.
  admin.create = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_CREATE_ADMIN_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // 管理者コードを削除.
  admin.remove = function(url, removeCode, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_REMOVE_ADMIN_CODE, _getAuthAdminAcccessCodeHeader(),
      removeCode, noCache, timeout, result, errorResult);
  }

  // 管理者コードの一覧を取得.
  admin.list = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_GET_LIST_ADMIN_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // 最新の管理者コードを取得.
  admin.getFirst = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_GET_ADMIN_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // 管理者コードの一番古いコードを削除.
  admin.removeLast = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_REMOVE_OLD_ADMIN_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // セキュリティコード.
  var security = {}
  o.security = security;

  // 新しいセキュリティコードを生成.
  var _UACCESS_TYPE_CREATE_SECURITY_CODE = "create_security_code";

  // セキュリティコードを削除.
  var _UACCESS_TYPE_REMOVE_SECURITY_CODE = "remove_security_code";

  // セキュリティコードの一覧を取得.
  var _UACCESS_TYPE_GET_LIST_SECURITY_CODE = "get_list_security_code";

  // 最新のセキュリティコードを取得.
  var _UACCESS_TYPE_GET_SECURITY_CODE = "get_security_code";

  // 一番古いセキュリティコードを削除.
  var _UACCESS_TYPE_REMOVE_OLD_SECURITY_CODE = "remove_old_security_code";

  // 新しいセキュリティコードを生成.
  security.create = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_CREATE_SECURITY_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // セキュリティコードを削除.
  security.remove = function(url, removeCode, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_REMOVE_SECURITY_CODE, _getAuthAdminAcccessCodeHeader(),
      removeCode, noCache, timeout, result, errorResult);
  }

  // セキュリティコードの一覧を取得.
  security.list = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_GET_LIST_SECURITY_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // 最新のセキュリティコードを取得.
  security.getFirst = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_GET_SECURITY_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }

  // セキュリティコードの一番古いコードを削除.
  security.removeLast = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_REMOVE_OLD_SECURITY_CODE, _getAuthAdminAcccessCodeHeader(),
      null, noCache, timeout, result, errorResult);
  }


  // ユーザアカウント情報.
  var account = {}
  o.account = account;

  // 管理者アクセスコードヘッダ.
  var _UACCESS_ADMIN_CODE_HEADER = "_uaccess_admin_";

  // 管理者認証用シグニチャ.
  var _UACCESS_ADMIN_SIGNATURES = "x-uaccess-admin-signatures";

  // リスト取得時のアカウント名.
  var _UACCESS_ADMIN_LIST_ACCOUNT = "*";

  // uaccess管理者認証コード情報.
  var _uaccessAdminCode = "c";

  // アカウント名をセットする.
  var _setUAccessAdmin = function(adminCode) {
    _uaccessAdminCode = adminCode;
  }

  // 管理者認証コードの作成.
  var _createAuthAdminCode = function(name, expire) {
    // パスコードを取得.
    var passCode = _cboxPassCode;
    if(passCode == "") {
      passCode = _UACCESS_ADMIN_CODE_KEYCODE;
    } else {
      // パスコードをfcipher.fhashで、ハッシュ変換.
      passCode = fcipher.fhash(passCode);
    }
    // パック化.
    expire = expire | 0;
    if(expire <= 0) {
      expire = _uaccessExpire;
    }
    var key = fcipher.key(passCode, name);
    var src = "{\"adminCode\": \"" + _uaccessAdminCode + "\", \"expire\": " + (Date.now() + expire) + "}";
    return fcipher.enc(src, key, _UACCESS_ADMIN_CODE_HEADER);
  }

  // 管理者認証コード用ヘッダを生成.
  var _getAuthAdminCodeHeader = function(name, expire) {
    if(!name || name == "") {
      throw new Error("アカウント名が設定されていません");
    }
    var ret = {}
    ret[_UACCESS_ADMIN_SIGNATURES] = _createAuthAdminCode(name, expire);
    return ret;
  }

  // URLからアカウント名を取得.
  var _getUrlByAccount = function(name) {
    // http://domain/{account}/ から始まる場合.
    var p = name.indexOf("://");
    if(p != -1) {
      p = name.indexOf("/", p + 3);
      if(p != -1) {
        p = name.indexOf("/", p);
        name = name.substring(p+1);
      } else {
        throw new Error("URLからアカウント情報の取得に失敗しました");
      }
    
    // /{account}/ のように始まる場合.
    } else {
      p = name.indexOf("/");
    }

    if(p == 0) {
      name = name.substring(1);
      if((p = name.indexOf("/", 1)) == -1) {
        return name;
      }
    }
    return name.substring(0, p);
  }

  // 管理者向けアカウント名、管理者IDをセットする.
  account.setAuthInfo = function(adminCode) {
    _setUAccessAdmin(adminCode);
  }

  // uaccess: ユーザアカウントコードを生成.
  var _UACCESS_TYPE_CREATE_ACCOUNT_CODE = "create_account_code";

  // uaccess: ユーザアカウントコードを削除.
  var _UACCESS_TYPE_REMOVE_ACCOUNT_CODE = "remove_account_code";

  // uaccess: ユーザアカウントコードを取得.
  var _UACCESS_TYPE_GET_ACCOUNT_CODE = "get_account_code";

  // uaccess: ユーザアカウントコード一覧を取得.
  var _UACCESS_TYPE_LIST_ACCOUNT_CODE = "list_account_code";

  // uaccess: ユーザアカウントコードの存在チェック.
  var _UACCESS_TYPE_IS_ACCOUNT_CODE = "is_account_code";

  // 新しいユーザアカウントコードを生成.
  account.create = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_CREATE_ACCOUNT_CODE, _getAuthAdminCodeHeader(_getUrlByAccount(url)),
      null, noCache, timeout, result, errorResult);
  }
  
  // ユーザアカウントコードを削除.
  account.remove = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_REMOVE_ACCOUNT_CODE, _getAuthAdminCodeHeader(_getUrlByAccount(url)),
      null, noCache, timeout, result, errorResult);
  }

  // ユーザアカウントコードを取得.
  account.get = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_GET_ACCOUNT_CODE, _getAuthAdminCodeHeader(_getUrlByAccount(url)),
      null, noCache, timeout, result, errorResult);
  }

  // ユーザアカウントコード一覧を取得.
  account.list = function(result, errorResult, noCache, timeout) {
    _sendUaccess(_UACCESS_ADMIN_LIST_ACCOUNT, _UACCESS_TYPE_LIST_ACCOUNT_CODE, _getAuthAdminCodeHeader(_UACCESS_ADMIN_LIST_ACCOUNT),
      null, noCache, timeout, result, errorResult);
  }

  // ユーザアカウントコードの存在チェック.
  account.isAccount = function(url, result, errorResult, noCache, timeout) {
    _sendUaccess(url, _UACCESS_TYPE_IS_ACCOUNT_CODE, _getAuthAdminCodeHeader(_getUrlByAccount(url)),
      null, noCache, timeout, result, errorResult);
  }

  _g.cbox = o;
})(global);