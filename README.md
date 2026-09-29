# About Me Website — Cesar Espitia

A 6-page personal website built with HTML, CSS, and JavaScript (client + server),
running on an Express server in Replit with persistent App Storage and a
password-protected Admin dashboard.

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Name, photo, biography, media highlights, contact links + contact form |
| Media | `media.html` | Gallery of 9+ cards (images, video, social post) with hover animations |
| Future | `future.html` | 5-year roadmap and long-term goals |
| Hobbies & Interests | `hobbies.html` | Choice page #1 |
| Travel & Places | `travel.html` | Choice page #2 |
| Admin | `admin.html` | Password-protected dashboard for contact submissions |

## Running in Replit

1. Create a Repl from the **Node.js** template and import this repository
   (or upload these files into your existing Repl).
2. In the Replit **Secrets** tab (Tools → Secrets), add a secret named
   `ADMIN_PASSWORD` with your chosen admin password.
   ⚠️ If this secret is missing, the server falls back to the development
   default `admin123` — always set the secret before publishing.
3. Install dependencies and start the server:
   ```bash
   npm install
   npm start
   ```
4. Open the webview (port 3000) and **Publish** the Repl when done.

## How it works

### Contact form (Home page)
- Client-side validation in `script.js`, server-side validation in `server.js`.
- `POST /api/contact` validates the data, then appends the record to
  `data/contactReceived.json` in **Replit App Storage**
  (via `@replit/object-storage`), initialized to `[]` if it does not exist.
- Each record includes `id`, `firstName`, `lastName`, `email`, `reason`,
  `message`, `submittedAt` (ISO 8601), `replied: false`, `repliedAt: null`.
- Success → HTTP 201 and a confirmation message; validation failure → HTTP 400;
  storage failure → HTTP 500 with an error message in the UI.

### Admin dashboard (admin.html + admin.js)
- `POST /api/admin/login` verifies the password **on the server** and returns a
  session token (kept in memory in the browser, never in localStorage).
- `GET /api/admin/messages` returns all submissions, newest first (requires auth).
- `PATCH /api/admin/messages/:id/replied` marks a message as replied and saves
  `repliedAt` (requires auth).
- The dashboard calculates **Total / New / Replied / Reply Rate** from the live
  data and renders a **Messages by Reason for Contact** bar chart (custom SVG,
  no external library) that updates whenever the data changes.

## Replace the placeholders

- Swap the SVG placeholders in `assets/images/` with your own photos
  (keep the same filenames, or update the `src` attributes).
- Add a real video: see `assets/videos/README.txt`.
- Update the email/social links in the Contact section of `index.html`
  (search for `TODO`).
- Update the video card and the social post card on `media.html` with your own
  video and social media post.

## File structure

```
index.html        Home page
media.html        Media gallery page
future.html       Future goals page
hobbies.html      Choice page #1 - Hobbies & Interests
travel.html       Choice page #2 - Travel & Places
admin.html        Admin dashboard
styles.css        Global styles
script.js         Client-side JavaScript (contact form)
admin.js          Admin dashboard JavaScript
server.js         Express server + API + App Storage
package.json      Dependencies and start script
assets/
  images/         Site images
  videos/         Site videos
```

Contact data lives in Replit App Storage at `data/contactReceived.json`
(not in the repository).
