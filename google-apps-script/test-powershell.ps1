# PowerShell script to test Apps Script Web App
# Usage: .\test-powershell.ps1 -WebAppUrl "YOUR_URL" -Action "cleanTab" -TabName "tab_name"

param(
    [Parameter(Mandatory=$true)]
    [string]$WebAppUrl,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("cleanTab", "enrichTab")]
    [string]$Action,
    
    [Parameter(Mandatory=$true)]
    [string]$TabName
)

Write-Host "🧪 Testing Apps Script Web App..." -ForegroundColor Cyan
Write-Host "URL: $WebAppUrl" -ForegroundColor Gray
Write-Host "Action: $Action" -ForegroundColor Gray
Write-Host "Tab Name: $TabName" -ForegroundColor Gray
Write-Host ""

# Create form data
$body = "action=$Action&tabName=$TabName"

try {
    $response = Invoke-WebRequest -Uri $WebAppUrl -Method POST -Body $body -ContentType "application/x-www-form-urlencoded" -UseBasicParsing
    
    Write-Host "✅ Request successful!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    
    # Try to parse as JSON
    try {
        $json = $response.Content | ConvertFrom-Json
        Write-Host ($json | ConvertTo-Json -Depth 10) -ForegroundColor White
        
        if ($json.success) {
            Write-Host ""
            Write-Host "✅ SUCCESS: $($json.message)" -ForegroundColor Green
            if ($json.details) {
                Write-Host "Details:" -ForegroundColor Cyan
                Write-Host ($json.details | ConvertTo-Json -Depth 10) -ForegroundColor Gray
            }
        } else {
            Write-Host ""
            Write-Host "❌ FAILED: $($json.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host $response.Content -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Request failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Yellow
    }
}

