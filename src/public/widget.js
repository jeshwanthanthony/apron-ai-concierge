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

  var restaurantId = currentScript ? currentScript.getAttribute("data-restaurant") : null;
  var brandColor = (currentScript && currentScript.getAttribute("data-color")) || "#7c3aed";
  var conciergeName = (currentScript && currentScript.getAttribute("data-name")) || "Concierge";
  var welcomeMessage =
    (currentScript && currentScript.getAttribute("data-welcome")) ||
    "Hi there! 👋 How can I help you today? Ask me about our menu, reservations, or hours.";

  console.log("AI Restaurant Concierge widget loaded");
  console.log("Restaurant ID:", restaurantId);

  if (!restaurantId) {
    console.error(
      "[AI Restaurant Concierge] No restaurant ID found. Add data-restaurant=\"<your-id>\" to the script tag."
    );
    return;
  }

  if (window.__aiRestaurantConciergeMounted) {
    console.warn("[AI Restaurant Concierge] Widget already mounted, skipping.");
    return;
  }
  window.__aiRestaurantConciergeMounted = true;

  var CSS =
    "" +
    ".arc-root,.arc-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.4;}" +
    ".arc-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:9999px;background:" +
    brandColor +
    ";color:#fff;border:none;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:transform .2s ease;}" +
    ".arc-bubble:hover{transform:scale(1.06);}" +
    ".arc-bubble svg{width:28px;height:28px;}" +
    ".arc-window{position:fixed;bottom:100px;right:24px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 140px);background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);z-index:2147483647;display:none;flex-direction:column;overflow:hidden;}" +
    ".arc-window.arc-open{display:flex;}" +
    ".arc-header{padding:16px;color:#fff;display:flex;align-items:center;gap:12px;background:" +
    brandColor +
    ";}" +
    ".arc-avatar{width:36px;height:36px;border-radius:9999px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;}" +
    ".arc-title{font-size:14px;font-weight:600;}" +
    ".arc-sub{font-size:11px;opacity:.85;}" +
    ".arc-close{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;}" +
    ".arc-body{flex:1;overflow-y:auto;padding:16px;background:#f8f7f4;display:flex;flex-direction:column;gap:10px;}" +
    ".arc-msg{max-width:85%;padding:10px 14px;border-radius:16px;font-size:13px;color:#111;}" +
    ".arc-msg.arc-bot{background:#fff;border:1px solid #ececec;border-top-left-radius:4px;align-self:flex-start;}" +
    ".arc-msg.arc-user{background:" +
    brandColor +
    ";color:#fff;border-top-right-radius:4px;align-self:flex-end;}" +
    ".arc-quick{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid #ececec;background:#fff;}" +
    ".arc-chip{background:#fff;border:1px solid " +
    brandColor +
    ";color:" +
    brandColor +
    ";padding:6px 12px;border-radius:9999px;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;display:inline-block;}" +
    ".arc-chip:hover{background:" +
    brandColor +
    ";color:#fff;}" +
    ".arc-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #ececec;background:#fff;}" +
    ".arc-input{flex:1;border:1px solid #e3e3e3;border-radius:9999px;padding:8px 14px;font-size:13px;outline:none;}" +
    ".arc-input:focus{border-color:" +
    brandColor +
    ";}" +
    ".arc-send{background:" +
    brandColor +
    ";color:#fff;border:none;border-radius:9999px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;}";

  function injectStyles() {
    var style = document.createElement("style");
    style.setAttribute("data-arc", "true");
    style.appendChild(document.createTextNode(CSS));
    document.head.appendChild(style);
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
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
    titleWrap.appendChild(el("div", "arc-title", conciergeName));
    titleWrap.appendChild(el("div", "arc-sub", "Online now"));
    header.appendChild(titleWrap);
    var close = el("button", "arc-close", "×");
    close.setAttribute("aria-label", "Close chat");
    header.appendChild(close);

    var body = el("div", "arc-body");
    body.appendChild(el("div", "arc-msg arc-bot", escapeHtml(welcomeMessage)));

    var quick = el("div", "arc-quick");
    var actions = [
      { label: "Reserve Table", action: "reserve" },
      { label: "Order Online", action: "order" },
      { label: "Catering Inquiry", action: "catering" },
    ];
    actions.forEach(function (a) {
      var chip = el("button", "arc-chip", a.label);
      chip.addEventListener("click", function () {
        addMsg(body, a.label, "user");
        setTimeout(function () {
          var reply =
            a.action === "reserve"
              ? "Awesome — I can help you book a table. What date and time work best?"
              : a.action === "order"
              ? "Great! Would you like delivery or pickup? I can share our online ordering link."
              : "Happy to help with catering! How many guests and what date are you planning for?";
          addMsg(body, reply, "bot");
        }, 500);
      });
      quick.appendChild(chip);
    });

    var inputRow = el("div", "arc-input-row");
    var input = el("input", "arc-input");
    input.setAttribute("placeholder", "Type a message…");
    var send = el("button", "arc-send", "Send");
    inputRow.appendChild(input);
    inputRow.appendChild(send);

    function submit() {
      var v = input.value.trim();
      if (!v) return;
      addMsg(body, v, "user");
      input.value = "";
      setTimeout(function () {
        addMsg(
          body,
          "Thanks! I'll get back to you shortly. (This is a preview — AI replies will go live soon.)",
          "bot"
        );
      }, 600);
    }
    send.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
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

  function addMsg(container, text, who) {
    var m = el("div", "arc-msg " + (who === "user" ? "arc-user" : "arc-bot"), escapeHtml(text));
    container.appendChild(m);
    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function init() {
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
