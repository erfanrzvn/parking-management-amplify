# Test createResidentWithCognito
$apiUrl = "https://szwuay354vayfaoqqcg3y7gfke.appsync-api.ca-central-1.amazonaws.com/graphql"
$apiKey = "da2-5rll2d4qm5dlxl5szpdw3ra3ra"

Write-Host "`n=== Testing createResidentWithCognito ===" -ForegroundColor Cyan

$mutation = @{
    query = @"
mutation {
  createResidentWithCognito(input: {
    email: "test.resident@example.com"
    building: "Tower A"
    floor: "5"
    unitNumber: "502"
    plate: "ABC123"
  }) {
    id
    email
    building
    floor
    unitNumber
    plate
    residentCode
    userId
    tempPassword
    message
    createdAt
  }
}
"@
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $apiKey
}

try {
    Write-Host "`nSending mutation..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $mutation
    
    Write-Host "`nRaw Response:" -ForegroundColor Magenta
    $response | ConvertTo-Json -Depth 10
    
    if ($response.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $response.errors | ForEach-Object {
            Write-Host "  - $($_.message)" -ForegroundColor Red
        }
    } else {
        Write-Host "Success!" -ForegroundColor Green
        Write-Host "`nResident Created:" -ForegroundColor Yellow
        $result = $response.data.createResidentWithCognito
        Write-Host "  ID: $($result.id)" -ForegroundColor Gray
        Write-Host "  Email: $($result.email)" -ForegroundColor Gray
        Write-Host "  Building: $($result.building)" -ForegroundColor Gray
        Write-Host "  Unit: $($result.unitNumber)" -ForegroundColor Gray
        Write-Host "  Floor: $($result.floor)" -ForegroundColor Gray
        Write-Host "  Plate: $($result.plate)" -ForegroundColor Gray
        Write-Host "`n  Resident Code: $($result.residentCode)" -ForegroundColor Green
        Write-Host "  Temp Password: $($result.tempPassword)" -ForegroundColor Green
        Write-Host "  User ID: $($result.userId)" -ForegroundColor Gray
        Write-Host "`n  Message: $($result.message)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test completed ===" -ForegroundColor Cyan
