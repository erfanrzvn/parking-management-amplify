# Test listResidents query
$apiUrl = "https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql"
$apiKey = "da2-5rll2d4qm5dlxl5szpdw3ra3ra"

Write-Host "`n=== Testing listResidents ===" -ForegroundColor Cyan

$query = @{
    query = @"
query {
  listResidents(limit: 10) {
    items {
      id
      email
      residentCode
      building
      floor
      unitNumber
      plate
      deletedAt
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
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $query
    
    Write-Host "`nRaw Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    
    if ($response.errors) {
        Write-Host "`nErrors:" -ForegroundColor Red
        $response.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "`nSuccess!" -ForegroundColor Green
        Write-Host "Total residents: $($response.data.listResidents.items.Count)" -ForegroundColor Green
    }
} catch {
    Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
}
