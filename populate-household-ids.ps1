# Populate householdId for existing residents

Write-Host "Fetching all residents..." -ForegroundColor Green

$residents = aws dynamodb scan `
  --table-name Resident `
  --region ca-central-1 `
  --filter-expression "attribute_not_exists(deletedAt)" `
  --output json | ConvertFrom-Json

$count = 0
foreach ($item in $residents.Items) {
    $id = $item.id.S
    $building = $item.building.S
    $floor = $item.floor.S
    $unitNumber = $item.unitNumber.S
    
    # Generate householdId
    $householdId = "$building-$floor-$unitNumber" -replace '\s+', ''
    
    Write-Host "Updating resident $id with householdId: $householdId"
    
    aws dynamodb update-item `
      --table-name Resident `
      --region ca-central-1 `
      --key "{\"id\":{\"S\":\"$id\"}}" `
      --update-expression "SET householdId = :hid, updatedAt = :updated" `
      --expression-attribute-values "{\":hid\":{\"S\":\"$householdId\"},\":updated\":{\"S\":\"$(Get-Date -Format 'o')\"}}" `
      --output json | Out-Null
    
    $count++
}

Write-Host "✅ Updated $count residents with householdId" -ForegroundColor Green
