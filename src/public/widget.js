(function () {
  "use strict";

  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) return scripts[i];
      }
      return null;
    })();

  function attr(name, fallback) {
    var v = currentScript ? currentScript.getAttribute(name) : null;
    return v == null || v === "" ? fallback : v;
  }

  var restaurantId = currentScript ? currentScript.getAttribute("data-restaurant") : null;

  var apiBase = "";
  try {
    apiBase = new URL(currentScript.src).origin;
  } catch (e) {
    apiBase = "";
  }

  var chatHistory = [];

  console.log("AI Restaurant Concierge widget loaded");
  console.log("Restaurant ID:", restaurantId);

  if (!restaurantId) {
    console.error('[AI Restaurant Concierge] No restaurant ID found. Add data-restaurant="<your-id>".');
    return;
  }
  if (window.__aiRestaurantConciergeMounted) {
    console.warn("[AI Restaurant Concierge] Widget already mounted, skipping.");
    return;
  }
  window.__aiRestaurantConciergeMounted = true;

  // Defaults from the snippet; live values fetched from the server on load.
  var cfg = {
    brandColor: attr("data-color", "#7c3aed"),
    conciergeName: attr("data-name", "Maître AI"),
    welcomeMessage: attr("data-welcome", "Hi there! 👋 How can I help you today? Ask me about our menu, reservations, or hours."),
    reservationLabel: "Reserve a Table",
    orderLabel: "Order Online",
    cateringLabel: "Catering Inquiry",
    actions: [],
  };
  cfg.actions = [
    { label: cfg.reservationLabel, url: "", image: "" },
    { label: cfg.orderLabel, url: "", image: "" },
    { label: cfg.cateringLabel, url: "", image: "" },
  ];

  var CARD_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>';

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function initial() {
    return (String(cfg.conciergeName).charAt(0) || "C").toUpperCase();
  }

  function injectStyles() {
    var c = cfg.brandColor;
    var CSS =
      ".arc-root,.arc-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
      ".arc-launch{position:fixed;bottom:24px;right:24px;z-index:2147483646;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}" +
      ".arc-bubble{position:relative;width:64px;height:64px;border-radius:9999px;background:" + c + ";color:#fff;border:none;cursor:pointer;box-shadow:0 10px 26px -6px rgba(0,0,0,.5),0 2px 6px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s;}" +
      ".arc-bubble:hover{transform:scale(1.09) translateY(-2px);box-shadow:0 16px 34px -8px rgba(0,0,0,.55);}" +
      ".arc-bubble:active{transform:scale(.95);}" +
      ".arc-bubble svg{width:28px;height:28px;transition:transform .3s ease;}" +
      ".arc-pulse{position:absolute;inset:0;border-radius:9999px;background:" + c + ";z-index:-1;animation:arc-pulse 2.6s cubic-bezier(.4,0,.6,1) infinite;}" +
      "@keyframes arc-pulse{0%{transform:scale(1);opacity:.5;}70%{transform:scale(1.7);opacity:0;}100%{transform:scale(1.7);opacity:0;}}" +
      ".arc-blip{position:absolute;top:3px;right:3px;width:14px;height:14px;border-radius:9999px;background:#22c55e;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.04);}" +
      ".arc-greet{position:relative;max-width:248px;background:#fff;color:#27272a;border-radius:18px;border-bottom-right-radius:6px;padding:12px 16px;font-size:13.5px;line-height:1.45;box-shadow:0 16px 36px -12px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.08);display:flex;align-items:flex-start;gap:8px;cursor:pointer;opacity:0;transform:translateY(10px) scale(.92);transform-origin:bottom right;transition:opacity .35s ease,transform .35s cubic-bezier(.34,1.56,.64,1);pointer-events:none;}" +
      ".arc-greet.arc-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
      ".arc-greet b{font-weight:600;}" +
      ".arc-greet-x{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:9999px;background:#fff;color:#9ca3af;border:1px solid #eee;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.12);}" +
      ".arc-greet-x:hover{color:#4b5563;}" +
      ".arc-window{position:fixed;bottom:104px;right:24px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 140px);background:#fff;border-radius:20px;box-shadow:0 30px 70px -20px rgba(15,15,25,.4);z-index:2147483647;display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(0,0,0,.06);}" +
      ".arc-window.arc-open{display:flex;}" +
      ".arc-header{display:flex;align-items:center;gap:12px;padding:16px 18px;background:#fff;border-bottom:1px solid #f0f0f0;}" +
      ".arc-ava{position:relative;}" +
      ".arc-ava-dot{width:36px;height:36px;border-radius:9999px;background:" + c + ";display:flex;align-items:center;justify-content:center;color:#fff;}" +
      ".arc-ava-dot svg{width:16px;height:16px;}" +
      ".arc-online{position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:9999px;background:#10b981;border:2px solid #fff;}" +
      ".arc-htext{flex:1;line-height:1.2;}" +
      ".arc-title{font-size:13px;font-weight:600;color:#18181b;}" +
      ".arc-sub{font-size:11px;color:#71717a;}" +
      ".arc-close{background:transparent;border:none;color:#a1a1aa;cursor:pointer;font-size:20px;line-height:1;padding:6px;border-radius:9999px;}" +
      ".arc-close:hover{background:#f4f4f5;color:#3f3f46;}" +
      ".arc-body{flex:1;overflow-y:auto;padding:18px;background:#fafafa;display:flex;flex-direction:column;gap:12px;}" +
      ".arc-row{display:flex;align-items:flex-end;gap:8px;}" +
      ".arc-row.arc-u{justify-content:flex-end;}" +
      ".arc-bava{width:26px;height:26px;border-radius:9999px;background:" + c + ";color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;}" +
      ".arc-msg{max-width:84%;padding:10px 14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;box-shadow:0 1px 2px rgba(0,0,0,.04);}" +
      ".arc-msg.arc-bot{background:#fff;border:1px solid #ececef;color:#27272a;border-radius:16px;border-bottom-left-radius:5px;}" +
      ".arc-msg.arc-user{background:" + c + ";color:#fff;border-radius:16px;border-bottom-right-radius:5px;}" +
      ".arc-typing{display:flex;gap:4px;align-items:center;padding:13px 14px;}" +
      ".arc-typing span{width:6px;height:6px;border-radius:9999px;background:#c4c4cc;display:inline-block;animation:arc-bounce 1.2s infinite ease-in-out;}" +
      ".arc-typing span:nth-child(1){animation-delay:-.24s;}.arc-typing span:nth-child(2){animation-delay:-.12s;}" +
      "@keyframes arc-bounce{0%,80%,100%{transform:scale(.6);opacity:.5;}40%{transform:scale(1);opacity:1;}}" +
      ".arc-quick{display:flex;gap:8px;padding:12px 14px 4px;background:#fff;border-top:1px solid #f0f0f0;}" +
      ".arc-card{flex:1 1 0;min-width:0;display:flex;flex-direction:column;border:1px solid #ececef;border-radius:14px;overflow:hidden;background:#fff;text-decoration:none;cursor:pointer;transition:transform .15s,box-shadow .15s;}" +
      ".arc-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px -10px rgba(0,0,0,.3);}" +
      ".arc-card-img{height:60px;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;}" +
      ".arc-card-img svg{width:22px;height:22px;color:#fff;opacity:.95;}" +
      ".arc-card-label{padding:7px 6px;font-size:11.5px;font-weight:600;color:#27272a;text-align:center;line-height:1.25;}" +
      ".arc-input-row{display:flex;gap:8px;align-items:center;padding:12px;background:#fff;border-top:1px solid #f0f0f0;}" +
      ".arc-input{flex:1;border:1px solid #e4e4e7;background:#fafafa;border-radius:9999px;padding:10px 16px;font-size:13.5px;outline:none;transition:all .15s;color:#18181b;}" +
      ".arc-input:focus{background:#fff;border-color:" + c + ";}" +
      ".arc-send{width:38px;height:38px;flex-shrink:0;background:" + c + ";color:#fff;border:none;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s;}" +
      ".arc-send:disabled{opacity:.4;cursor:not-allowed;}" +
      ".arc-send svg{width:16px;height:16px;}" +
      ".arc-count{margin-top:-6px;padding:0 16px 10px;text-align:right;font-size:11px;font-weight:500;color:#52525b;background:#fff;}" +
      ".arc-count.full{color:#dc2626;font-weight:600;}";

    var existing = document.querySelector("style[data-arc]");
    if (existing) existing.remove();
    var style = document.createElement("style");
    style.setAttribute("data-arc", "true");
    style.appendChild(document.createTextNode(CSS));
    document.head.appendChild(style);
  }

  function appendBot(body, text) {
    var row = el("div", "arc-row arc-b");
    row.appendChild(el("div", "arc-bava", escapeHtml(initial())));
    row.appendChild(el("div", "arc-msg arc-bot", escapeHtml(text)));
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }
  function appendUser(body, text) {
    var row = el("div", "arc-row arc-u");
    row.appendChild(el("div", "arc-msg arc-user", escapeHtml(text)));
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function build() {
    var root = el("div", "arc-root");

    // Launcher: greeting bubble + the floating action button.
    var launch = el("div", "arc-launch");

    var greet = el("div", "arc-greet");
    var greetText = el(
      "div",
      null,
      "<b>" + escapeHtml(cfg.conciergeName) + "</b><br>👋 Hi there! Questions about the menu, hours, or a table? I'm happy to help."
    );
    var greetX = el("div", "arc-greet-x", "×");
    greet.appendChild(greetText);
    greet.appendChild(greetX);

    var bubble = el("button", "arc-bubble");
    bubble.setAttribute("aria-label", "Open chat");
    var pulse = el("span", "arc-pulse");
    var iconWrap = el("span", null, CHAT_ICON);
    iconWrap.style.cssText = "display:flex;align-items:center;justify-content:center;";
    var blip = el("span", "arc-blip");
    bubble.appendChild(pulse);
    bubble.appendChild(iconWrap);
    bubble.appendChild(blip);

    launch.appendChild(greet);
    launch.appendChild(bubble);

    var win = el("div", "arc-window");

    var header = el("div", "arc-header");
    var ava = el("div", "arc-ava");
    ava.appendChild(
      el("div", "arc-ava-dot", '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>')
    );
    ava.appendChild(el("span", "arc-online"));
    header.appendChild(ava);
    var htext = el("div", "arc-htext");
    htext.appendChild(el("div", "arc-title", escapeHtml(cfg.conciergeName)));
    htext.appendChild(el("div", "arc-sub", "Online now"));
    header.appendChild(htext);
    var close = el("button", "arc-close", "×");
    close.setAttribute("aria-label", "Close chat");
    header.appendChild(close);

    var body = el("div", "arc-body");
    appendBot(body, cfg.welcomeMessage);

    var quick = el("div", "arc-quick");
    (cfg.actions || []).slice(0, 3).forEach(function (b) {
      if (!b || (!b.label && !b.url)) return;
      var card = document.createElement(b.url ? "a" : "button");
      card.className = "arc-card";
      if (b.url) {
        card.href = b.url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      } else {
        card.type = "button";
      }
      var img = el("div", "arc-card-img");
      if (b.image) {
        img.style.backgroundImage = 'url("' + String(b.image).replace(/"/g, "") + '")';
      } else {
        img.style.background = "linear-gradient(135deg," + cfg.brandColor + ",rgba(0,0,0,.3))";
        img.innerHTML = CARD_ICON;
      }
      card.appendChild(img);
      card.appendChild(el("div", "arc-card-label", escapeHtml(b.label || "Open")));
      if (!b.url) {
        card.addEventListener("click", function () {
          ask(b.label);
        });
      }
      quick.appendChild(card);
    });

    var inputRow = el("div", "arc-input-row");
    var input = el("input", "arc-input");
    input.setAttribute("placeholder", "Ask about reservations, menu, hours…");
    input.setAttribute("maxlength", "300");
    var send = el(
      "button",
      "arc-send",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    );
    inputRow.appendChild(input);
    inputRow.appendChild(send);

    // Visible character counter (tokens are costly — keep guest messages short).
    var count = el("div", "arc-count", "0/300");
    function updateCount() {
      count.textContent = input.value.length + "/300";
      count.className = "arc-count" + (input.value.length >= 300 ? " full" : "");
    }

    var busy = false;

    function ask(text) {
      var v = (text != null ? text : input.value).trim();
      if (!v || busy) return;
      input.value = "";
      updateCount();
      appendUser(body, v);
      chatHistory.push({ role: "user", content: v });

      busy = true;
      send.setAttribute("disabled", "true");
      var typing = el("div", "arc-row arc-b");
      typing.appendChild(el("div", "arc-bava", escapeHtml(initial())));
      var tBubble = el("div", "arc-msg arc-bot arc-typing", "<span></span><span></span><span></span>");
      typing.appendChild(tBubble);
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      fetch(apiBase + "/api/concierge", {
        method: "POST",
        // text/plain keeps this a CORS "simple request" (no preflight), so it
        // works embedded on another origin (e.g. Wix).
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ restaurantId: restaurantId, question: v, history: chatHistory.slice(-8) }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (r) {
          var reply = r.ok && r.data && r.data.answer ? r.data.answer : (r.data && r.data.error) || "Sorry, something went wrong. Please try again.";
          chatHistory.push({ role: "assistant", content: reply });
          if (typing.parentNode) typing.parentNode.removeChild(typing);
          appendBot(body, reply);
        })
        .catch(function () {
          if (typing.parentNode) typing.parentNode.removeChild(typing);
          appendBot(body, "Sorry, I couldn't reach the concierge. Please try again.");
        })
        .then(function () {
          busy = false;
          send.removeAttribute("disabled");
          input.focus();
        });
    }

    send.addEventListener("click", function () {
      ask();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") ask();
    });
    input.addEventListener("input", updateCount);

    win.appendChild(header);
    win.appendChild(body);
    win.appendChild(quick);
    win.appendChild(inputRow);
    win.appendChild(count);

    var hasOpened = false;
    var greetDismissed = false;

    function showGreet() {
      if (!greetDismissed && !hasOpened) greet.classList.add("arc-show");
    }
    function hideGreet() {
      greet.classList.remove("arc-show");
    }

    function setOpen(open) {
      if (open) {
        win.classList.add("arc-open");
        iconWrap.innerHTML = CLOSE_ICON;
        pulse.style.display = "none";
        blip.style.display = "none";
        hideGreet();
        hasOpened = true;
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 80);
      } else {
        win.classList.remove("arc-open");
        iconWrap.innerHTML = CHAT_ICON;
      }
    }

    bubble.addEventListener("click", function () {
      setOpen(!win.classList.contains("arc-open"));
    });
    close.addEventListener("click", function () {
      setOpen(false);
    });
    greet.addEventListener("click", function () {
      setOpen(true);
    });
    greetX.addEventListener("click", function (e) {
      e.stopPropagation();
      greetDismissed = true;
      hideGreet();
      pulse.style.display = "none";
    });

    // Invite a click shortly after load, then tuck away if ignored.
    setTimeout(showGreet, 2200);
    setTimeout(function () { if (!hasOpened) hideGreet(); }, 13000);

    root.appendChild(launch);
    root.appendChild(win);
    document.body.appendChild(root);
    console.log("Widget launcher added to page");
  }

  function applyConfig(data) {
    if (!data || typeof data !== "object") return;
    if (data.brand_color) cfg.brandColor = data.brand_color;
    if (data.concierge_name) cfg.conciergeName = data.concierge_name;
    if (data.welcome_message) cfg.welcomeMessage = data.welcome_message;
    if (data.reservation_button_label) cfg.reservationLabel = data.reservation_button_label;
    if (data.order_button_label) cfg.orderLabel = data.order_button_label;
    if (data.catering_button_label) cfg.cateringLabel = data.catering_button_label;

    if (Array.isArray(data.action_buttons) && data.action_buttons.length) {
      cfg.actions = data.action_buttons
        .filter(function (b) { return b && (b.label || b.url); })
        .slice(0, 3)
        .map(function (b) { return { label: b.label || "", url: b.url || "", image: b.image || "" }; });
    } else {
      cfg.actions = [
        { label: data.reservation_button_label || cfg.reservationLabel, url: data.reservation_link || "", image: "" },
        { label: data.order_button_label || cfg.orderLabel, url: data.order_online_link || "", image: "" },
        { label: data.catering_button_label || cfg.cateringLabel, url: data.catering_link || "", image: "" },
      ];
    }
  }

  function render() {
    try {
      injectStyles();
      build();
    } catch (err) {
      console.error("[AI Restaurant Concierge] Widget failed to initialize", err);
      var fb = document.createElement("div");
      fb.textContent = "Widget failed to initialize";
      fb.style.cssText =
        "position:fixed;bottom:24px;right:24px;background:#dc2626;color:#fff;padding:10px 14px;border-radius:8px;font:13px sans-serif;z-index:2147483647;";
      document.body.appendChild(fb);
    }
  }

  function init() {
    var rendered = false;
    function go() {
      if (rendered) return;
      rendered = true;
      render();
    }
    // Fetch live appearance config, but never let a slow/unreachable request
    // block the launcher — draw it within 1.5s no matter what.
    var url = apiBase + "/api/widget-config?r=" + encodeURIComponent(restaurantId);
    fetch(url)
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (data && !data.error) applyConfig(data);
      })
      .catch(function () {})
      .then(go);
    setTimeout(go, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
