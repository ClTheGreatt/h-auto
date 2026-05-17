import {
  HelpCircle,
  Users,
  Sprout,
  MapPinned,
  Camera,
  BellRing,
  BarChart3,
  FileText,
  Cpu,
  ClipboardList,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth-helpers";

type Section = {
  title: string;
  icon: typeof HelpCircle;
  steps: string[];
};

const ADMIN_SECTIONS: Section[] = [
  {
    title: "Add a new user",
    icon: Users,
    steps: [
      "Click 'Users' in the sidebar",
      "Click the 'Add User' button (top-right)",
      "Fill in personal information (name, email, phone)",
      "Select the appropriate role: Admin, Faculty, or Student Farmer",
      "For students: fill in course, year, and section",
      "Set a strong initial password (user can change it later)",
      "Click 'Create User' — the user can now log in",
    ],
  },
  {
    title: "Register an ESP32 device",
    icon: Cpu,
    steps: [
      "Click 'Devices' in the sidebar",
      "Click 'Add Device'",
      "Enter a unique device code (e.g., ESP32-001)",
      "Assign the device to a plot",
      "Save — an API key will be generated",
      "Copy the API key into your ESP32 firmware",
      "Power on the device. It will appear ONLINE within minutes",
    ],
  },
  {
    title: "Add a crop profile with thresholds",
    icon: Sprout,
    steps: [
      "Click 'Crops' in the sidebar",
      "Click 'Add Crop' and provide name, variety, and description",
      "Define growth stages (e.g., Germination, Vegetative, Flowering, Harvest)",
      "For each stage, set optimal sensor ranges (moisture, temp, humidity, light, NPK)",
      "These thresholds drive automatic alerts when sensor readings go out of range",
    ],
  },
  {
    title: "Bulk import users via CSV",
    icon: Users,
    steps: [
      "Go to 'Users' in the sidebar",
      "Click the 'Import' button",
      "Download the template CSV if needed",
      "Fill in user data following the template format",
      "Upload the completed CSV",
      "Review the import preview — errors are flagged before commit",
      "Click 'Confirm Import' to add all valid users at once",
    ],
  },
];

const FACULTY_SECTIONS: Section[] = [
  {
    title: "Assign students to plots",
    icon: ClipboardList,
    steps: [
      "Go to 'Plots' and click on a specific plot",
      "Scroll to 'Monitoring Assignments'",
      "Click 'Assign Student'",
      "Select a student farmer from the dropdown",
      "Add optional notes (e.g., watering schedule)",
      "Click 'Assign' — the student will now see this plot in their dashboard",
    ],
  },
  {
    title: "Monitor student activity",
    icon: Camera,
    steps: [
      "Click 'Monitoring' in the sidebar",
      "View timeline of all growth logs across your assigned plots",
      "Click on a plot to see its full growth history with photos",
      "Review students' observations, measurements, and notes",
    ],
  },
  {
    title: "Track plot performance",
    icon: BarChart3,
    steps: [
      "Click 'Analytics' in the sidebar",
      "View sensor trends, growth progression, and alert patterns",
      "Filter by time range (24h, 7d, 30d, etc.)",
      "Click on a specific plot for detailed analytics",
    ],
  },
];

const STUDENT_SECTIONS: Section[] = [
  {
    title: "View your assigned plots",
    icon: MapPinned,
    steps: [
      "Your assigned plots appear on your Dashboard",
      "Click any plot card to see full details",
      "View current sensor readings, growth stage, and history",
      "Faculty assignments are shown at the top of each plot",
    ],
  },
  {
    title: "Log plant growth with photos",
    icon: Camera,
    steps: [
      "Go to your plot's detail page",
      "Click 'Add Log Entry' (or use the Quick Action on Dashboard)",
      "Select the current growth stage",
      "Enter plant height and leaf count",
      "Write observations and any notes",
      "Upload up to 4 photos of the plants",
      "Click 'Save Log' — entry is recorded with timestamp",
    ],
  },
  {
    title: "Respond to alerts",
    icon: BellRing,
    steps: [
      "Critical alerts trigger SMS to your registered phone number",
      "View all open alerts in 'Alerts' tab",
      "Click an alert to see plot details and current readings",
      "Take corrective action (water, shade, fertilize, etc.)",
      "Sensor readings will auto-resolve the alert when values return to optimal range",
    ],
  },
];

const COMMON_SECTIONS: Section[] = [
  {
    title: "Export reports",
    icon: FileText,
    steps: [
      "Click 'Reports' in the sidebar",
      "Choose a report type (Sensor Readings, Plot Performance, Growth Logs, Alerts)",
      "Select time range and optional plot filter",
      "Click 'PDF' for a printable report or 'Excel' for data analysis",
      "Reports respect role-based access — students see only their assigned plots' data",
    ],
  },
  {
    title: "Read sensor analytics",
    icon: BarChart3,
    steps: [
      "Click 'Analytics' in the sidebar",
      "Stat cards show readings count, alert counts, and active devices",
      "Line charts plot soil moisture, temperature, and humidity over time",
      "Bar charts show alert frequency by type",
      "Switch time ranges to see different periods",
    ],
  },
];

export default async function HelpPage() {
  const session = await requireAuth();
  const role = session.user.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isFaculty = role === "FACULTY";
  const isStudent = role === "STUDENT_FARMER";

  const sections: { title: string; items: Section[]; visible: boolean }[] = [
    { title: "Administration", items: ADMIN_SECTIONS, visible: isAdmin },
    { title: "Faculty", items: FACULTY_SECTIONS, visible: isAdmin || isFaculty },
    { title: "Student Farmers", items: STUDENT_SECTIONS, visible: isAdmin || isFaculty || isStudent },
    { title: "Common tasks", items: COMMON_SECTIONS, visible: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm">
          <HelpCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Help & Documentation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Step-by-step guides for using H-Auto effectively.
          </p>
        </div>
      </div>

      {/* Quick tip */}
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-green-900">Quick tip</div>
              <p className="text-green-800 mt-1">
                Your role determines what you can see and do. You are signed in
                as{" "}
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700 capitalize"
                >
                  {role.toLowerCase().replace("_", " ")}
                </Badge>
                . Sections below are filtered to your role.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {sections
        .filter((s) => s.visible)
        .map((section) => (
          <div key={section.title}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.items.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Card key={idx}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="w-4 h-4 text-green-600" />
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-2 text-sm text-gray-700">
                        {item.steps.map((step, stepIdx) => (
                          <li key={stepIdx} className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center justify-center">
                              {stepIdx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

      {/* Support */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-900">Need more help?</div>
              <p className="text-amber-800 mt-1">
                Contact your system administrator for issues that aren&apos;t
                covered here, including: account access problems, hardware
                installation, sensor calibration, or training requests.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}