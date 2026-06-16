# Static assets (served at the site root)

Files in this folder are served from `/`. For example, `public/maitre-ad.mp4`
is available at `/maitre-ad.mp4`.

## Demo video

The landing page hero plays `/maitre-ad.mp4` (autoplay, muted, looping).

1. Put your exported ad here and name it exactly **`maitre-ad.mp4`**.
2. Keep it small for fast loading — aim for **under ~8–10 MB** (compress/trim
   if needed; H.264 MP4, 1080p or 720p).
3. Commit it so it ships to production:
   `git add public/maitre-ad.mp4 && git commit -m "Add demo video"`

If the file is missing the page still loads — the video area just stays blank.
