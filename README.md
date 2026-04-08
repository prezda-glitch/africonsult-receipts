# AfriConsult Receipt Manager

AI-powered receipt scanner and expense management app for Tanzanian tax consultants.

## Features

- **AI OCR** -- Snap a photo of any receipt; Claude Vision auto-extracts vendor, amount, date, VAT, EFD number, and category
- **Client folders** -- Organize receipts by client with TIN tracking
- **Excel export** -- Download categorized expense reports with VAT summary sheets
- **Tax reports** -- Category breakdowns with deductibility flags aligned to TRA requirements
- **PWA** -- Install on iPhone/Android home screen, works offline for data viewing
- **Persistent storage** -- IndexedDB keeps all data across sessions

---

## Quick Deploy to Vercel (Recommended)

### Step 1: Get an Anthropic API key

1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key
3. Copy it (starts with `sk-ant-...`)

### Step 2: Push to GitHub

```bash
cd africonsult-receipts
git init
git add .
git commit -m "AfriConsult Receipt Manager v1"
git remote add origin https://github.com/YOUR_USERNAME/africonsult-receipts.git
git push -u origin main
```

### Step 3: Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Import your `africonsult-receipts` repo
4. In the "Environment Variables" section, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your API key from Step 1
5. Click "Deploy"

Your app will be live at `https://africonsult-receipts.vercel.app` (or your custom domain) within 60 seconds.

### Step 4: Add your custom domain (optional)

1. In Vercel dashboard, go to Settings > Domains
2. Add `receipts.africonsult.co.tz` (or any subdomain)
3. Update your DNS records as instructed by Vercel

---

## Install on iPhone

1. Open your deployed URL in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. The app now appears on your home screen with the AfriConsult icon
5. It opens full-screen like a native app

## Install on Android

1. Open your deployed URL in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home screen" or "Install app"

---

## Run Locally

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Start dev server
npm run dev
# Opens at http://localhost:3000
```

---

## Project Structure

```
africonsult-receipts/
  api/
    ocr.js            # Serverless function -- proxies OCR to Anthropic API
  public/
    manifest.json      # PWA manifest for home screen install
    icon-192.png       # App icon (192x192)
    icon-512.png       # App icon (512x512)
  src/
    App.jsx            # Main React application
    main.jsx           # React entry point
    storage.js         # IndexedDB wrapper (persistent data)
  .env.example         # Environment variables template
  .gitignore
  index.html           # HTML entry with PWA meta tags
  package.json
  vercel.json          # Vercel deployment config
  vite.config.js       # Vite build config
```

---

## Security Notes

- The Anthropic API key is **never exposed to the browser**. All OCR calls go through the `/api/ocr` serverless function which keeps the key server-side.
- Receipt data is stored in the user's browser (IndexedDB). Nothing is sent to any server except the OCR images.
- For multi-user production use, add authentication (Firebase Auth, Clerk, or Auth0) and move storage to a database (Supabase, PlanetScale, or Firebase).

---

## Cost Estimate

- **Vercel hosting**: Free tier covers most small businesses (100GB bandwidth/month)
- **Anthropic API (OCR)**: ~$0.01-0.03 per receipt scan (Claude Sonnet, single image)
- **At 200 receipts/month**: ~$4-6/month total API cost

---

## Next Steps for Production

1. **Authentication** -- Add user login so clients can access their own folders
2. **Database** -- Move from IndexedDB to Supabase/Firebase for multi-device sync
3. **Notifications** -- Email/SMS reminders for EFD filing deadlines
4. **TRA integration** -- Auto-match receipts to VAT return line items
5. **Multi-consultant** -- Dashboard for managing multiple consultants

---

Built by AfriConsult Solutions Ltd
www.africonsult.co.tz | info@africonsult.co.tz | +255 712 665 880
