# Deployment Guide

This guide covers deploying your ChatFlow messaging app to Vercel or Netlify.

---

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Project Set Up** - Complete all steps in `SETUP.md`
2. **GitHub Repository** - Your code committed to Git
3. **Vercel or Netlify Account**

---

## Step 1: Prepare Your Code

### Update Configuration

Open `app.js` and replace these placeholders with your actual values:

```javascript
// At the top of app.js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

To get these values:
1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Go to **Settings** → **API**
4. Copy the Project URL and anon public key

---

## Option A: Deploy to Vercel
### Method 1: CLI (Recommended)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login**
```bash
vercel login
```

3. **Deploy**
```bash
vercel
```

4. **Follow the prompts**
```
? Set up and deploy? [Y/N] Y
? Which scope? [your-username]
? Link to existing project? [N] Create new
? What's your project's name? chatflow
? In which directory is your code? ./
? Want to modify settings? [N] N
```

5. **Add Environment Variables**
After deployment, go to project Settings → Environment Variables and add:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your anon public key

### Method 2: Git Integration

1. **Push code to GitHub**
```bash
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

2. **Connect to Vercel**
- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Add environment variables in the settings

3. **Deploy**
- Click "Deploy"

---

## Option B: Deploy to Netlify

### Method 1: Drag & Drop

1. **Build your files**
Ensure you have these files in a folder:
- `index.html`
- `style.css`
- `app.js`

2. **Go to Netlify**
- Open [netlify.com](https://netlify.com)
- Drag your folder to the drop zone

3. **Update Configuration**
After deployment, go to Site Settings → Environment Variables and add your Supabase credentials.

### Method 2: Git Integration

1. **Push code to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

2. **Connect to Netlify**
- Go to [netlify.com](https://netlify.com)
- Click "New site from Git"
- Select GitHub and your repository

3. **Configure Build**
- Build command: (leave empty)
- Publish directory: (leave empty, or enter `.`)
- Add environment variables

4. **Deploy**
- Click "Deploy site"

---

## Step 2: Configure Environment Variables

Whether using Vercel or Netlify, add these:

| Variable | Value |
|----------|-------|
| SUPABASE_URL | `https://your-project.supabase.co` |
| SUPABASE_ANON_KEY | `eyJhbGciOiJIUzI1NiIs...` |

---

## Step 3: Test Your Deployment

1. Open your deployed URL
2. Try registering a new account
3. Test messaging between two users
4. Test file uploads
5. Test voice/video calls

---

## Troubleshooting

### "Failed to loadSupabase"
- Check your environment variables are set correctly
- Ensure Supabase project is not paused

### "Cannot access microphone/camera"
- Your site must be served over HTTPS
- Browser permissions required

### Realtime not working
- Ensure replication is enabled in Supabase (see SETUP.md)
- Check browser console for errors

### Storage upload fails
- Check bucket policies in Supabase
- Ensure file size is under the limit

---

## Custom Domain (Optional)

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Netlify
1. Go to Domain Settings → Custom domains
2. Add your domain
3. Update DNS records

---

## Security Tips

1. **Enable email confirmation** in Supabase Auth settings
2. **Set up RLS policies** properly
3. **Use Row Level Security** on all tables
4. **Keep your keys secure** - never commit them to Git
5. **Use environment variables** for sensitive data

---

## Production Checklist

- [ ] Updated Supabase URL and key in app.js
- [ ] Environment variables set in deployment
- [ ] Database schema created
- [ ] Storage buckets configured
- [ ] Realtime enabled
- [ ] RLS policies verified
- [ ] Tested on multiple browsers
- [ ] HTTPS working

---

## Next Steps

After deployment, you can:
- Add push notifications
- Implement message reactions
- Add group chats
- Add emoji support
- Implement message search
- Add read receipts