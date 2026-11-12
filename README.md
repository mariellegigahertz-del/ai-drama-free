# AI Drama Free

AI Drama Free is an installable Android-friendly community web app starter. With Supabase configured, visitors can create accounts, upload short AI-made videos, watch public videos in the app, save stories on their device, see approximate view counts, and report a video. Without a configured backend, it stays in demo mode.

## Important before inviting people

- Videos in the configured bucket are public to anyone with the video URL. Upload only videos you have the right to publish.
- The app displays the uploader's selected rights label; it does not verify copyright ownership or license terms.
- Report submissions are stored in Supabase for you to review. This starter has no automatic moderation or admin dashboard.
- View counts are approximate (at most one count per browser session) and are not protected against deliberate inflation.
- The 50 MB per-video limit is intentional for a small prototype. Public video storage and playback use bandwidth and may exceed a provider's free allowance. Check the current Supabase plan limits before inviting users. This is not a scalable video-streaming service.
- Do not put a Supabase `service_role` or secret key in this website. The browser only needs the project's URL and publishable/anon key; access is restricted by the included row-level security policies.

## Set up the shared community backend

1. Create a project at [Supabase](https://supabase.com/). Keep the database password private.
2. In the Supabase project, open **SQL Editor**, create a query, paste the contents of `supabase-setup.sql`, and run it once. It creates the video and report tables, access policies, a public video bucket, and the view-count function.
3. In Supabase **Project Settings → API** (or **Data API**, depending on the dashboard), copy the **Project URL** and the **publishable key** (older projects may call it the `anon` key). Never copy a `service_role` or secret key.
4. Open `supabase-config.js`. Replace `https://YOUR_PROJECT_ID.supabase.co` with your Project URL and replace `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with your publishable/anon key. This browser key is public; database and storage safety comes from the SQL policies.
5. In Supabase **Authentication → URL Configuration**, set the Site URL to your published GitHub Pages address, for example `https://mariellegigahertz-del.github.io/ai-drama-free/`, and add that same address to the allowed redirect URLs.
6. In GitHub, upload/replace the app files in the repository root, including `supabase-config.js` and `supabase-setup.sql`, then commit the changes. Wait for GitHub Pages to redeploy.
7. Open the published site and create an account. If email confirmation is on, confirm the email before signing in. Test with a small video and verify playback from another device.

`supabase-config.js` contains only public browser settings, but it does identify which Supabase project the website uses. The repository may be public, so do not put passwords, API secret keys, or personal data in it.

## Install on Android

1. Publish the files to an HTTPS host such as GitHub Pages.
2. Open the published address in Chrome on your Android phone.
3. Use Chrome's **Install app** or **Add to Home screen** option.

The app shell can load offline after it has been visited, but accounts, browsing community videos, uploading, reports, and playback require an internet connection.

## Local preview

Serve this folder with a static HTTP server and open its local address in a browser. Service workers and app installation require HTTPS or localhost. Community features additionally require valid Supabase settings and the SQL setup.
