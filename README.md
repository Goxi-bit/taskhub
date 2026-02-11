# TaskHub

- Live Demo: https://taskhub-gilt.vercel.app/
- Repo: https://github.com/Goxi-bit/taskhub
- Demo Video: https://drive.google.com/file/d/13rWC8xzB0ZUazTqiqDd5kiR_dmI4POhz/view?usp=sharing


A minimal task manager built with **React (Vite)** + **Supabase** (Auth + Postgres + RLS).
Includes GitHub OAuth login and persistent tasks per user.

## Features
- GitHub OAuth login (Supabase Auth)
- Create / read / update / delete tasks (CRUD)
- Filter: All / Open / Done
- Data persists in Postgres (Supabase)
- Row Level Security: users can only access their own tasks

## Environment variables
This project uses Supabase. Create a `.env` file in the project root (not committed to GitHub):

VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

## Tech Stack
- React + Vite
- Supabase (Auth, Postgres, RLS)
- @supabase/supabase-js

## Local Setup
1. Install dependencies:
   ```bash
   npm install
