/* Challenge landing page: reads /c/<code>, draws the level with the game's own art, shows the creator's stats and the store link. */
(function () {
  'use strict';
  var cfg = window.SITE || {};
  var STR = {
    en: {
      title: 'Can you get past my trap?',
      sub: 'A friend built this trap route in {app} and cleared it themselves. Now it is your turn.',
      time: "Creator's time", timeNote: 'self-reported', level: 'Level', size: 'Size', traps: 'Traps placed', unknown: 'not recorded',
      open: 'Open in the game', store: 'Download on the App Store', soon: 'Coming soon to the App Store',
      copy: 'Copy challenge code', copied: 'Copied', how: 'Already have the game? Tap "Open in the game". Or copy the code, open Challenges, tap Import code and paste.',
      bad: 'This challenge link looks damaged or incomplete. Ask your friend to share it again.',
      what: 'What is {app}?', whatText: 'Build a trap-filled route with a gold budget, then watch AI heroes try to survive it. Free to play on iPhone.',
      note: 'The creator time is reported by the game on their phone and is not verified by a server.'
    },
    ar: {
      title: 'هل تستطيع تجاوز فخّي؟',
      sub: 'بنى صديقك مسار فخاخ في {app} وأنهاه بنفسه. الآن جاء دورك.',
      time: 'وقت المنشئ', timeNote: 'يُسجَّل من اللعبة', level: 'المرحلة', size: 'الحجم', traps: 'عدد الفخاخ', unknown: 'غير مسجّل',
      open: 'افتح في اللعبة', store: 'حمّل من App Store', soon: 'قريبًا على App Store', copy: 'انسخ رمز التحدي', copied: 'تم النسخ',
      how: 'عندك اللعبة؟ اضغط «افتح في اللعبة». أو انسخ الرمز، ثم افتح التحديات، واضغط استيراد رمز، والصقه.',
      bad: 'يبدو أن رابط التحدي تالف أو ناقص. اطلب من صديقك مشاركته من جديد.',
      what: 'ما هي {app}؟', whatText: 'ابنِ مسارًا مليئًا بالفخاخ بميزانية من الذهب، ثم شاهد أبطال الذكاء الاصطناعي يحاولون النجاة. مجانية على آيفون.',
      note: 'وقت المنشئ تسجله اللعبة على هاتفه ولا يتحقق منه أي خادم.'
    }
  };
  var lang = (navigator.language || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  var q = new URLSearchParams(location.search);
  if (q.get('lang') === 'ar' || q.get('lang') === 'en') lang = q.get('lang');
  function t(key) { return (STR[lang][key] || STR.en[key] || key).replace(/\{app\}/g, cfg.appName || 'the game'); }

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (el) { el.textContent = t(el.getAttribute('data-t')); });
  var other = document.getElementById('lang');
  if (other) { other.textContent = lang === 'ar' ? 'English' : 'العربية'; other.href = '?lang=' + (lang === 'ar' ? 'en' : 'ar'); }

  var result = window.TrapCode.decode(location.pathname + location.search + location.hash);
  var code = result.ok ? result.code : null;

  var storeBtn = document.getElementById('store');
  if (cfg.appStoreUrl) { storeBtn.href = cfg.appStoreUrl; storeBtn.textContent = t('store'); }
  else { storeBtn.removeAttribute('href'); storeBtn.classList.add('disabled'); storeBtn.textContent = t('soon'); }
  var openBtn = document.getElementById('open');
  var copyBtn = document.getElementById('copy');

  if (!result.ok) {
    document.getElementById('bad').hidden = false;
    document.getElementById('bad').textContent = t('bad');
    document.getElementById('challenge').hidden = true;
    openBtn.hidden = true; copyBtn.hidden = true;
    return;
  }
  openBtn.href = cfg.urlScheme + '://c/' + code;
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = t('copied'); setTimeout(function () { copyBtn.textContent = t('copy'); }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done);
    else { var ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); done(); }
  });

  var level = result.level;
  document.title = (level.name || t('title')) + ' - ' + (cfg.appName || '');
  document.getElementById('level-name').textContent = level.name || '-';
  document.getElementById('size').textContent = level.width + ' x ' + level.height;
  document.getElementById('time').textContent = result.seconds > 0 ? result.seconds.toFixed(1) + ' s' : t('unknown');
  var counts = {}, total = 0;
  level.cells.forEach(function (k) { if (k > 1) { counts[k] = (counts[k] || 0) + 1; total++; } });
  document.getElementById('traps').textContent = String(total);
  var legend = document.getElementById('legend');
  Object.keys(counts).sort(function (a, b) { return a - b; }).forEach(function (k) {
    var li = document.createElement('li');
    var img = new Image(); img.src = '/trapmaker-site/assets/' + window.TrapCode.KINDS[k] + '.webp'; img.alt = ''; img.width = 28; img.height = 28;
    li.appendChild(img); li.appendChild(document.createTextNode(' x' + counts[k]));
    legend.appendChild(li);
  });

  // ---- draw the level ----
  var names = window.TrapCode.KINDS.concat(['goal', 'runner']);
  var images = {}, pending = names.length - 1;
  function ready() { if (--pending === 0) draw(); }
  names.slice(1).forEach(function (name) {
    var img = new Image(); img.onload = ready; img.onerror = ready; img.src = '/trapmaker-site/assets/' + name + '.webp'; images[name] = img;
  });
  var back = new Image(); back.src = 'assets/backdrop.webp'; back.onload = function () { if (pending <= 0) draw(); };

  function draw() {
    var canvas = document.getElementById('picture');
    var cell = 44, w = level.width * cell, h = level.height * cell, dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    var c = canvas.getContext('2d'); c.scale(dpr, dpr);
    var sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#16283d'); sky.addColorStop(1, '#2b3550'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    if (back.complete && back.naturalWidth) {
      var s = Math.max(w / back.naturalWidth, h / back.naturalHeight);
      c.globalAlpha = .55; c.drawImage(back, (w - back.naturalWidth * s) / 2, (h - back.naturalHeight * s) / 2, back.naturalWidth * s, back.naturalHeight * s); c.globalAlpha = 1;
    }
    function sprite(name, x, y, bw, bh, stretch, mirror) {
      var img = images[name]; if (!img || !img.naturalWidth) return;
      var dw = bw, dh = bh;
      if (!stretch) { var k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight); dw = img.naturalWidth * k; dh = img.naturalHeight * k; }
      var dx = x + (bw - dw) / 2, dy = y + (bh - dh) + 0; // sit on the cell floor
      if (stretch) dy = y;
      if (mirror) { c.save(); c.translate(dx + dw, dy); c.scale(-1, 1); c.drawImage(img, 0, 0, dw, dh); c.restore(); } else c.drawImage(img, dx, dy, dw, dh);
    }
    for (var y = 0; y < level.height; y++) for (var x = 0; x < level.width; x++) {
      var kind = level.cells[y * level.width + x]; if (!kind) continue;
      var name = window.TrapCode.KINDS[kind];
      var stretch = kind === 1 || kind === 4 || kind === 6;
      sprite(name, x * cell, (level.height - 1 - y) * cell, cell, cell, stretch, kind === 11);
    }
    sprite('goal', (level.goalX - .1) * cell, (level.height - level.goalY - 1.8) * cell, cell * 1.2, cell * 1.8, false, false);
    sprite('runner', (level.spawnX - .15) * cell, (level.height - level.spawnY - 1.4) * cell, cell * 1.3, cell * 1.4, false, false);
    c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#8DEBCF'; c.fillText('START', (level.spawnX + .5) * cell, (level.height - level.spawnY - 1.5) * cell);
    c.fillStyle = '#FFE485'; c.fillText('EXIT', (level.goalX + .5) * cell, (level.height - level.goalY - 1.95) * cell);
  }
  if (pending <= 0) draw();
})();
