# Test creating a reservation with all validations
$apiUrl = "https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql"
$apiKey = "da2-5rll2d4qm5dlxl5szpdw3ra3ra"

Write-Host "`n=== Testing createReservation mutation ===" -ForegroundColor Cyan

# First, create a test resident if not exists
Write-Host "`nStep 1: Getting or creating test resident..." -ForegroundColor Yellow

$listResidentsQuery = @{
    query = @"
query {
  listResidents(limit: 1) {
    items {
      id
      residentCode
      floor
      plate
    }
  }
}
"@
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $apiKey
}

try {
    $residentsResponse = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $listResidentsQuery
    
    if ($residentsResponse.data.listResidents.items.Count -gt 0) {
        $resident = $residentsResponse.data.listResidents.items[0]
        Write-Host "✅ Found existing resident: $($resident.residentCode)" -ForegroundColor Green
        $residentId = $resident.id
        $residentCode = $resident.residentCode
        $residentFloor = $resident.floor
        $residentPlate = $resident.plate
    } else {
        Write-Host "⚠️  No residents found. Please create a resident first." -ForegroundColor Yellow
        exit
    }
} catch {
    Write-Host "❌ Failed to get residents: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Calculate end time (4 hours from now)
$endTime = (Get-Date).AddHours(4).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

Write-Host "`nStep 2: Creating reservation..." -ForegroundColor Yellow
Write-Host "Resident ID: $residentId" -ForegroundColor Gray
Write-Host "Resident Code: $residentCode" -ForegroundColor Gray
Write-Host "End Time: $endTime" -ForegroundColor Gray

$createReservationMutation = @{
    query = @"
mutation {
  createReservation(input: {
    residentId: "$residentId"
    residentCode: "$residentCode"
    residentFloor: "$residentFloor"
    residentPlate: "$residentPlate"
    guestPlate: "TEST-001"
    guestMobile: "+16137777777"
    guestEmail: "test@example.com"
    startTime: "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")"
    endTime: "$endTime"
  }) {
    id
    residentId
    residentCode
    guestPlate
    guestEmail
    guestMobile
    startTime
    endTime
    status
    createdAt
  }
}
"@
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $createReservationMutation
    
    if ($createResponse.errors) {
        Write-Host "❌ Error creating reservation:" -ForegroundColor Red
        $createResponse.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ Reservation created successfully!" -ForegroundColor Green
        Write-Host "`nReservation details:" -ForegroundColor Yellow
        $createResponse.data.createReservation | Format-List
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test rate limiting by creating multiple reservations
Write-Host "`n=== Testing rate limiting (10 requests) ===" -ForegroundColor Cyan

$rateTestCount = 0
$rateTestFailed = 0

for ($i = 1; $i -le 12; $i++) {
    $endTime = (Get-Date).AddHours($i + 5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    $rateLimitMutation = @{
        query = @"
mutation {
  createReservation(input: {
    residentId: "$residentId"
    residentCode: "$residentCode"
    residentFloor: "$residentFloor"
    residentPlate: "$residentPlate"
    guestPlate: "RATE-$(($i).ToString('000'))"
    guestMobile: "+16137777777"
    guestEmail: "ratetest$i@example.com"
    startTime: "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")"
    endTime: "$endTime"
  }) {
    id
    guestPlate
  }
}
"@
    } | ConvertTo-Json
    
    try {
        $rateResponse = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $rateLimitMutation
        
        if ($rateResponse.errors) {
            $rateTestFailed++
            if ($rateResponse.errors[0].message -match "Too many") {
                Write-Host "  Request $i : ❌ Rate limited (as expected after 10)" -ForegroundColor Yellow
            } else {
                Write-Host "  Request $i : ❌ Error: $($rateResponse.errors[0].message)" -ForegroundColor Red
            }
        } else {
            $rateTestCount++
            Write-Host "  Request $i : ✅ Success" -ForegroundColor Green
        }
    } catch {
        $rateTestFailed++
        Write-Host "  Request $i : ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`nRate Limiting Results:" -ForegroundColor Cyan
Write-Host "  Successful: $rateTestCount" -ForegroundColor Green
Write-Host "  Failed/Limited: $rateTestFailed" -ForegroundColor Yellow
Write-Host "  Expected: First 10 succeed, next 2 should be rate limited" -ForegroundColor Gray

Write-Host "`n=== All tests completed ===" -ForegroundColor Cyan
