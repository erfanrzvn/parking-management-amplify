# Simple API Tests
$apiUrl = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql'
$apiKey = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra'

$headers = @{
    'Content-Type' = 'application/json'
    'x-api-key' = $apiKey
}

# Test 1: Check Availability
Write-Host "`n=== Test 1: Check Availability ===" -ForegroundColor Cyan
$query1 = @{
    query = "query { checkAvailability { available availableSpots totalSpots message } }"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $query1
    if ($response.errors) {
        Write-Host "✗ Error:" -ForegroundColor Red
        $response.errors | ForEach-Object { Write-Host "  - $($_.message)" -ForegroundColor Red }
    } else {
        Write-Host "✓ Success!" -ForegroundColor Green
        $response.data.checkAvailability | Format-List
    }
} catch {
    Write-Host "✗ Exception: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: List Residents
Write-Host "`n=== Test 2: List Residents ===" -ForegroundColor Cyan
$query2 = @{
    query = "query { listResidents(limit: 10) { items { id email residentCode floor unitNumber } } }"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $query2
    if ($response.errors) {
        Write-Host "✗ Error:" -ForegroundColor Red
        $response.errors | ForEach-Object { Write-Host "  - $($_.message)" -ForegroundColor Red }
    } else {
        Write-Host "✓ Success! Found $($response.data.listResidents.items.Count) residents" -ForegroundColor Green
        $response.data.listResidents.items | Select-Object -First 5 | Format-Table
    }
} catch {
    Write-Host "✗ Exception: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: List Reservations
Write-Host "`n=== Test 3: List Reservations ===" -ForegroundColor Cyan
$query3 = @{
    query = "query { listReservations(limit: 10) { items { id guestPlate residentCode startTime endTime } } }"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $query3
    if ($response.errors) {
        Write-Host "✗ Error:" -ForegroundColor Red
        $response.errors | ForEach-Object { Write-Host "  - $($_.message)" -ForegroundColor Red }
    } else {
        Write-Host "✓ Success! Found $($response.data.listReservations.items.Count) reservations" -ForegroundColor Green
        $response.data.listReservations.items | Select-Object -First 5 | Format-Table
    }
} catch {
    Write-Host "✗ Exception: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: List Parking Configs
Write-Host "`n=== Test 4: List Parking Configs ===" -ForegroundColor Cyan
$query4 = @{
    query = "query { listParkingConfigs { id name totalSpots } }"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $query4
    if ($response.errors) {
        Write-Host "✗ Error:" -ForegroundColor Red
        $response.errors | ForEach-Object { Write-Host "  - $($_.message)" -ForegroundColor Red }
    } else {
        Write-Host "✓ Success!" -ForegroundColor Green
        $response.data.listParkingConfigs | Format-Table
    }
} catch {
    Write-Host "✗ Exception: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== All Basic Tests Completed ===" -ForegroundColor Cyan
