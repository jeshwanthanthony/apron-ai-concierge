import { createFileRoute } from "@tanstack/react-router";
// @ts-expect-error - vite raw import
import widgetSource from "../../public/widget.js?raw";

export const Route = createFileRoute("/widget.js")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(widgetSource, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
