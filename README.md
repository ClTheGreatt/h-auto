# H-Auto: Online Smart Gardening Monitoring System

A web-based capstone project by [Your Name] - Bataan Peninsula State University, BSIT.

## Features
- Real-time sensor monitoring (soil moisture, temperature, humidity, light, NPK)
- ESP32 IoT integration with REST API
- SMS alerts via Semaphore
- Photo-based growth monitoring
- Visual analytics dashboard
- PDF & Excel report generation
- 4-role access system (Super Admin, Admin, Faculty, Student Farmer)

## Tech Stack
- Next.js 16 (App Router, TypeScript, Turbopack)
- PostgreSQL via Neon
- Prisma ORM
- NextAuth v5
- Tailwind CSS + shadcn/ui
- Recharts
- Cloudinary
- @react-pdf/renderer + exceljs

## Setup
See `.env.example` for required environment variables.

\`\`\`bash
npm install
cp .env.example .env  # Fill in your values
npx prisma db push
npx prisma db seed
npm run dev
\`\`\`

## Test Accounts (after seeding)
- Admin: `admin@h-auto.local` / `admin123`
- Faculty: `maria@h-auto.local` / `faculty123`
- Student: `pedro@h-auto.local` / `student123`