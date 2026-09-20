# Test 1: Check Availability
Write-Host "=== Test 1: Check Availability ===" -ForegroundColor Cyan

$headers = @{
    'Content-Type' = 'application/json'
    'x-api-key' = 'da2-5rll2d4qm5dlxl5szpdw3ra3ra'
}

$body = @{
    query = 'query CheckAvailability { checkAvailability { available availableSpots totalSpots message } }'
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql' -Method POST -Headers $headers -Body $body
    Write-Host "✓ Success!" -ForegroundColor Green
    $response.data.checkAvailability | ConvertTo-Json
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.Response
}

Write-Host ""

# Test 2: List Residents
Write-Host "=== Test 2: List Residents ===" -ForegroundColor Cyan

$body = @{
    query = 'query ListResidents { listResidents(limit: 5) { items { id email residentCode building floor unitNumber } nextToken } }'
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql' -Method POST -Headers $headers -Body $body
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "Found $($response.data.listResidents.items.Count) residents"
    $response.data.listResidents.items | Select-Object -First 3 | ConvertTo-Json
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: List Reservations
Write-Host "=== Test 3: List Reservations ===" -ForegroundColor Cyan

$body = @{
    query = 'query ListReservations { listReservations(limit: 5) { items { id guestPlate residentCode startTime endTime status } nextToken } }'
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql' -Method POST -Headers $headers -Body $body
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "Found $($response.data.listReservations.items.Count) reservations"
    $response.data.listReservations.items | Select-Object -First 3 | ConvertTo-Json
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Verify Resident Credentials (Rate Limiting Test)
Write-Host "=== Test 4: Verify Resident Credentials (Rate Limiting) ===" -ForegroundColor Cyan

$body = @{
    query = 'mutation VerifyResident($' + 'code: String!, $' + 'unit: String!) { verifyResidentCredentials(residentCode: $' + 'code, unitNumber: $' + 'unit) { isValid residentId message } }'
    variables = @{
        code = 'TEST123'
        unit = '999'
    }
} | ConvertTo-Json

Write-Host "Attempting 6 verifications to test rate limiting..."

for ($i = 1; $i -le 6; $i++) {
    try {
        $response = Invoke-RestMethod -Uri 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql' -Method POST -Headers $headers -Body $body
        Write-Host "  Attempt $i`: ✓ $($response.data.verifyResidentCredentials.message)" -ForegroundColor Green
    } catch {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  Attempt $i`: ✗ $($errorResponse.errors[0].message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "=== All Tests Completed ===" -ForegroundColor Cyan
