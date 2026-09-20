# Test verifyResidentCredentials with rate limiting
$apiUrl = "https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql"
$apiKey = "da2-5rll2d4qm5dlxl5szpdw3ra3ra"

Write-Host "`n=== Testing verifyResidentCredentials Rate Limiting ===" -ForegroundColor Cyan
Write-Host "This will attempt 7 credential verifications" -ForegroundColor Gray
Write-Host "Expected: First 5 succeed, next 2 should be rate limited (5 attempts per 15 min)" -ForegroundColor Gray

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $apiKey
}

$successCount = 0
$rateLimitedCount = 0

for ($i = 1; $i -le 7; $i++) {
    Write-Host "`nAttempt $i..." -ForegroundColor Yellow
    
    $mutation = @{
        query = @"
mutation {
  verifyResidentCredentials(
    residentCode: "TEST01"
    unitNumber: "101"
  ) {
    isValid
    residentId
    residentFloor
    residentPlate
    message
  }
}
"@
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $mutation
        
        if ($response.errors) {
            $errorMsg = $response.errors[0].message
            if ($errorMsg -match "Too many attempts") {
                $rateLimitedCount++
                Write-Host "  Result: Rate Limited (as expected)" -ForegroundColor Yellow
                Write-Host "  Message: $errorMsg" -ForegroundColor Gray
            } else {
                Write-Host "  Result: Error" -ForegroundColor Red
                Write-Host "  Message: $errorMsg" -ForegroundColor Red
            }
        } else {
            $successCount++
            $result = $response.data.verifyResidentCredentials
            Write-Host "  Result: Success" -ForegroundColor Green
            Write-Host "  Valid: $($result.isValid)" -ForegroundColor Gray
            Write-Host "  Message: $($result.message)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Result: Request Failed" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`n=== Rate Limiting Test Results ===" -ForegroundColor Cyan
Write-Host "Successful requests: $successCount (expected: 5)" -ForegroundColor $(if ($successCount -eq 5) { "Green" } else { "Yellow" })
Write-Host "Rate limited requests: $rateLimitedCount (expected: 2)" -ForegroundColor $(if ($rateLimitedCount -eq 2) { "Green" } else { "Yellow" })

if ($successCount -eq 5 -and $rateLimitedCount -eq 2) {
    Write-Host "`nTest Result: PASSED - Rate limiting is working correctly!" -ForegroundColor Green
} else {
    Write-Host "`nTest Result: Check the numbers above" -ForegroundColor Yellow
}

Write-Host "`n=== Testing Soft Delete Query ===" -ForegroundColor Cyan

$listQuery = @{
    query = @"
query {
  listReservations(limit: 10) {
    items {
      id
      guestPlate
      status
      deletedAt
    }
    nextToken
  }
}
"@
} | ConvertTo-Json

try {
    $listResponse = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $listQuery
    
    if ($listResponse.errors) {
        Write-Host "Error listing reservations:" -ForegroundColor Red
        $listResponse.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        $items = $listResponse.data.listReservations.items
        Write-Host "Total reservations returned: $($items.Count)" -ForegroundColor Green
        
        $deletedItems = $items | Where-Object { $_.deletedAt -ne $null }
        
        if ($deletedItems.Count -eq 0) {
            Write-Host "Soft delete filter working: No deleted items in results" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Found $($deletedItems.Count) deleted items (should be filtered)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== All tests completed ===" -ForegroundColor Cyan
