import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ca-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

const RESIDENT_TABLE = process.env.RESIDENT_TABLE || 'Resident';

/**
 * Export all residents to CSV format
 * Returns CSV string with headers and data
 */
export const handler = async (event) => {
  console.log('Export residents CSV request:', JSON.stringify(event));

  try {
    // Scan all residents (not deleted)
    const scanParams = {
      TableName: RESIDENT_TABLE,
      FilterExpression: 'attribute_not_exists(deletedAt)',
    };

    let residents = [];
    let lastEvaluatedKey = null;

    // Handle pagination
    do {
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new ScanCommand(scanParams));
      residents = residents.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${residents.length} residents`);

    // Sort by building, floor, unitNumber for easier management
    residents.sort((a, b) => {
      if (a.building !== b.building) return a.building.localeCompare(b.building);
      if (a.floor !== b.floor) return a.floor.localeCompare(b.floor);
      return a.unitNumber.localeCompare(b.unitNumber);
    });

    // Generate CSV
    const headers = [
      'id',
      'email',
      'name',
      'phone',
      'building',
      'floor',
      'unitNumber',
      'plate',
      'residentCode',
      'userId',
      'householdId',
      'createdAt',
      'updatedAt'
    ];

    // CSV header row
    let csv = headers.join(',') + '\n';

    // CSV data rows
    for (const resident of residents) {
      const row = headers.map(header => {
        let value = resident[header] || '';
        
        // Escape values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        return value;
      });
      
      csv += row.join(',') + '\n';
    }

    console.log(`Generated CSV with ${residents.length} rows`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="residents-export.csv"'
      },
      body: csv
    };

  } catch (error) {
    console.error('Error exporting residents:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to export residents',
        message: error.message
      })
    };
  }
};
