/* Decodes a TM2 challenge code. Mirrors Assets/Scripts/ChallengeCodec.cs (TryDecodeCompact) byte for byte.
 * Layout: 2, width, height, spawnX, spawnY, goalX, goalY, centisHi, centisLo, nameLen, name(UTF-8), (run, kind)*, crcHi, crcLo.
 * Works in the browser (window.TrapCode) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrapCode = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX_CELLS = 2048, MAX_KIND = 12;

  function crc16(bytes, length) {
    var crc = 0xFFFF;
    for (var n = 0; n < length; n++) {
      crc ^= bytes[n] << 8;
      for (var bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc;
  }

  function base64UrlToBytes(text) {
    var b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  /** Finds a TM2 code inside a path, URL or pasted message. Returns null when there is none. */
  function extract(text) {
    var m = /TM2\.[A-Za-z0-9_-]+/.exec(decodeURIComponent(String(text || '').slice(0, 24000)));
    return m ? m[0] : null;
  }

  function utf8(bytes) {
    if (typeof TextDecoder === 'function') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  /** Returns { ok:true, level:{width,height,spawnX,spawnY,goalX,goalY,name,cells}, seconds } or { ok:false, error }. */
  function decode(input) {
    try {
      var code = extract(input);
      if (!code) return { ok: false, error: 'No challenge code found.' };
      var data = base64UrlToBytes(code.slice(4));
      if (data.length < 14 || data.length > 6000 || data[0] !== 2) return { ok: false, error: 'Unsupported code.' };
      var end = data.length - 2;
      var crc = crc16(data, end);
      if (data[end] !== (crc >> 8) || data[end + 1] !== (crc & 255)) return { ok: false, error: 'The code is damaged.' };
      var width = data[1], height = data[2];
      if (width < 8 || width > 64 || height < 4 || height > 32 || width * height > MAX_CELLS) return { ok: false, error: 'Invalid size.' };
      var nameLen = data[9];
      if (nameLen > 24 || 10 + nameLen > end) return { ok: false, error: 'Invalid name.' };
      var name = utf8(data.subarray(10, 10 + nameLen));
      if (/[\u0000-\u001f\u007f-\u009f]/.test(name)) return { ok: false, error: 'Invalid name.' };
      var cells = new Array(width * height), at = 0, pos = 10 + nameLen;
      while (pos < end) {
        if (pos + 1 >= end) return { ok: false, error: 'Truncated layout.' };
        var run = data[pos], kind = data[pos + 1]; pos += 2;
        if (run < 1 || kind > MAX_KIND || at + run > cells.length) return { ok: false, error: 'Invalid layout.' };
        for (var n = 0; n < run; n++) cells[at++] = kind;
      }
      if (at !== cells.length) return { ok: false, error: 'Incomplete layout.' };
      var level = { width: width, height: height, spawnX: data[3], spawnY: data[4], goalX: data[5], goalY: data[6], name: name, cells: cells };
      if (level.spawnX >= width || level.goalX >= width || level.spawnY >= height || level.goalY >= height) return { ok: false, error: 'Invalid start or exit.' };
      function validMarker(x, y) {
        if (y < 1 || cells[y * width + x] !== 0) return false;
        var below = cells[(y - 1) * width + x];
        return below === 1 || below === 4 || below === 5 || below === 7;
      }
      if (!validMarker(level.spawnX, level.spawnY) || !validMarker(level.goalX, level.goalY) ||
          (level.spawnX === level.goalX && level.spawnY === level.goalY)) return { ok: false, error: 'Invalid start or exit.' };
      return { ok: true, code: code, level: level, seconds: ((data[7] << 8) | data[8]) / 100 };
    } catch (e) {
      return { ok: false, error: 'The code could not be read.' };
    }
  }

  var KINDS = ['empty', 'ground', 'spike', 'saw', 'crumble', 'spring', 'lava', 'conveyor', 'crusher', 'flame', 'frost', 'arrow', 'bomb'];
  return { decode: decode, extract: extract, crc16: crc16, KINDS: KINDS };
});
