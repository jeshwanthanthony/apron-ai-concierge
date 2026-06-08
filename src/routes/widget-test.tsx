import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/widget-test")({
  component: WidgetTest,
});

function WidgetTest() {
  const [rid, setRid] = useState("demo-restaurant-id");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r") || rid;
    setRid(r);
    const s = document.createElement("script");
    s.src = "/widget.js";
    s.async = true;
    s.setAttribute("data-restaurant", r);
    document.body.appendChild(s);
    setLoaded(true);
  }, [loaded, rid]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px", fontFamily: "system-ui" }}>
      <h1>Widget Test Page</h1>
      <p>This page loads <code>/widget.js</code> just like an external Wix or Squarespace site would.</p>
      <p>Restaurant ID in use: <code>{rid}</code></p>
      <p>Pass <code>?r=YOUR_RESTAURANT_ID</code> in the URL to test with your real ID.</p>
      <p>You should see a chat bubble in the bottom-right corner. Open your browser console to see widget logs.</p>
    </div>
  );
}
