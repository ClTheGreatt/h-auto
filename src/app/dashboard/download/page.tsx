import { Download, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const APK_URL = "https://github.com/ClTheGreatt/h-auto/releases/download/v1.0.0/h-auto.apk";
const APP_VERSION = "1.0.0";

export default function DownloadPage() {
  const steps = [
    "Tap \"Download .apk\" above and wait for the file to finish downloading.",
    "Open the downloaded file (check your Downloads folder or the download notification).",
    "If prompted, allow \"Install from unknown sources\" for your browser, then continue.",
    "Once installed, open H-Auto and log in using the email and password from your welcome email.",
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Download the mobile app
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Install H-Auto on your Android phone to log observations, view your
          plots, and receive alerts in the field.
        </p>
      </div>

      {/* Download card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm shrink-0">
              <Sprout className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">
                H-Auto for Android
              </div>
              <div className="text-sm text-muted-foreground">
                Version {APP_VERSION} · Android 7.0 and up
              </div>
            </div>
            <Button asChild className="shrink-0">
              <a href={APK_URL} download>
                <Download className="w-4 h-4 mr-2" />
                Download .apk
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Install steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to install</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-semibold dark:bg-green-950/40 dark:text-green-400">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">
        Currently available for Android only.
      </p>
    </div>
  );
}