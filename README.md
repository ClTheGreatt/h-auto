# H-Auto: Online Smart Gardening Monitoring System

> Online Smart Gardening Monitoring System for Vegetables using Microcontrollers — a capstone project by IT students at Bataan Peninsula State University.

H-Auto combines IoT sensor technology with a modern web platform to enable real-time monitoring, data analytics, and automated alerting for vegetable cultivation in educational gardens.

## ✨ Features

- 📊 **Real-time Sensor Monitoring** — soil moisture, temperature, humidity, light intensity, and NPK levels via ESP32-based IoT devices
- 📱 **SMS Alerts** — automated notifications via Semaphore when readings fall outside optimal ranges
- 🌱 **Crop Profiling** — define crops with growth stages and per-stage optimal sensor thresholds
- 👥 **Role-based Access** — Super Admin, Admin, Faculty, and Student Farmer roles with appropriate permissions
- 📸 **Growth Logs** — photo-based observation tracking with up to 4 images per log
- 📈 **Visual Analytics** — interactive charts for sensor trends, growth progression, and alert patterns
- 📄 **Comprehensive Reports** — export to PDF and Excel: sensor readings, plot performance, growth logs, alerts, system activity
- 📦 **Bulk Import** — CSV-based user import with validation preview
- 📱 **Mobile Responsive** — works on phones, tablets, and desktops

## 🛠️ Tech Stack

**Frontend**
- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- Recharts
- Lucide icons

**Backend**
- Next.js Server Actions + API Routes
- Prisma ORM
- PostgreSQL (via Neon)
- NextAuth v5
- Zod validation

**Integrations**
- Cloudinary (image hosting)
- Semaphore (Philippine SMS)
- @react-pdf/renderer (PDF generation)
- ExcelJS (spreadsheet export)

**Hardware** (separate firmware)
- ESP32 microcontroller
- Soil moisture sensor
- DHT22 (temperature + humidity)
- BH1750 (light intensity)
- NPK sensor (RS485)

## 🚀 Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database (free tier on [Neon](https://neon.tech) works great)
- Cloudinary account (free tier)
- Semaphore account (for SMS — optional, has mock mode)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/h-auto.git
cd h-auto

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values (see Environment Variables below)

# Set up the database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Required in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random 32-char string for NextAuth (generate with `openssl rand -base64 32`) |
| `AUTH_TRUST_HOST` | Set to `true` for development |
| `AUTH_URL` | `http://localhost:3000` for local, your domain in production |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `SEMAPHORE_API_KEY` | From Semaphore dashboard (or `test_mock_key` for mock mode) |

See `.env.example` for the full template.

### Seed Data

The seed creates these test accounts:

| Email | Password | Role |
|-------|----------|------|
| `admin@h-auto.local` | `admin123` | Super Admin |
| `maria@h-auto.local` | `faculty123` | Faculty |
| `pedro@h-auto.local` | `student123` | Student Farmer |
| `juan@h-auto.local` | `student123` | Student Farmer |

Plus: 4 crops (Tomato, Lettuce, Pechay, Eggplant) with growth stages, 6 plots, and 11 sample growth logs with photos.

⚠️ Change these passwords before deploying to production!

## 📂 Project Structure

```
h-auto/
├── prisma/
│   ├── schema.prisma          # Database schema (13 tables)
│   └── seed.ts                # Seed data
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth
│   │   │   ├── reports/       # PDF/Excel export
│   │   │   ├── sensors/       # ESP32 ingest endpoint
│   │   │   └── upload/        # Cloudinary upload
│   │   ├── dashboard/         # Authenticated pages
│   │   └── login/             # Login page
│   ├── components/            # React components
│   │   ├── ui/                # shadcn primitives
│   │   ├── dashboard/         # Layout components
│   │   └── [feature]/         # Feature-specific
│   ├── lib/                   # Business logic
│   │   ├── alerts/            # Alert processor
│   │   ├── analytics/         # Analytics helpers
│   │   ├── reports/           # Report generators
│   │   ├── sms/               # Semaphore integration
│   │   ├── validations/       # Zod schemas
│   │   ├── auth.ts            # NextAuth config
│   │   └── prisma.ts          # Prisma client
│   └── proxy.ts               # Middleware
└── public/                    # Static assets
```

## 🔌 Hardware Integration (ESP32)

The system accepts sensor readings at `POST /api/sensors/ingest`:

**Headers:**
```
x-api-key: <device API key from /dashboard/devices>
Content-Type: application/json
```

**Body:**
```json
{
  "soilMoisture": 55.5,
  "temperature": 28.3,
  "humidity": 65.2,
  "lightIntensity": 8500,
  "nitrogen": 50,
  "phosphorus": 30,
  "potassium": 40
}
```

The endpoint:
1. Validates the API key against registered devices
2. Stores the reading
3. Updates device `lastSeenAt` to mark it online
4. Triggers alert processing (compares against crop thresholds)
5. Sends SMS notifications to assigned faculty + students if alerts are critical

Firmware for ESP32 is maintained separately (see hardware/firmware repo).

## 📊 Database Schema

13 tables:

- `User` — accounts with roles
- `Crop` + `GrowthStage` — crop profiles with stage-specific thresholds
- `Plot` — physical garden plots
- `Device` — registered ESP32 devices
- `PlotAssignment` — student/faculty plot assignments
- `SensorReading` — IoT sensor data
- `GrowthLog` + `GrowthLogImage` — student observations with photos
- `Alert` + `Notification` — alerts and SMS delivery tracking
- `ImportBatch` — bulk CSV import records

Full schema in `prisma/schema.prisma`.

## 🧪 Testing the System (Without Hardware)

Use PowerShell to simulate ESP32 readings:

```powershell
$headers = @{
    "x-api-key" = "YOUR_DEVICE_API_KEY"
    "Content-Type" = "application/json"
}

$body = '{"soilMoisture": 15.0, "temperature": 28.5, "humidity": 65.0, "lightIntensity": 8000}'

Invoke-RestMethod -Uri "http://localhost:3000/api/sensors/ingest" `
    -Method Post -Headers $headers -Body $body
```

Low `soilMoisture` (15%) will trigger a critical alert.

## 📜 License

This project is developed as an academic capstone and is provided as-is for educational purposes.

## 👥 Team

Developed by IT students at:

**Bataan Peninsula State University**
College of Information and Communications Technology
Bachelor of Science in Information Technology
Academic Year 2025-2026

## 🙏 Acknowledgments

- Faculty advisors for guidance throughout the project
- Bataan Peninsula State University for the platform
- Open-source community for the incredible tools

---

For detailed usage instructions, see the in-app Help page after logging in.