# Test pagination queries
$apiUrl = "https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql"
$apiKey = "da2-5rll2d4qm5dlxl5szpdw3ra3ra"

Write-Host "`n=== Testing listReservations with pagination ===" -ForegroundColor Cyan

# Test 1: List reservations with limit
$query1 = @{
    query = @"
query {
  listReservations(limit: 5) {
    items {
      id
      residentCode
      guestPlate
      startTime
      endTime
      status
    }
    nextToken
  }
}
"@
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $apiKey
}

try {
    Write-Host "`nQuery: listReservations(limit: 5)" -ForegroundColor Yellow
    $response1 = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $query1
    
    if ($response1.errors) {
        Write-Host "❌ Error:" -ForegroundColor Red
        $response1.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ Success!" -ForegroundColor Green
        Write-Host "Items count: $($response1.data.listReservations.items.Count)" -ForegroundColor Green
        Write-Host "Next token: $($response1.data.listReservations.nextToken)" -ForegroundColor Green
        
        if ($response1.data.listReservations.items.Count -gt 0) {
            Write-Host "`nFirst reservation:" -ForegroundColor Yellow
            $response1.data.listReservations.items[0] | Format-List
        }
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: List residents with limit
Write-Host "`n=== Testing listResidents with pagination ===" -ForegroundColor Cyan

$query2 = @{
    query = @"
query {
  listResidents(limit: 3) {
    items {
      id
      email
      residentCode
      building
      floor
      unitNumber
      plate
    }
    nextToken
  }
}
"@
} | ConvertTo-Json

try {
    Write-Host "`nQuery: listResidents(limit: 3)" -ForegroundColor Yellow
    $response2 = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $query2
    
    if ($response2.errors) {
        Write-Host "❌ Error:" -ForegroundColor Red
        $response2.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ Success!" -ForegroundColor Green
        Write-Host "Items count: $($response2.data.listResidents.items.Count)" -ForegroundColor Green
        Write-Host "Next token: $($response2.data.listResidents.nextToken)" -ForegroundColor Green
        
        if ($response2.data.listResidents.items.Count -gt 0) {
            Write-Host "`nFirst resident:" -ForegroundColor Yellow
            $response2.data.listResidents.items[0] | Format-List
        }
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Testing checkAvailability ===" -ForegroundColor Cyan

$query3 = @{
    query = @"
query {
  checkAvailability {
    available
    availableSpots
    totalSpots
    nextAvailableTime
    message
  }
}
"@
} | ConvertTo-Json

try {
    Write-Host "`nQuery: checkAvailability" -ForegroundColor Yellow
    $response3 = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $query3
    
    if ($response3.errors) {
        Write-Host "❌ Error:" -ForegroundColor Red
        $response3.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ Success!" -ForegroundColor Green
        Write-Host "`nAvailability:" -ForegroundColor Yellow
        $response3.data.checkAvailability | Format-List
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== All tests completed ===" -ForegroundColor Cyan
