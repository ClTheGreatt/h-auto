# test-alert.ps1
param(
    [string]$Type = "low-moisture"
)

$API_KEY = "h-auto_631a4362e4da2cfb50e98010563d6017440347eb1c2a5af8"

$values = @{
    soilMoisture = 55.0
    temperature = 28.5
    humidity = 65.0
    lightIntensity = 8000
    nitrogen = 50
    phosphorus = 30
    potassium = 40
}

switch ($Type) {
    "low-moisture"  { $values.soilMoisture = 15.0 }
    "high-moisture" { $values.soilMoisture = 95.0 }
    "high-temp"     { $values.temperature = 42.0 }
    "low-temp"      { $values.temperature = 8.0 }
    "low-light"     { $values.lightIntensity = 500 }
    "low-humidity"  { $values.humidity = 25.0 }
    "normal"        { }
    default {
        Write-Host "Unknown type. Use one of: low-moisture, high-moisture, high-temp, low-temp, low-light, low-humidity, normal"
        exit
    }
}

$headers = @{
    "x-api-key" = $API_KEY
    "Content-Type" = "application/json"
}

$body = $values | ConvertTo-Json

Write-Host "Sending '$Type' reading..." -ForegroundColor Cyan
Write-Host "Payload:" -ForegroundColor Gray
Write-Host $body -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/sensors/ingest" -Method Post -Headers $headers -Body $body
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "Reading ID: $($response.readingId)" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}