# Alexandaria — E-Library & Reference Materials Platform

A full-stack web app for uploading, searching, sharing, and downloading PDF reference materials, each with its own cover image.

## Stack
- **Backend:** Node.js + Express + Multer (file uploads), flat JSON file as the datastore (no database setup needed)
- **Frontend:** Vanilla HTML/CSS/JS — no build step, no framework

## Features
- Upload a PDF + cover image with title, author, category, description, and tags
- Search by title, author, description, or tags
- Filter by category, sort by newest/oldest/title/most downloaded
- Download counter per material
- Share: each material can be shared as its PDF file
- **My Uploads** tab — see only the materials you've personally uploaded (tracked by the name you enter on upload, remembered on your device)
- Fully responsive — works down to small mobile screens

## Setup

1. Make sure you have [Node.js](https://nodejs.org) (v16+) installed.
2. In this folder, install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser to:
   ```
   http://localhost:3000
   ```

That's it — no database, no environment variables, no extra setup.

## How it works

- Uploaded PDFs are stored in `uploads/pdfs/`, cover images in `uploads/covers/`.
- All material metadata (title, author, category, uploader, download count, etc.) lives in `data/materials.json` — a simple flat-file datastore. You can open this file directly to inspect or back up your data.
- "My Uploads" works by remembering the name you typed on your first upload (stored in your browser's localStorage) and filtering the catalog for materials uploaded under that name. Use the same name each time to see all your uploads together.

## API reference

| Method | Endpoint                       | Description                                  |
|--------|---------------------------------|-----------------------------------------------|
| GET    | `/api/materials`                | List materials. Query params: `search`, `category`, `uploader` |
| GET    | `/api/materials/:id`            | Get a single material                        |
| POST   | `/api/materials`                | Upload a new material (multipart form: `pdf`, `cover`, `title`, `author`, `category`, `description`, `tags`, `uploadedBy`) |
| GET    | `/api/materials/:id/download`   | Download the PDF (increments download count)  |
| DELETE | `/api/materials/:id`            | Remove a material and its files               |
| GET    | `/api/categories`               | List distinct categories in use               |

## Notes
- Max file size is 25MB per file (PDF or cover image). Adjust the `limits` value in `server.js` if you need more.
- This uses a flat JSON file rather than a real database, which is fine for personal or small-group use. If you outgrow it, the `readMaterials()`/`writeMaterials()` functions in `server.js` are the only place you'd need to swap out for a real database.
