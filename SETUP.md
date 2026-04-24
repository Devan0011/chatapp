# Supabase Setup Guide

This guide covers setting up Supabase for your real-time messaging app.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in details:
   - **Name**: ChatApp
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to you
4. Wait for project to be ready (2-3 minutes)

---

## 2. Get Your Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xyzabc.supabase.co`)
   - **anon public** key (e.g., `eyJhbGciOiJIUzI1NiIs...`)
3. You'll need these in your app.js

---

## 3. Database Schema

Run this SQL in the **SQL Editor** to create tables:

### Users Table (synced with auth.users)
```sql
-- Create public profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policy: Users can read all profiles
create policy "Public profiles are viewable by everyone"
on public.profiles for select using (true);

-- Policy: Users can update their own profile
create policy "Users can update own profile"
on public.profiles for update using (auth.uid() = id);
```

### Messages Table
```sql
-- Create messages table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text,
  type text default 'text' check (type in ('text', 'audio', 'file')),
  file_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  seen boolean default false,
  deleted boolean default false,
  deleted_for_everyone boolean default false
);

-- Enable RLS
alter table public.messages enable row level security;

-- Policy: Users can read messages they sent or received
create policy "Users can read own messages"
on public.messages for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Policy: Users can insert their own messages
create policy "Users can insert own messages"
on public.messages for insert
with check (auth.uid() = sender_id);

-- Policy: Users can update their own messages
create policy "Users can update own messages"
on public.messages for update
using (auth.uid() = sender_id);

-- Policy: Users can delete their own messages
create policy "Users can delete own messages"
on public.messages for delete
using (auth.uid() = sender_id);
```

### Calls Table (for WebRTC signaling)
```sql
-- Create calls table
create table public.calls (
  id uuid default gen_random_uuid() primary key,
  caller_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  type text default 'voice' check (type in ('voice', 'video')),
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'ended')),
  offer jsonb,
  answer jsonb,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Enable RLS
alter table public.calls enable row level security;

-- Policy: Only participants can see the call
create policy "Participants can see calls"
on public.calls for all
using (auth.uid() = caller_id or auth.uid() = receiver_id);
```

---

## 4. Enable Realtime

1. Go to **Database** → **Replication**
2. Click **Source** and add:
   - Table: `messages`
   - Events: INSERT, UPDATE, DELETE
3. Do the same for `calls` table

Or run SQL:
```sql
-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;

-- Enable realtime for calls
alter publication supabase_realtime add table public.calls;
```

---

## 5. Storage Setup

1. Go to **Storage** → **New Bucket**
2. Create two buckets:

### a) Chat Files Bucket
- **Name**: `chat-files`
- **Public**: Yes (checked)
- **File size limit**: 50MB

### b) Voice Messages Bucket
- **Name**: `voice-messages`
- **Public**: Yes (checked)
- **File size limit**: 10MB

3. Set storage policies:

```sql
-- Allow authenticated users to upload files
create policy "Authenticated users can upload"
on storage.objects for insert
with check (bucket_id in ('chat-files', 'voice-messages') and auth.role() = 'authenticated');

-- Allow anyone to view files
create policy "Anyone can view files"
on storage.objects for select
using (bucket_id in ('chat-files', 'voice-messages'));

-- Allow owners to delete their files
create policy "Users can delete own files"
on storage.objects for delete
using (auth.uid() = owner);
```

---

## 6. Create Trigger for Auto-creating Profile

Run this SQL to automatically create a profile when a user signs up:

```sql
-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, new.raw_user_meta_data->>'name', new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 7. Environment Variables to Update

In your `app.js`, replace these placeholders with your actual values:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

---

## 8. Test Your Setup

1. Create a test user via the app UI
2. Try sending a message
3. Check the database to confirm data was inserted
4. Test realtime by opening two browser windows

---

## Troubleshooting

### "Relation does not exist"
- Make sure you've run all SQL statements
- Check table names are correct

### Realtime not working
- Ensure replication is enabled
- Check browser console for errors

### Storage upload fails
- Check bucket policies
- Verify file size limits

---

## Next Steps

After completing Supabase setup, deploy your app:
1. Deploy to Netlify or Vercel
2. Add environment variables in deployment settings
3. Test all features