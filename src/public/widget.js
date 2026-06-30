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
    launcherPulse: "once",
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

  // Bot message avatar: the uploaded logo, or the concierge's initial.
  function botAva() {
    if (cfg.logo) {
      var a = el("div", "arc-bava");
      var img = el("img");
      img.setAttribute("src", cfg.logo);
      img.setAttribute("alt", "");
      a.appendChild(img);
      return a;
    }
    return el("div", "arc-bava", escapeHtml(initial()));
  }

  function injectStyles() {
    var c = cfg.brandColor;
    var rad = cfg.logoShape === "rounded" ? "28%" : cfg.logoShape === "squircle" ? "40%" : "9999px";
    var CSS =
      ".arc-root,.arc-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
      ".arc-launch{position:fixed;bottom:24px;right:24px;z-index:2147483646;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}" +
      ".arc-bubble{position:relative;width:64px;height:64px;border-radius:9999px;background:" + c + ";color:#fff;border:none;cursor:pointer;box-shadow:0 10px 26px -6px rgba(0,0,0,.5),0 2px 6px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s;}" +
      ".arc-bubble:hover{transform:scale(1.09) translateY(-2px);box-shadow:0 16px 34px -8px rgba(0,0,0,.55);}" +
      ".arc-bubble:active{transform:scale(.95);}" +
      ".arc-bubble svg{width:28px;height:28px;transition:transform .3s ease;}" +
      ".arc-bubble-logo{width:100%;height:100%;border-radius:9999px;object-fit:cover;display:block;}" +
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
      ".arc-ava-dot{width:36px;height:36px;border-radius:" + rad + ";background:" + c + ";display:flex;align-items:center;justify-content:center;color:#fff;}" +
      ".arc-ava-dot svg{width:16px;height:16px;}" +
      ".arc-ava-img{width:36px;height:36px;border-radius:" + rad + ";object-fit:cover;display:block;}" +
      ".arc-online{position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:9999px;background:#10b981;border:2px solid #fff;}" +
      ".arc-htext{flex:1;line-height:1.2;}" +
      ".arc-title{font-size:13px;font-weight:600;color:#18181b;}" +
      ".arc-sub{font-size:11px;color:#71717a;}" +
      ".arc-close{background:transparent;border:none;color:#a1a1aa;cursor:pointer;font-size:20px;line-height:1;padding:6px;border-radius:9999px;}" +
      ".arc-close:hover{background:#f4f4f5;color:#3f3f46;}" +
      ".arc-body{flex:1;overflow-y:auto;padding:18px;background:#fafafa;display:flex;flex-direction:column;gap:12px;}" +
      ".arc-row{display:flex;align-items:flex-end;gap:8px;}" +
      ".arc-row.arc-u{justify-content:flex-end;}" +
      ".arc-bava{width:26px;height:26px;border-radius:" + rad + ";background:" + c + ";color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}" +
      ".arc-bava img{width:100%;height:100%;object-fit:cover;display:block;}" +
      ".arc-msg{max-width:86%;padding:11px 15px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;}" +
      ".arc-msg.arc-bot{background:#fff;border:1px solid #ececf1;color:#1f2937;border-radius:18px;border-bottom-left-radius:6px;box-shadow:0 2px 8px -2px rgba(15,23,42,.07);}" +
      ".arc-msg.arc-user{background:" + c + ";color:#fff;border-radius:18px;border-bottom-right-radius:6px;box-shadow:0 4px 12px -4px " + c + "66;}" +
      ".arc-typing{display:flex;gap:4px;align-items:center;padding:14px 15px;}" +
      ".arc-typing span{width:6px;height:6px;border-radius:9999px;background:#c4c4cc;display:inline-block;animation:arc-bounce 1.2s infinite ease-in-out;}" +
      ".arc-typing span:nth-child(1){animation-delay:-.24s;}.arc-typing span:nth-child(2){animation-delay:-.12s;}" +
      "@keyframes arc-bounce{0%,80%,100%{transform:scale(.6);opacity:.5;}40%{transform:scale(1);opacity:1;}}" +
      ".arc-quick{display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px 6px;background:#fff;border-top:1px solid #f0f0f0;}" +
      ".arc-card{display:inline-flex;align-items:center;gap:9px;max-width:100%;padding:8px 14px 8px 8px;border:1px solid #e6e6ea;border-radius:13px;background:#fff;color:#27272a;text-decoration:none;cursor:pointer;font-size:13px;font-weight:600;line-height:1.25;transition:transform .15s,box-shadow .15s,border-color .15s;}" +
      ".arc-card:hover{transform:translateY(-1px);box-shadow:0 9px 20px -10px rgba(0,0,0,.32);border-color:" + c + ";}" +
      ".arc-card-ico{width:26px;height:26px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;color:#fff;}" +
      ".arc-card-ico svg{width:13px;height:13px;}" +
      ".arc-card-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
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
    row.appendChild(botAva());
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
    // Idempotent: if we already drew the widget (e.g. with defaults before the
    // live config arrived), remove it so this rebuild replaces it cleanly.
    var existingRoot = document.querySelector(".arc-root");
    if (existingRoot) existingRoot.remove();
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
    // The closed-state launcher shows the restaurant logo (if set), else a chat icon.
    function closedIcon() {
      return cfg.logo ? '<img class="arc-bubble-logo" src="' + cfg.logo + '" alt="">' : CHAT_ICON;
    }
    var iconWrap = el("span", null, closedIcon());
    iconWrap.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;height:100%;";
    var blip = el("span", "arc-blip");
    bubble.appendChild(pulse);
    bubble.appendChild(iconWrap);
    bubble.appendChild(blip);

    launch.appendChild(greet);
    launch.appendChild(bubble);

    var win = el("div", "arc-window");

    var header = el("div", "arc-header");
    var ava = el("div", "arc-ava");
    if (cfg.logo) {
      var avaImg = el("img", "arc-ava-img");
      avaImg.setAttribute("src", cfg.logo);
      avaImg.setAttribute("alt", "");
      ava.appendChild(avaImg);
    } else {
      ava.appendChild(
        el("div", "arc-ava-dot", '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>')
      );
    }
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
      var ico = el("div", "arc-card-ico");
      if (b.image) {
        ico.style.backgroundImage = 'url("' + String(b.image).replace(/"/g, "") + '")';
      } else {
        ico.style.background = "linear-gradient(135deg," + cfg.brandColor + ",rgba(0,0,0,.28))";
        ico.innerHTML = CARD_ICON;
      }
      card.appendChild(ico);
      card.appendChild(el("span", "arc-card-label", escapeHtml(b.label || "Open")));
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
      typing.appendChild(botAva());
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
    var alwaysPulse = cfg.launcherPulse === "always";

    function showGreet() {
      if (greetDismissed) return;
      if (win.classList.contains("arc-open")) return;
      // Normally only invite before the first open; in "always" mode keep re-inviting.
      if (hasOpened && !alwaysPulse) return;
      greet.classList.add("arc-show");
    }
    function hideGreet() {
      greet.classList.remove("arc-show");
    }

    function setOpen(open) {
      if (open) {
        win.classList.add("arc-open");
        iconWrap.innerHTML = CLOSE_ICON;
        // In "always" mode the pulse keeps inviting even after opening.
        if (!alwaysPulse) {
          pulse.style.display = "none";
          blip.style.display = "none";
        }
        hideGreet();
        hasOpened = true;
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 80);
      } else {
        win.classList.remove("arc-open");
        iconWrap.innerHTML = closedIcon();
        if (alwaysPulse) {
          pulse.style.display = "";
          blip.style.display = "";
        }
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
      // Keep the attention pulse going in "always" mode even if the greeting is dismissed.
      if (!alwaysPulse) pulse.style.display = "none";
    });

    // Invite a click shortly after load, then tuck away if ignored.
    setTimeout(showGreet, 2200);
    setTimeout(function () { if (!hasOpened) hideGreet(); }, 13000);
    // In "always" mode, re-show the greeting periodically while the chat is closed.
    if (alwaysPulse) {
      setInterval(function () {
        if (greetDismissed || win.classList.contains("arc-open")) return;
        showGreet();
        setTimeout(hideGreet, 8000);
      }, 30000);
    }

    root.appendChild(launch);
    root.appendChild(win);
    document.body.appendChild(root);
    console.log("Widget launcher added to page");
  }

  function applyConfig(data) {
    if (!data || typeof data !== "object") return;
    if (data.brand_color) cfg.brandColor = data.brand_color;
    if (data.concierge_name) cfg.conciergeName = data.concierge_name;
    // Use empty-string fallback so clearing the logo in the dashboard also syncs.
    if ("logo_url" in data) cfg.logo = data.logo_url || "";
    if (data.logo_shape) cfg.logoShape = data.logo_shape;
    if (data.launcher_pulse) cfg.launcherPulse = data.launcher_pulse;
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

  // A fingerprint of the visible appearance — used to detect live changes.
  var renderedSig = "";
  function configSignature() {
    return [
      cfg.brandColor,
      cfg.logo || "",
      cfg.logoShape || "circle",
      cfg.launcherPulse || "once",
      cfg.conciergeName,
      cfg.welcomeMessage,
      JSON.stringify(cfg.actions || []),
    ].join("|");
  }

  function fetchConfig() {
    // Cache-bust so we always get the latest settings (endpoint is no-store too).
    var url = apiBase + "/api/widget-config?r=" + encodeURIComponent(restaurantId) + "&t=" + Date.now();
    return fetch(url).then(function (res) {
      return res.ok ? res.json() : null;
    });
  }

  function render() {
    try {
      injectStyles();
      build();
      renderedSig = configSignature();
    } catch (err) {
      console.error("[AI Restaurant Concierge] Widget failed to initialize", err);
      var fb = document.createElement("div");
      fb.textContent = "Widget failed to initialize";
      fb.style.cssText =
        "position:fixed;bottom:24px;right:24px;background:#dc2626;color:#fff;padding:10px 14px;border-radius:8px;font:13px sans-serif;z-index:2147483647;";
      document.body.appendChild(fb);
    }
  }

  // Poll for dashboard changes and apply them live (no page reload, no
  // re-pasting the snippet). Only rebuild when the chat is closed, so we never
  // interrupt an active conversation.
  function startPolling() {
    setInterval(function () {
      // Don't waste requests/CPU while the tab is backgrounded.
      if (document.hidden) return;
      fetchConfig()
        .then(function (data) {
          if (!data || data.error) return;
          applyConfig(data);
          if (configSignature() === renderedSig) return; // nothing changed
          var win = document.querySelector(".arc-window");
          var open = win && win.classList.contains("arc-open");
          if (!open) render();
        })
        .catch(function () {});
    }, 20000);
  }

  function init() {
    var configLoaded = false;
    // Fetch live appearance config. When it arrives we (re)render with the real
    // color/logo/buttons — even if the fallback already drew the launcher.
    fetchConfig()
      .then(function (data) {
        if (data && !data.error) applyConfig(data);
        configLoaded = true;
        render();
        startPolling();
      })
      .catch(function () {
        configLoaded = true;
        render();
        startPolling();
      });
    // Never let a slow/unreachable request block the launcher — draw it within
    // 1.5s with defaults. If the config resolves later, render() runs again and
    // replaces it (build() is idempotent), so color + logo sync in.
    setTimeout(function () {
      if (!configLoaded) render();
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
