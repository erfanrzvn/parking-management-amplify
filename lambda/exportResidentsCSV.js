const { requireAdmin } = require('./access');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ca-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

const RESIDENT_TABLE = process.env.RESIDENT_TABLE || 'Resident';

/**
 * Export all residents to CSV format
 * Returns CSV string with headers and data
 */
exports.handler = async (event) => {
  requireAdmin(event);

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
      if (a.building !== b.building) return String(a.building || '').localeCompare(String(b.building || ''));
      if (a.floor !== b.floor) return String(a.floor || '').localeCompare(String(b.floor || ''));
      return String(a.unitNumber || '').localeCompare(String(b.unitNumber || ''));
    });

    // Generate CSV with only user-friendly fields
    // Removed: id, userId, residentCode, householdId, createdAt, updatedAt
    const headers = [
      'email',
      'name',
      'phone',
      'building',
      'floor',
      'unitNumber',
      'plate'
    ];

    // CSV header row
    let csv = headers.join(',') + '\n';

    // CSV data rows
    for (const resident of residents) {
      const row = headers.map(header => {
        let value = String(resident[header] || '');
        if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
        
        // Escape values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        return value;
      });
      
      csv += row.join(',') + '\n';
    }

    console.log(`Generated CSV with ${residents.length} rows`);

    return csv;

  } catch (error) {
    console.error('Error exporting residents:', error);
    
    throw new Error('Failed to export residents');
  }
};
