/* Browser platform for the canonical O'Mono services. No provider credential
   enters this runtime or its persistent store. */
(function (scope) {
  "use strict";
  /* The previous Pages app persisted its key. Remove that one known legacy
     value without reading or importing it; other saved work stays untouched. */
  try { scope.localStorage.removeItem("omono_api_key"); } catch (_) {}
  var enc = new TextEncoder(), dec = new TextDecoder();
  class Bytes extends Uint8Array {
    static from(value, encoding) {
      if (typeof value === "string") {
        if (encoding === "hex") return new Bytes(value.match(/.{1,2}/g).map(function (v) { return parseInt(v, 16); }));
        if (encoding === "base64" || encoding === "base64url") return new Bytes(Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), function (c) { return c.charCodeAt(0); }));
        return new Bytes(enc.encode(value));
      }
      if (value instanceof ArrayBuffer) return new Bytes(value.slice(0));
      return new Bytes(value || []);
    }
    static alloc(n, fill) { var b = new Bytes(n); if (fill) b.fill(fill); return b; }
    static byteLength(s) { return typeof s === "string" ? enc.encode(s).length : s.byteLength; }
    static isBuffer(v) { return v instanceof Bytes; }
    static concat(parts) { var out = new Bytes(parts.reduce(function (n, p) { return n + p.length; }, 0)), at = 0; parts.forEach(function (p) { out.set(p, at); at += p.length; }); return out; }
    toString(encoding) {
      if (encoding === "hex") return Array.from(this, function (v) { return v.toString(16).padStart(2, "0"); }).join("");
      if (encoding === "base64" || encoding === "base64url") {
        var s = ""; for (var i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
        var result = btoa(s); return encoding === "base64url" ? result.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : result;
      }
      return dec.decode(this);
    }
    equals(other) { return this.length === other.length && this.every(function (v, i) { return v === other[i]; }); }
  }
  /* FIPS 180-4 SHA-256 for synchronous, deterministic ledger digests. Browser
     Web Crypto supplies randomness; asynchronous encryption uses subtle. */
  function sha256(bytes) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var n = bytes.length, data = new Uint8Array(Math.ceil((n + 9) / 64) * 64); data.set(bytes); data[n] = 128;
    var dv = new DataView(data.buffer); dv.setUint32(data.length - 8, Math.floor(n / 0x20000000)); dv.setUint32(data.length - 4, (n * 8) >>> 0);
    var W = new Int32Array(64), rr = function (x, k) { return (x >>> k) | (x << (32-k)); };
    for (var off = 0; off < data.length; off += 64) {
      for (var t = 0; t < 16; t++) W[t] = dv.getInt32(off + 4*t);
      for (t = 16; t < 64; t++) { var a0=W[t-15], a1=W[t-2]; W[t]=((rr(a0,7)^rr(a0,18)^(a0>>>3))+W[t-16]+(rr(a1,17)^rr(a1,19)^(a1>>>10))+W[t-7])|0; }
      var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (t=0;t<64;t++) { var u=(h+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+K[t]+W[t])|0; var v=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))|0; h=g;g=f;f=e;e=(d+u)|0;d=c;c=b;b=a;a=(u+v)|0; }
      [a,b,c,d,e,f,g,h].forEach(function (v,i) { H[i]=(H[i]+v)|0; });
    }
    var out=new Bytes(32), view=new DataView(out.buffer); H.forEach(function(v,i){view.setInt32(i*4,v);}); return out;
  }
  var cryptoShim = {
    randomBytes: function(n) { var b=new Bytes(n); scope.crypto.getRandomValues(b); return b; },
    /* randomUUID is withheld from a page served over plain http, and from
       older Safari. getRandomValues is not, so the identifier is built from
       real random bytes either way rather than the app failing to make one. */
    randomUUID: function() {
      if (typeof scope.crypto.randomUUID === "function") return scope.crypto.randomUUID();
      var b=new Bytes(16); scope.crypto.getRandomValues(b);
      b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
      var hex=Array.prototype.map.call(b,function(v){return ("0"+v.toString(16)).slice(-2);}).join("");
      return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
    },
    createHash: function(algorithm) { if(algorithm!=="sha256") throw new Error("Unsupported digest"); var chunks=[]; return {update:function(v,encoding){chunks.push(Bytes.from(v,encoding));return this;},digest:function(encoding){var b=sha256(Bytes.concat(chunks));return encoding?b.toString(encoding):b;}}; },
    timingSafeEqual: function(a,b) { if(a.length!==b.length) throw new Error("Different buffer lengths");var diff=0;for(var i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0; }
  };
  function normalize(input) { var parts=[];String(input).split("/").forEach(function(p){if(!p||p===".")return;if(p==="..")parts.pop();else parts.push(p);});return "/"+parts.join("/"); }
  var path = {join:function(){return normalize(Array.from(arguments).join("/"));},resolve:function(){return normalize(Array.from(arguments).join("/"));},normalize:normalize,dirname:function(p){var a=normalize(p).split("/");a.pop();return a.join("/")||"/";},basename:function(p,ext){var n=String(p).split("/").pop();return ext&&n.endsWith(ext)?n.slice(0,-ext.length):n;},extname:function(p){var m=String(p).match(/\.[^/.]+$/);return m?m[0]:"";},isAbsolute:function(p){return String(p).startsWith("/");},sep:"/"};
  var PREFIX="omono_browser_v4:", FILE_KEY=PREFIX+"files";
  var storage={get:function(key,fallback){var raw=scope.localStorage.getItem(PREFIX+key);return raw===null?fallback:JSON.parse(raw);},set:function(key,value){scope.localStorage.setItem(PREFIX+key,JSON.stringify(value));return value;},remove:function(key){scope.localStorage.removeItem(PREFIX+key);}};
  function readFiles(){var raw=scope.localStorage.getItem(FILE_KEY);return raw?JSON.parse(raw):{};}
  function saveFiles(files){scope.localStorage.setItem(FILE_KEY,JSON.stringify(files));}
  var factories={}, sourceTexts={}, cached={}, descriptors={}, descriptorCounter=10;
  function alias(id){return normalize(id).replace(/^\/app\/shared(?=\/|$)/,"/shared");}
  function source(id){return sourceTexts[alias(id)];}
  function error(code,p){var e=new Error(code+": "+p);e.code=code;return e;}
  function write(p,text,append){p=normalize(p);if(!p.startsWith("/user/")&&!p.startsWith("/tmp/"))throw error("EACCES",p);var files=readFiles();files[p]=(append?(files[p]||""):"")+String(text);saveFiles(files);}
  var fs={
    existsSync:function(p){p=normalize(p);var files=readFiles();return p==="/"||p==="/user"||p==="/tmp"||Object.prototype.hasOwnProperty.call(files,p)||source(p)!==undefined||Object.keys(files).some(function(k){return k.startsWith(p+"/");})||Object.keys(sourceTexts).some(function(k){return k.startsWith(alias(p)+"/");});},
    mkdirSync:function(p){p=normalize(p);var files=readFiles();if(!Object.prototype.hasOwnProperty.call(files,p)){files[p]=null;saveFiles(files);}},
    readFileSync:function(p,encoding){p=normalize(p);var files=readFiles();var value=Object.prototype.hasOwnProperty.call(files,p)?files[p]:source(p);if(typeof value!=="string")throw error("ENOENT",p);return encoding?value:Bytes.from(value);},
    writeFileSync:function(p,value){if(typeof p==="number"){var fd=descriptors[p];if(!fd)throw error("EBADF",p);write(fd.path,value instanceof Uint8Array?dec.decode(value):value,false);fd.position=Bytes.byteLength(value);return;}write(p,value instanceof Uint8Array?dec.decode(value):value,false);},
    appendFileSync:function(p,value){write(p,value instanceof Uint8Array?dec.decode(value):value,true);},
    renameSync:function(a,b){a=normalize(a);b=normalize(b);var files=readFiles();if(!Object.prototype.hasOwnProperty.call(files,a))throw error("ENOENT",a);files[b]=files[a];delete files[a];saveFiles(files);},
    unlinkSync:function(p){p=normalize(p);var files=readFiles();if(!Object.prototype.hasOwnProperty.call(files,p))throw error("ENOENT",p);delete files[p];saveFiles(files);},
    openSync:function(p,flags){if(flags.indexOf("x")!==-1&&fs.existsSync(p))throw error("EEXIST",p);if(flags.indexOf("w")!==-1)write(p,"",false);else if(!fs.existsSync(p))throw error("ENOENT",p);var fd=++descriptorCounter;descriptors[fd]={path:normalize(p),position:0};return fd;},
    writeSync:function(fd,buffer,offset,length,position){var rec=descriptors[fd];if(!rec)throw error("EBADF",fd);var before=Bytes.from(fs.readFileSync(rec.path,"utf8"));var part=Bytes.from(buffer).subarray(offset||0,(offset||0)+(length===undefined?buffer.length:length));var at=position==null?rec.position:position;var after=new Bytes(Math.max(before.length,at+part.length));after.set(before);after.set(part,at);write(rec.path,dec.decode(after),false);rec.position=at+part.length;return part.length;},
    fsyncSync:function(fd){if(!descriptors[fd])throw error("EBADF",fd);},
    closeSync:function(fd){delete descriptors[fd];},chmodSync:function(){},
    statSync:function(p){if(!fs.existsSync(p))throw error("ENOENT",p);var dir;try{fs.readFileSync(p,"utf8");dir=false;}catch(_){dir=true;}return {isDirectory:function(){return dir;},isFile:function(){return !dir;},size:dir?0:Bytes.byteLength(fs.readFileSync(p,"utf8"))};},
    readdirSync:function(p){p=normalize(p);var names=new Set();Object.keys(readFiles()).concat(Object.keys(sourceTexts)).forEach(function(k){if(k.startsWith(p+"/"))names.add(k.slice(p.length+1).split("/")[0]);});return Array.from(names);}
  };
  var builtins={fs:fs,path:path,crypto:cryptoShim,buffer:{Buffer:Bytes}};
  function load(id,parent){if(builtins[id])return builtins[id];if(id==="electron"||id==="https")throw new Error("Native module unavailable in this browser: "+id);id=alias(id.startsWith(".")?path.join(path.dirname(parent||"/"),id):id);if(!factories[id]){if(factories[id+".js"])id+=".js";else if(factories[id+".json"])id+=".json";else if(factories[id+"/index.js"])id+="/index.js";else throw new Error("Unavailable O'Mono module: "+id);}if(cached[id])return cached[id].exports;var mod={exports:{}};cached[id]=mod;try{factories[id](function(name){return load(name,id);},mod,mod.exports,path.dirname(id),id,{env:{},platform:"browser"},Bytes);}catch(e){delete cached[id];throw e;}return mod.exports;}
  scope.omono={};
  scope.OMonoBrowserRuntime={bridge:scope.omono,storage:storage,services:{},fs:fs,path:path,crypto:cryptoShim,Buffer:Bytes,require:load,define:function(id,factory,text){factories[alias(id)]=factory;sourceTexts[alias(id)]=text;},sha256:function(s){return sha256(Bytes.from(s)).toString("hex");}};
})(typeof window!=="undefined"?window:globalThis);
