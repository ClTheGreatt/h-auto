import {
  Sprout,
  GraduationCap,
  Code2,
  Heart,
  Cpu,
  Database,
  Smartphone,
  BellRing,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// EDIT: Replace with your actual team members
const TEAM = [
  {
    name: "Chrislord Dizon",
    role: "Lead Developer & System Architect",
    initials: "CD",
    isDeveloper: true,
  },
  {
    name: "Said Hussin",
    role: "Documentation & Research",
    initials: "SH",
    isDeveloper: false,
  },
  {
    name: "Geoffrey Perello",
    role: "Documentation & Research",
    initials: "GP",
    isDeveloper: false,
  },
  {
    name: "Jhan Criss Alba",
    role: "Documentation & Research",
    initials: "JA",
    isDeveloper: false,
  },
];

const TECH_STACK = [
  {
    category: "Web Platform",
    items: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS", "shadcn/ui"],
  },
  {
    category: "Mobile Platform",
    items: ["React Native", "Expo", "NativeWind", "TanStack Query"],
  },
  {
    category: "Backend & Data",
    items: ["Node.js", "Prisma ORM", "PostgreSQL (Neon)", "NextAuth v5"],
  },
  {
    category: "Cloud Services",
    items: [
      "Vercel",
      "Neon Database",
      "Cloudinary",
      "Expo Push Notifications",
      "Semaphore SMS",
      "Resend Email",
    ],
  },
  {
    category: "IoT Hardware",
    items: [
      "ESP32 DevKit",
      "YL-69 Soil Moisture Sensor",
      "DHT22 Temperature/Humidity",
      "NPK RS485 Modbus Sensor",
    ],
  },
  {
    category: "Reporting & Charts",
    items: ["Recharts", "React-PDF", "ExcelJS"],
  },
];

const FEATURES = [
  {
    icon: Cpu,
    title: "Real-time IoT Monitoring",
    description: "ESP32 microcontroller with soil moisture, temperature, humidity, and NPK sensors continuously stream readings to the cloud.",
  },
  {
    icon: BellRing,
    title: "Multi-channel Smart Alerts",
    description: "Automatic alerts when readings cross thresholds, delivered via SMS, push notifications, email, and in-app inbox. Each alert includes actionable step-by-step guidance for the user.",
  },
  {
    icon: Smartphone,
    title: "Mobile Companion App",
    description: "React Native app for field workers to log observations, view analytics, and receive push notifications on the go.",
  },
  {
    icon: Database,
    title: "Comprehensive Reporting",
    description: "Role-based PDF and Excel exports for sensor data, plot performance, growth logs, alerts, and student activity.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 mb-4 shadow-lg">
          <Sprout className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">H-Auto</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Online Smart Gardening Monitoring System
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          for Vegetables using Microcontrollers
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            v1.0 ·
          </Badge>
        </div>
      </div>

      {/* Project Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-green-600" />
            About this project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <p>
            H-Auto is a comprehensive web-based monitoring system designed for
            educational gardens. It combines IoT sensor technology with a
            modern web platform to enable real-time monitoring, data analytics,
            and automated alerting for vegetable cultivation.
          </p>
          <p>
            The system was developed as a capstone project to address the
            challenge of effective garden management in academic settings,
            where multiple students share responsibility for plot care under
            faculty supervision. By providing continuous environmental
            monitoring and instant alert notifications, H-Auto helps prevent
            crop loss and improves learning outcomes through data-driven
            cultivation.
          </p>
        </CardContent>
      </Card>

      {/* Project Purpose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" />
            Project purpose
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 leading-relaxed">
          <p>
            H-Auto addresses the challenge of collaborative garden management
            in academic settings, where students share responsibility for
            plot care under faculty supervision. By combining continuous
            environmental monitoring with actionable alert guidance, the
            system reduces crop loss, teaches data-driven cultivation, and
            creates a shared, transparent record of plant care that faculty
            can review at any time.
          </p>
        </CardContent>
      </Card>

      {/* Institution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Institution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Bataan Peninsula State University
              </h3>
              <p className="text-sm text-muted-foreground">
                College of Computer Studies
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Bachelor of Science in Information Technology
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Academic Year 2025-2026
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-green-600" />
            Development Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEAM.map((member, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 border rounded-md ${
                  member.isDeveloper ? "bg-green-50/60 border-green-200" : ""
                }`}
              >
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-green-100 text-green-700 font-medium">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{member.name}</span>
                    {member.isDeveloper && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0"
                      >
                        Developer
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex gap-3">
                  <div className="w-9 h-9 rounded-md bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {feature.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {feature.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tech stack */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-green-600" />
            Technology stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TECH_STACK.map((stack, idx) => (
              <div key={idx}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {stack.category}
                </div>
                <div className="flex flex-wrap gap-2">
                  {stack.items.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground pt-4 pb-8">
        <p>AY 2025-2026</p>
        <p className="mt-1">© 2026 H-Auto Development Team</p>
        <p className="mt-1">Bataan Peninsula State University</p>
      </div>
    </div>
  );
}