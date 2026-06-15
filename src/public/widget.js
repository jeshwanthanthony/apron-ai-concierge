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

  // The concierge API + config live on the same origin that served this script.
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
    console.error(
      '[AI Restaurant Concierge] No restaurant ID found. Add data-restaurant="<your-id>" to the script tag.'
    );
    return;
  }

  if (window.__aiRestaurantConciergeMounted) {
    console.warn("[AI Restaurant Concierge] Widget already mounted, skipping.");
    return;
  }
  window.__aiRestaurantConciergeMounted = true;

  // Defaults come from the script tag; live values are fetched from the server
  // (so dashboard changes apply without re-pasting the snippet).
  var cfg = {
    brandColor: attr("data-color", "#7c3aed"),
    conciergeName: attr("data-name", "Concierge"),
    welcomeMessage: attr(
      "data-welcome",
      "Hi there! 👋 How can I help you today? Ask me about our menu, reservations, or hours."
    ),
    reservationLabel: "Reserve a Table",
    orderLabel: "Order Online",
    cateringLabel: "Catering Inquiry",
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function injectStyles() {
    var c = cfg.brandColor;
    var CSS =
      "" +
      ".arc-root,.arc-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.4;}" +
      ".arc-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:9999px;background:" +
      c +
      ";color:#fff;border:none;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:transform .2s ease;}" +
      ".arc-bubble:hover{transform:scale(1.06);}" +
      ".arc-bubble svg{width:28px;height:28px;}" +
      ".arc-window{position:fixed;bottom:100px;right:24px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 140px);background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);z-index:2147483647;display:none;flex-direction:column;overflow:hidden;}" +
      ".arc-window.arc-open{display:flex;}" +
      ".arc-header{padding:16px;color:#fff;display:flex;align-items:center;gap:12px;background:" +
      c +
      ";}" +
      ".arc-avatar{width:36px;height:36px;border-radius:9999px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;}" +
      ".arc-title{font-size:14px;font-weight:600;}" +
      ".arc-sub{font-size:11px;opacity:.85;}" +
      ".arc-close{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;}" +
      ".arc-body{flex:1;overflow-y:auto;padding:16px;background:#f8f7f4;display:flex;flex-direction:column;gap:10px;}" +
      ".arc-msg{max-width:85%;padding:10px 14px;border-radius:16px;font-size:13px;color:#111;white-space:pre-wrap;}" +
      ".arc-msg.arc-bot{background:#fff;border:1px solid #ececec;border-top-left-radius:4px;align-self:flex-start;}" +
      ".arc-msg.arc-user{background:" +
      c +
      ";color:#fff;border-top-right-radius:4px;align-self:flex-end;}" +
      ".arc-msg.arc-typing{opacity:.55;letter-spacing:2px;}" +
      ".arc-quick{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid #ececec;background:#fff;}" +
      ".arc-chip{background:#fff;border:1px solid " +
      c +
      ";color:" +
      c +
      ";padding:6px 12px;border-radius:9999px;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;display:inline-block;}" +
      ".arc-chip:hover{background:" +
      c +
      ";color:#fff;}" +
      ".arc-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #ececec;background:#fff;}" +
      ".arc-input{flex:1;border:1px solid #e3e3e3;border-radius:9999px;padding:8px 14px;font-size:13px;outline:none;}" +
      ".arc-input:focus{border-color:" +
      c +
      ";}" +
      ".arc-send{background:" +
      c +
      ";color:#fff;border:none;border-radius:9999px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;}";

    var existing = document.querySelector("style[data-arc]");
    if (existing) existing.remove();
    var style = document.createElement("style");
    style.setAttribute("data-arc", "true");
    style.appendChild(document.createTextNode(CSS));
    document.head.appendChild(style);
  }

  function addMsg(container, text, who) {
    var m = el("div", "arc-msg " + (who === "user" ? "arc-user" : "arc-bot"), escapeHtml(text));
    container.appendChild(m);
    container.scrollTop = container.scrollHeight;
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
    header.appendChild(
      el(
        "div",
        "arc-avatar",
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>'
      )
    );
    var titleWrap = el("div");
    titleWrap.appendChild(el("div", "arc-title", escapeHtml(cfg.conciergeName)));
    titleWrap.appendChild(el("div", "arc-sub", "Online now"));
    header.appendChild(titleWrap);
    var close = el("button", "arc-close", "×");
    close.setAttribute("aria-label", "Close chat");
    header.appendChild(close);

    var body = el("div", "arc-body");
    body.appendChild(el("div", "arc-msg arc-bot", escapeHtml(cfg.welcomeMessage)));

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
    input.setAttribute("placeholder", "Type a message…");
    var send = el("button", "arc-send", "Send");
    inputRow.appendChild(input);
    inputRow.appendChild(send);

    var busy = false;

    function ask(text) {
      var v = (text != null ? text : input.value).trim();
      if (!v || busy) return;
      input.value = "";
      addMsg(body, v, "user");
      chatHistory.push({ role: "user", content: v });

      busy = true;
      send.setAttribute("disabled", "true");
      var typing = el("div", "arc-msg arc-bot arc-typing", "…");
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      fetch(apiBase + "/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurantId,
          question: v,
          history: chatHistory.slice(-8),
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (r) {
          var reply =
            r.ok && r.data && r.data.answer
              ? r.data.answer
              : (r.data && r.data.error) || "Sorry, something went wrong. Please try again.";
          chatHistory.push({ role: "assistant", content: reply });
          if (typing.parentNode) typing.parentNode.removeChild(typing);
          addMsg(body, reply, "bot");
        })
        .catch(function () {
          if (typing.parentNode) typing.parentNode.removeChild(typing);
          addMsg(body, "Sorry, I couldn't reach the concierge. Please try again.", "bot");
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
    // Fetch live appearance config, then render. If it fails, render with the
    // snippet's data-* attributes so the widget still appears.
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
