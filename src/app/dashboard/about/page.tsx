import {
  Sprout,
  GraduationCap,
  Code2,
  Heart,
  Cpu,
  Database,
  Globe,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// EDIT: Replace with your actual team members
const TEAM = [
  {
    name: "Said Hussin",
    role: "Project Lead / Full-stack Developer",
    initials: "GA",
  },
  {
    name: "Chrislord Dizon",
    role: "Backend / IoT Integration",
    initials: "M2",
  },
  {
    name: "Geoffrey Perello",
    role: "Frontend / UI Design",
    initials: "M3",
  },
  {
    name: "Jhan Criss Alba",
    role: "Documentation / Research",
    initials: "M4",
  },
];

const TECH_STACK = [
  { category: "Frontend", items: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS", "shadcn/ui"] },
  { category: "Backend", items: ["Node.js", "Prisma ORM", "PostgreSQL", "NextAuth v5"] },
  { category: "Cloud Services", items: ["Neon Database", "Cloudinary", "Semaphore SMS"] },
  { category: "Hardware", items: ["ESP32 Microcontroller", "Soil Moisture Sensor", "DHT22", "BH1750 Light Sensor", "NPK Sensor"] },
  { category: "Reporting", items: ["Recharts", "React-PDF", "ExcelJS"] },
];

const FEATURES = [
  {
    icon: Cpu,
    title: "Real-time IoT Monitoring",
    description: "ESP32-based sensors continuously track soil moisture, temperature, humidity, light intensity, and NPK levels.",
  },
  {
    icon: Smartphone,
    title: "SMS Alert System",
    description: "Automated SMS notifications via Semaphore alert farmers and faculty when readings fall outside optimal ranges.",
  },
  {
    icon: Database,
    title: "Comprehensive Reporting",
    description: "Export PDF and Excel reports for sensor data, plot performance, growth logs, alerts, and system activity.",
  },
  {
    icon: Globe,
    title: "Role-based Access",
    description: "Four user roles (Super Admin, Admin, Faculty, Student Farmer) with appropriate permissions and data visibility.",
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
        <h1 className="text-3xl font-bold text-gray-900">H-Auto</h1>
        <p className="text-lg text-gray-600 mt-2">
          Online Smart Gardening Monitoring System
        </p>
        <p className="text-sm text-gray-500 mt-1">
          for Vegetables using Microcontrollers
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Version 1.0
          </Badge>
          <Badge variant="secondary">Production</Badge>
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
            monitoring and instant SMS notifications, H-Auto helps prevent
            crop loss and improves learning outcomes through data-driven
            cultivation.
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
              <h3 className="font-semibold text-gray-900">
                Bataan Peninsula State University
              </h3>
              <p className="text-sm text-gray-600">
                College of Computer Studies
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Bachelor of Science in Information Technology
              </p>
              <p className="text-xs text-gray-500 mt-1">
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
                className="flex items-center gap-3 p-3 border rounded-md"
              >
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-green-100 text-green-700 font-medium">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{member.name}</div>
                  <div className="text-xs text-gray-500">{member.role}</div>
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
                    <div className="text-sm font-medium text-gray-900">
                      {feature.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
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
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
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
      <div className="text-center text-sm text-gray-500 pt-4 pb-8">
        <p>© 2026 H-Auto Development Team</p>
        <p className="mt-1">Bataan Peninsula State University</p>
      </div>
    </div>
  );
}