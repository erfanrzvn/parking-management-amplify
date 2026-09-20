$headers = @{'Content-Type'='application/json';'x-api-key'='da2-5rll2d4qm5dlxl5szpdw3ra3ra'}
$url = 'https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql'

Write-Host "Testing listReservations with pagination..." -ForegroundColor Cyan
$body = '{"query":"query { listReservations(limit: 5) { items { id guestPlate residentCode } nextToken } }"}'
try {
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    if ($r.errors) {
        Write-Host "ERROR:" -ForegroundColor Red
        $r.errors | ForEach-Object { Write-Host $_.message -ForegroundColor Red }
    } else {
        Write-Host "SUCCESS! Found $($r.data.listReservations.items.Count) reservations" -ForegroundColor Green
        $r.data.listReservations | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting checkAvailability..." -ForegroundColor Cyan
$body2 = '{"query":"query { checkAvailability { available availableSpots totalSpots message } }"}'
try {
    $r2 = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body2
    if ($r2.errors) {
        Write-Host "ERROR:" -ForegroundColor Red
        $r2.errors | ForEach-Object { Write-Host $_.message -ForegroundColor Red }
    } else {
        Write-Host "SUCCESS!" -ForegroundColor Green
        $r2.data.checkAvailability | Format-List
    }
} catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
}
