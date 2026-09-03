/*
 * touchbar.js — on-screen key bar for touch devices.
 *
 * A phone browser has no Esc, Tab, arrow or Ctrl keys, so the terminal UIs
 * tty2web is usually pointed at (the Husarion OS flasher TUI, wishlist, tmux,
 * a plain shell) are unusable from one. This adds a row of buttons that feed
 * the terminal the same bytes a real key would.
 *
 * Loaded as a plain script alongside sidenav.js (see server/handlers.go). It
 * needs the terminal object the bundle exposes as window.tty2webTerm, and
 * degrades to doing nothing if that never appears.
 *
 * Shown only where it is useful: pointer:coarse devices. Override with
 * ?touchbar=1 (force on, for desktop testing) or ?touchbar=0 (force off).
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var force = params.get("touchbar");
  if (force === "0") return;
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (force !== "1" && !coarse) return;

  // Key bytes. Arrows/PgUp/PgDn are the xterm "normal" (cursor) sequences,
  // which is what the terminal is in for all of these apps.
  //
  // ^B is the tmux prefix: on the HOFI web terminal it is the ONLY way to
  // reach a shell (prefix then "c"), and a phone keyboard cannot type it.
  var KEYS = [
    { label: "Esc",   seq: "\x1b" },
    { label: "Tab",   seq: "\t" },
    { label: "↑", seq: "\x1b[A", cls: "tb-arrow" },
    { label: "↓", seq: "\x1b[B", cls: "tb-arrow" },
    { label: "←", seq: "\x1b[D", cls: "tb-arrow" },
    { label: "→", seq: "\x1b[C", cls: "tb-arrow" },
    { label: "Enter", seq: "\r", cls: "tb-wide" },
    { label: "PgUp",  seq: "\x1b[5~" },
    { label: "PgDn",  seq: "\x1b[6~" },
    { label: "^C",    seq: "\x03" },
    { label: "^B",    seq: "\x02" },
    { label: "Ctrl",  ctrl: true },
    { label: "⌨", kbd: true }
  ];

  var CSS =
    "#tb-bar{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;" +
    "flex-wrap:wrap;gap:4px;justify-content:center;box-sizing:border-box;" +
    "padding:4px 4px calc(4px + env(safe-area-inset-bottom,0px));" +
    "background:#111;border-top:1px solid #333;" +
    "font-family:-apple-system,system-ui,sans-serif;-webkit-user-select:none;" +
    "user-select:none;touch-action:manipulation}" +
    "#tb-bar button{flex:0 0 auto;min-width:44px;min-height:38px;padding:0 10px;" +
    "font-size:15px;line-height:1;color:#ddd;background:#2a2a2a;border:1px solid #444;" +
    "border-radius:6px;-webkit-appearance:none;appearance:none;cursor:pointer}" +
    "#tb-bar button:active{background:#3d6ea5;color:#fff}" +
    "#tb-bar button.tb-arrow{font-size:19px}" +
    "#tb-bar button.tb-wide{min-width:70px}" +
    "#tb-bar button.tb-on{background:#3d6ea5;color:#fff;border-color:#5a8fd0}";

  var term = null;          // window.tty2webTerm once the bundle has built it
  var ctrlArmed = false;
  var ctrlBtn = null;

  function send(data) {
    if (term && typeof term.input === "function") {
      term.input(data);
      return true;
    }
    return false;
  }

  // Ctrl+<letter> is 0x01..0x1a. Also accept the handful of punctuation keys
  // that have control codes, so ^[ and ^] work from a soft keyboard.
  function ctrlByte(key) {
    if (key.length !== 1) return null;
    var c = key.toLowerCase();
    if (c >= "a" && c <= "z") return String.fromCharCode(c.charCodeAt(0) - 96);
    var punct = { "[": 27, "\\": 28, "]": 29, "^": 30, "_": 31, "@": 0, " ": 0 };
    if (punct[c] !== undefined) return String.fromCharCode(punct[c]);
    return null;
  }

  function setCtrl(on) {
    ctrlArmed = on;
    if (ctrlBtn) ctrlBtn.classList.toggle("tb-on", on);
  }

  function textarea() {
    return document.querySelector(".xterm-helper-textarea");
  }

  function toggleKeyboard() {
    var ta = textarea();
    if (!ta) return;
    if (document.activeElement === ta) ta.blur();
    else ta.focus();
  }

  function build() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.id = "tb-bar";

    KEYS.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = k.label;
      if (k.cls) b.className = k.cls;
      if (k.ctrl) ctrlBtn = b;

      // pointerdown, not click: the terminal must not lose focus, and a
      // click would fire ~300ms later on some mobile browsers.
      b.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        if (k.ctrl) { setCtrl(!ctrlArmed); return; }
        if (k.kbd) { toggleKeyboard(); return; }
        if (ctrlArmed) {
          // Ctrl held + a bar key: only the letter-ish ones mean anything,
          // so just disarm and send the key unmodified.
          setCtrl(false);
        }
        send(k.seq);
      });
      bar.appendChild(b);
    });

    document.body.appendChild(bar);
    return bar;
  }

  // Reserve the bar's height so it never covers the bottom terminal rows,
  // then let the bundle's own resize listener refit xterm to the new box.
  function reserve(bar) {
    var el = document.getElementById("terminal");
    if (!el) return;
    var h = bar.offsetHeight;
    el.style.height = "calc(100% - " + h + "px)";
    window.dispatchEvent(new Event("resize"));
  }

  function start() {
    var bar = build();

    // Sticky Ctrl for the soft keyboard: capture phase so we consume the
    // key before xterm's own textarea handler sees it.
    document.addEventListener("keydown", function (ev) {
      if (!ctrlArmed) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var b = ctrlByte(ev.key);
      if (b === null) return;
      ev.preventDefault();
      ev.stopPropagation();
      setCtrl(false);
      send(b);
    }, true);

    var refit = function () { reserve(bar); };
    window.addEventListener("orientationchange", refit);
    if (window.visualViewport) {
      // iOS: the soft keyboard resizes the visual viewport, not the window.
      window.visualViewport.addEventListener("resize", refit);
    }
    setTimeout(refit, 0);
  }

  // The bundle is injected by config.js and builds the terminal
  // asynchronously; wait for it rather than racing it.
  var tries = 0;
  var poll = setInterval(function () {
    if (window.tty2webTerm) {
      term = window.tty2webTerm;
      clearInterval(poll);
      start();
    } else if (++tries > 100) {   // ~10 s
      clearInterval(poll);
      console.log("touchbar: terminal never appeared, bar not shown");
    }
  }, 100);
})();
