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
    conciergeName: attr("data-name", "Concierge"),
    welcomeMessage: attr("data-welcome", "Hi there! 👋 How can I help you today? Ask me about our menu, reservations, or hours."),
    reservationLabel: "Reserve a Table",
    orderLabel: "Order Online",
    cateringLabel: "Catering Inquiry",
  };

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
      ".arc-bubble{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border-radius:9999px;background:" + c + ";color:#fff;border:none;cursor:pointer;box-shadow:0 12px 30px -8px rgba(0,0,0,.4);z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:transform .2s ease;}" +
      ".arc-bubble:hover{transform:scale(1.06);}" +
      ".arc-bubble svg{width:26px;height:26px;}" +
      ".arc-window{position:fixed;bottom:96px;right:24px;width:380px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 130px);background:#fff;border-radius:20px;box-shadow:0 30px 70px -20px rgba(15,15,25,.4);z-index:2147483647;display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(0,0,0,.06);}" +
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
      ".arc-quick{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 0;background:#fff;border-top:1px solid #f0f0f0;}" +
      ".arc-chip{background:#fff;border:1px solid #e4e4e7;color:#3f3f46;padding:7px 13px;border-radius:9999px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}" +
      ".arc-chip:hover{background:#18181b;border-color:#18181b;color:#fff;}" +
      ".arc-input-row{display:flex;gap:8px;align-items:center;padding:12px;background:#fff;border-top:1px solid #f0f0f0;}" +
      ".arc-input{flex:1;border:1px solid #e4e4e7;background:#fafafa;border-radius:9999px;padding:10px 16px;font-size:13.5px;outline:none;transition:all .15s;color:#18181b;}" +
      ".arc-input:focus{background:#fff;border-color:" + c + ";}" +
      ".arc-send{width:38px;height:38px;flex-shrink:0;background:" + c + ";color:#fff;border:none;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s;}" +
      ".arc-send:disabled{opacity:.4;cursor:not-allowed;}" +
      ".arc-send svg{width:16px;height:16px;}";

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

  function build() {
    var root = el("div", "arc-root");

    var bubble = el(
      "button",
      "arc-bubble",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    );
    bubble.setAttribute("aria-label", "Open chat");

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
    [cfg.reservationLabel, cfg.orderLabel, cfg.cateringLabel].forEach(function (label) {
      if (!label) return;
      var chip = el("button", "arc-chip", escapeHtml(label));
      chip.addEventListener("click", function () {
        ask(label);
      });
      quick.appendChild(chip);
    });

    var inputRow = el("div", "arc-input-row");
    var input = el("input", "arc-input");
    input.setAttribute("placeholder", "Ask about reservations, menu, hours…");
    var send = el(
      "button",
      "arc-send",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    );
    inputRow.appendChild(input);
    inputRow.appendChild(send);

    var busy = false;

    function ask(text) {
      var v = (text != null ? text : input.value).trim();
      if (!v || busy) return;
      input.value = "";
      if (quick.parentNode) quick.style.display = "none";
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

    win.appendChild(header);
    win.appendChild(body);
    win.appendChild(quick);
    win.appendChild(inputRow);

    bubble.addEventListener("click", function () {
      win.classList.toggle("arc-open");
    });
    close.addEventListener("click", function () {
      win.classList.remove("arc-open");
    });

    root.appendChild(bubble);
    root.appendChild(win);
    document.body.appendChild(root);
    console.log("Widget bubble added to page");
  }

  function applyConfig(data) {
    if (!data || typeof data !== "object") return;
    if (data.brand_color) cfg.brandColor = data.brand_color;
    if (data.concierge_name) cfg.conciergeName = data.concierge_name;
    if (data.welcome_message) cfg.welcomeMessage = data.welcome_message;
    if (data.reservation_button_label) cfg.reservationLabel = data.reservation_button_label;
    if (data.order_button_label) cfg.orderLabel = data.order_button_label;
    if (data.catering_button_label) cfg.cateringLabel = data.catering_button_label;
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
    var url = apiBase + "/api/widget-config?r=" + encodeURIComponent(restaurantId);
    fetch(url)
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (data && !data.error) applyConfig(data);
      })
      .catch(function () {})
      .then(function () {
        render();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
