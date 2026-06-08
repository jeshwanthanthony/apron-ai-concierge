import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/widget-test")({
  component: WidgetTest,
});

function WidgetTest() {
  const [rid, setRid] = useState("demo-restaurant-id");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r") || "demo-restaurant-id";
    setRid(r);

    // Remove any previous instance for hot reloads
    document.querySelectorAll("script[data-arc-widget]").forEach((s) => s.remove());
    document.querySelectorAll(".arc-root").forEach((n) => n.remove());
    // @ts-expect-error - flag on window
    window.__aiRestaurantConciergeMounted = false;

    const s = document.createElement("script");
    s.src = "/widget.js";
    s.async = true;
    s.setAttribute("data-arc-widget", "true");
    s.setAttribute("data-restaurant", r);
    s.setAttribute("data-color", "#dc2626");
    s.setAttribute("data-name", "Concierge");
    s.onerror = () => {
      console.error("[widget-test] Failed to load /widget.js");
      const fb = document.createElement("div");
      fb.textContent = "Widget failed to initialize";
      fb.style.cssText =
        "position:fixed;bottom:24px;right:24px;background:#dc2626;color:#fff;padding:10px 14px;border-radius:8px;font:13px sans-serif;z-index:2147483647;";
      document.body.appendChild(fb);
    };
    document.body.appendChild(s);
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: "48px", fontFamily: "system-ui" }}>
      <h1>Widget Test Page</h1>
      <p>
        This page loads <code>/widget.js</code> via a real <code>&lt;script&gt;</code> tag, exactly like Wix or
        Squarespace would.
      </p>
      <p>
        Restaurant ID in use: <code>{rid}</code>
      </p>
      <p>
        Pass <code>?r=YOUR_RESTAURANT_ID</code> in the URL to test with your real ID.
      </p>
      <p>
        You should see a red chat bubble in the bottom-right corner. Open the browser console for logs:
        <code> "AI Restaurant Concierge widget loaded"</code>, <code>"Restaurant ID:"</code>,{" "}
        <code>"Widget bubble added to page"</code>.
      </p>
      <p>
        Direct script URL: <a href="/widget.js">/widget.js</a> (should return JavaScript).
      </p>
    </div>
  );
}
