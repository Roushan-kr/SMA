# SmartMettr Energy Management API - Postman Collection & OpenAPI Documentation

## Overview

This package contains comprehensive API documentation and testing materials for the SmartMettr Energy Management System, including:

- **`openapi.json`** - Full OpenAPI 3.0 specification with all endpoints, schemas, and models
- **`postman-collection.json`** - Ready-to-import Postman collection with all API endpoints

## Files Included

### 1. openapi.json

Complete OpenAPI 3.0 specification including:

- **10 API Resources**: Users, Consumers, Smart Meters, Billing, Queries, Notifications, Reports, Audit, Reference Data, Retention Policies
- **60+ Endpoints**: All GET, POST, PATCH, DELETE operations
- **Comprehensive Schemas**: Request/response models with proper validation rules
- **Authentication**: Bearer token (JWT) configuration
- **Server Configuration**: Development and production endpoints

### 2. postman-collection.json

Production-ready Postman collection featuring:

- **Organized by Resources**: 11 main folders with logical grouping
- **120+ Requests**: Pre-configured with proper headers and body templates
- **Variables**: Pre-defined collection variables for dynamic values
- **Examples**: Realistic sample data for all request/response bodies
- **Authentication**: Bearer token setup with JWT support

## How to Import into Postman

### Method 1: Direct Import

1. Open **Postman** desktop application
2. Click **File** → **Import**
3. Select **Upload Files**
4. Choose `postman-collection.json`
5. Click **Import**

The collection will be imported with all variables and folders ready to use.

### Method 2: Import from URL (if hosted)

1. In Postman, click **File** → **Import**
2. Click the **Link** tab
3. Paste the URL to the collection JSON
4. Click **Import**

### Method 3: Using Postman API

```bash
curl -X POST https://api.getpostman.com/collections \
  -H "X-API-Key: your_postman_api_key" \
  -H "Content-Type: application/json" \
  -d @postman-collection.json
```

## Postman Collection Structure

### Available Collections (11 Folders)

#### 1. **Health Check**

- Health Status - Verify API is running
  - `GET /health` - No authentication required

#### 2. **User Management**

- Create User - `POST /api/users`
- List Users - `GET /api/users`
- Get User by ID - `GET /api/users/{id}`
- Update User Role - `PATCH /api/users/{id}/role`
- Update User Scope - `PATCH /api/users/{id}/scope`
- Delete User - `DELETE /api/users/{id}`
- List User Consents - `GET /api/users/{id}/consents`
- Update User Consent - `PATCH /api/users/{id}/consents`

**Required Permissions**: `user:manage`, `audit:read`

#### 3. **Consumer Management**

- Register Consumer - `POST /api/consumers/register`
- Get My Profile - `GET /api/consumers/me`
- Update My Profile - `PATCH /api/consumers/me`
- List Consumers (Admin) - `GET /api/consumers`
- Get Consumer by ID - `GET /api/consumers/{consumerId}`
- Update Consumer (Admin) - `PATCH /api/consumers/{consumerId}`
- Delete Consumer - `DELETE /api/consumers/{consumerId}`

**Roles**: Consumer (self-service) & Admin access

#### 4. **Consumer Consents**

- Get My Consents - `GET /api/consumers/me/consents`
- Grant Consent - `POST /api/consumers/me/consents/{consentType}/grant`
- Revoke Consent - `POST /api/consumers/me/consents/{consentType}/revoke`

**Consent Types**: `ENERGY_TRACKING`, `AI_QUERY_PROCESSING`

#### 5. **Smart Meters**

- Create Smart Meter - `POST /api/smart-meters`
- Get Meter by ID - `GET /api/smart-meters/{meterId}`
- Assign Meter to Consumer - `PATCH /api/smart-meters/{meterId}/assign`
- Get Meters by Consumer - `GET /api/smart-meters/consumer/{consumerId}`
- Update Meter Status - `PATCH /api/smart-meters/{meterId}/status`
- Get Consumption Summary - `GET /api/smart-meters/{meterId}/consumption`

**Meter Status**: `ACTIVE`, `INACTIVE`, `FAULTY`, `DISCONNECTED`

#### 6. **Billing Reports**

- Generate Billing Report - `POST /api/billing/generate`
- Create Consumption Aggregate - `POST /api/billing/aggregate`
- List Billing Reports - `GET /api/billing`
- Get Aggregates for Meter - `GET /api/billing/meter/{meterId}/aggregates`
- Get Billing Report by ID - `GET /api/billing/{billId}`
- Recalculate Billing Report - `POST /api/billing/{billId}/recalculate`
- Get Recalculation History - `GET /api/billing/{billId}/recalculations`
- Record Bill View - `POST /api/billing/{billId}/view`

**Granularity Options**: `HOURLY`, `DAILY`, `MONTHLY`

#### 7. **Queries**

- Submit Query - `POST /api/queries`
- List My Queries - `GET /api/queries/me`
- List All Queries (Admin) - `GET /api/queries`
- Update Query Status - `PATCH /api/queries/{id}/status`
- Reply to Query - `PATCH /api/queries/{id}/reply`
- Delete Query - `DELETE /api/queries/{id}`

**Query Status**: `PENDING`, `AI_REVIEWED`, `RESOLVED`, `REJECTED`

#### 8. **AI Query Processing**

- Fetch Pending Queries for AI - `GET /api/queries/ai/pending`
- AI Classify Query - `PATCH /api/queries/{id}/ai-classify`
- AI Auto-Resolve Query - `PATCH /api/queries/{id}/ai-resolve`

**Confidence Score**: 0.0 to 1.0

#### 9. **Notifications**

- Get My Notifications - `GET /api/notifications`
- Create Notification (Admin) - `POST /api/notifications`
- List All Notifications (Admin) - `GET /api/notifications/admin`
- Mark All as Read - `PATCH /api/notifications/read-all`
- Mark Notification as Read - `PATCH /api/notifications/{id}/read`
- Delete Notification - `DELETE /api/notifications/{id}`

#### 10. **Reports**

- Create Report Format - `POST /api/reports/formats`
- List Report Formats - `GET /api/reports/formats`
- Generate Report - `POST /api/reports/generate`
- List Generated Reports - `GET /api/reports`
- Download Report - `GET /api/reports/{id}/download`
- Delete Report - `DELETE /api/reports/{id}`

**Report Types**: `BILLING_SUMMARY`, `CONSUMPTION_REPORT`, `METER_STATUS_REPORT`, `REVENUE_REPORT`
**Report Formats**: `PDF`, `CSV`, `XML`, `JSON`

#### 11. **Audit Logs**

- List Audit Logs - `GET /api/audit`
- Export Audit Logs as CSV - `GET /api/audit/export/csv`
- Get Audit Log by ID - `GET /api/audit/{id}`

**Permission Required**: `audit:read`

#### 12. **Reference Data**

- Create State - `POST /api/reference/states`
- List States - `GET /api/reference/states`
- Create Electricity Board - `POST /api/reference/boards`
- List Electricity Boards - `GET /api/reference/boards`
- Get Board by ID - `GET /api/reference/boards/{id}`
- Update Electricity Board - `PATCH /api/reference/boards/{id}`
- Delete Electricity Board - `DELETE /api/reference/boards/{id}`

#### 13. **Retention Policies**

- Create Retention Policy - `POST /api/retention`
- List Retention Policies - `GET /api/retention`
- Update Retention Policy - `PATCH /api/retention/{id}`
- Delete Retention Policy - `DELETE /api/retention/{id}`
- Run Retention Cleanup - `POST /api/retention/cleanup/run`

**Entity Types**: `MeterReading`, `AuditLog`, `GeneratedReportFile`, `CustomerQuery`

## Collection Variables

Pre-configured variables in Postman:

| Variable          | Description         | Usage                           |
| ----------------- | ------------------- | ------------------------------- |
| `base_url`        | API base URL        | `http://localhost:3000`         |
| `jwt_token`       | Bearer token        | Set with your Clerk JWT         |
| `user_id`         | User UUID           | Used in user endpoints          |
| `state_id`        | State UUID          | Used in state/board endpoints   |
| `board_id`        | Board UUID          | Used in board/meter endpoints   |
| `consumer_id`     | Consumer UUID       | Used in consumer endpoints      |
| `meter_id`        | Meter UUID          | Used in meter/billing endpoints |
| `bill_id`         | Billing Report UUID | Used in billing endpoints       |
| `query_id`        | Query UUID          | Used in query endpoints         |
| `notification_id` | Notification UUID   | Used in notification endpoints  |
| `report_id`       | Report UUID         | Used in report endpoints        |

**How to Set Variables:**

1. Click the **Variables** tab in Postman collection
2. Edit the `Current Value` field for each variable
3. Variables will automatically be replaced in requests using `{{variable_name}}`

## Authentication Setup

### Step 1: Configure Bearer Token

1. In Postman, go to the collection root
2. Click the **Authorization** tab
3. Select type: **Bearer Token**
4. Paste your Clerk JWT in the token field or use `{{jwt_token}}` variable

### Step 2: Set JWT Token

Replace `your_clerk_jwt_token_here` with your actual token:

```javascript
// In Postman Pre-request Script:
const token = 'your_actual_jwt_token';
pm.collectionVariables.set('jwt_token', token);
```

## API Endpoints Summary

### Total Endpoints: 60+

| Resource      | Count | Methods                                                                                                   |
| ------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| Users         | 8     | POST, GET, GET/{id}, PATCH, DELETE                                                                        |
| Consumers     | 7     | POST, GET, GET/{id}, PATCH, DELETE, GET/me, PATCH/me                                                      |
| Smart Meters  | 6     | POST, GET, PATCH/assign, GET/consumer, PATCH/status, GET/consumption                                      |
| Billing       | 8     | POST/generate, POST/aggregate, GET, GET/meter, GET/{id}, POST/recalculate, GET/recalculations, POST/view  |
| Queries       | 9     | POST, GET, GET/me, GET/ai/pending, PATCH/status, PATCH/reply, PATCH/ai-classify, PATCH/ai-resolve, DELETE |
| Notifications | 6     | GET, POST, GET/admin, PATCH/read-all, PATCH/{id}/read, DELETE                                             |
| Reports       | 6     | POST/formats, GET/formats, POST/generate, GET, GET/{id}/download, DELETE                                  |
| Audit         | 3     | GET, GET/export/csv, GET/{id}                                                                             |
| Reference     | 7     | POST/states, GET/states, POST/boards, GET/boards, GET/boards/{id}, PATCH/boards, DELETE/boards            |
| Retention     | 5     | POST, GET, PATCH, DELETE, POST/cleanup/run                                                                |
| Health        | 1     | GET /health                                                                                               |

## Request/Response Examples

### Example 1: Create User

**Request:**

```bash
POST /api/users
Content-Type: application/json

{
  "name": "John Admin",
  "email": "john@electricityboard.in",
  "phone": "9876543210",
  "role": "STATE_ADMIN",
  "stateId": "state-uuid-123",
  "boardId": null
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "user-uuid-456",
    "name": "John Admin",
    "email": "john@electricityboard.in",
    "role": "STATE_ADMIN",
    "stateId": "state-uuid-123",
    "boardId": null,
    "createdAt": "2024-03-01T10:00:00Z"
  },
  "message": "User created successfully"
}
```

### Example 2: Generate Billing Report

**Request:**

```bash
POST /api/billing/generate
Content-Type: application/json

{
  "meterId": "meter-uuid-789",
  "billingStart": "2024-02-01T00:00:00Z",
  "billingEnd": "2024-02-29T23:59:59Z"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "bill-uuid-001",
    "meterId": "meter-uuid-789",
    "billingStart": "2024-02-01T00:00:00Z",
    "billingEnd": "2024-02-29T23:59:59Z",
    "totalUnits": 250.5,
    "energyCharge": 2255.45,
    "fixedCharge": 500.0,
    "taxAmount": 677.64,
    "totalAmount": 3433.09,
    "version": 1,
    "isLatest": true,
    "generatedAt": "2024-03-01T10:00:00Z"
  },
  "message": "Billing report generated successfully"
}
```

### Example 3: Submit Query

**Request:**

```bash
POST /api/queries
Content-Type: application/json

{
  "queryText": "Why did my electricity bill increase by 40% this month?"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "query-uuid-101",
    "consumerId": "consumer-uuid-102",
    "queryText": "Why did my electricity bill increase by 40% this month?",
    "status": "PENDING",
    "aiCategory": null,
    "aiConfidence": null,
    "adminReply": null,
    "createdAt": "2024-03-01T12:30:00Z",
    "updatedAt": "2024-03-01T12:30:00Z"
  },
  "message": "Query created successfully"
}
```

### Example 4: List Billing Reports (Paginated)

**Request:**

```bash
GET /api/billing?page=1&limit=10
Authorization: Bearer {{jwt_token}}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "bill-uuid-001",
      "meterId": "meter-uuid-789",
      "totalAmount": 3433.09,
      "billingStart": "2024-02-01T00:00:00Z",
      "billingEnd": "2024-02-29T23:59:59Z",
      "isLatest": true
    },
    {
      "id": "bill-uuid-002",
      "meterId": "meter-uuid-790",
      "totalAmount": 5200.5,
      "billingStart": "2024-02-01T00:00:00Z",
      "billingEnd": "2024-02-29T23:59:59Z",
      "isLatest": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

## Error Handling

### Common HTTP Status Codes

| Code | Meaning      | Example                   |
| ---- | ------------ | ------------------------- |
| 200  | OK           | Successful GET/PATCH      |
| 201  | Created      | Successful POST           |
| 400  | Bad Request  | Missing required field    |
| 401  | Unauthorized | Invalid/missing JWT token |
| 403  | Forbidden    | Insufficient permissions  |
| 404  | Not Found    | Resource doesn't exist    |
| 409  | Conflict     | Duplicate entry           |
| 500  | Server Error | Internal server error     |

### Error Response Format

```json
{
  "success": false,
  "message": "Invalid email format",
  "statusCode": 400
}
```

## Using OpenAPI Specification

The `openapi.json` file can be used with:

1. **Swagger UI** - Visual documentation

   ```bash
   # Using npx
   npx -y swagger-ui-dist@latest serve -p 8000 openapi.json
   ```

2. **Redoc** - Alternative documentation

   ```bash
   npx redoc-cli serve openapi.json
   ```

3. **API Gateway Imports**
   - AWS API Gateway
   - Azure API Management
   - Kong API Gateway
   - Any OpenAPI 3.0 compatible tool

## Best Practices

### 1. Security

- **Never commit JWT tokens** to version control
- Use collection variables for tokens
- Rotate tokens regularly
- Use environment-specific configurations

### 2. Testing

- Create a dedicated testing environment
- Use mock data that doesn't affect production
- Test all CRUD operations
- Validate error responses

### 3. Performance

- Use pagination for list endpoints (`page`, `limit`)
- Filter results where possible
- Cache frequently accessed data
- Monitor API response times

### 4. Documentation

- Keep collections updated with API changes
- Document custom scripts and workflows
- Maintain variable naming conventions
- Add comments to complex requests

## Common Workflows

### Workflow 1: Complete Billing Cycle

1. **Create Smart Meter** - Register new meter
2. **Assign Meter** - Link to consumer
3. **Generate Billing Report** - Calculate charges
4. **Create Notification** - Notify consumer
5. **Record View** - Track when consumer views bill

### Workflow 2: Handle Customer Query

1. **Submit Query** - Consumer submits inquiry
2. **Fetch Pending** - AI system retrieves pending queries
3. **AI Classify** - Classify query category
4. **AI Resolve** - Auto-generate response or route to support
5. **Reply** - Send response to consumer

### Workflow 3: User Management

1. **Create User** - Register new admin
2. **Set Role** - Assign role (STATE_ADMIN, etc.)
3. **Set Scope** - Assign state/board access
4. **Update Consent** - Configure data sharing preferences
5. **Audit Log** - Track all changes

## Support & Documentation

- **API URL**: `http://localhost:3000`
- **Health Check**: `GET /health`
- **Endpoints**: 60+ across 10 resources
- **Authentication**: Clerk JWT Bearer tokens
- **Response Format**: JSON with metadata

## Troubleshooting

### Issue: 401 Unauthorized

**Solution**: Verify JWT token is valid and set in Authorization header

### Issue: 403 Forbidden

**Solution**: Check user permissions and role assignments

### Issue: 404 Not Found

**Solution**: Verify UUID format and resource exists

### Issue: 400 Bad Request

**Solution**: Validate request body against schema (check openapi.json)

## Version Information

- **API Version**: 1.0.0
- **OpenAPI Version**: 3.0.0
- **Postman Schema**: v2.1.0
- **Last Updated**: March 1, 2026

---

**Ready to use!** Import the collection into Postman and start testing the SmartMettr API right away.
