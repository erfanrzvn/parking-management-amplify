import boto3

dynamodb = boto3.client('dynamodb', region_name='ca-central-1')

# US/Canada phone numbers (Toronto +1-416 and Vancouver +1-604 area codes)
residents = [
    {"id": "328c718b-31aa-47bb-97d5-b599f36e6d0a", "phone": "+14165551231"},
    {"id": "resident_20260811_ads", "phone": "+16045558502"},
    {"id": "3342783e-295c-4b88-8f03-efe4e84e8312", "phone": "+14165556059"},
    {"id": "e1eedf9b-6e88-4cf5-8f82-73bd01d5b1c1", "phone": "+14165551564"},
    {"id": "resident_1785955431464_qzdeem", "phone": "+14165551897"},
    {"id": "baf47c69-7f63-4336-b092-1f46c5cb462b", "phone": "+14165551429"},
    {"id": "80a418bb-e844-4e07-a367-182af76ca778", "phone": "+14165551762"},
    {"id": "resident_1789934848262_cf6222", "phone": "+14165553384"},
    {"id": "resident_1789932941567_31de8b", "phone": "+16045556623"},
]

for r in residents:
    try:
        dynamodb.update_item(
            TableName='Resident',
            Key={'id': {'S': r['id']}},
            UpdateExpression='SET phone = :phone',
            ExpressionAttributeValues={':phone': {'S': r['phone']}}
        )
        print(f"✅ Updated {r['id']} with phone {r['phone']}")
    except Exception as e:
        print(f"❌ Error updating {r['id']}: {e}")

print("\n🎉 All done!")
