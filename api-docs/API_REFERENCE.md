# SmartMettr API - Complete Reference & Overview

## 📦 Package Contents

```
api-docs/
├── openapi.json                 # OpenAPI 3.0 specification
├── postman-collection.json      # Postman collection (120+ requests)
├── POSTMAN_GUIDE.md            # Detailed documentation
├── QUICK_START.md              # Quick start guide
└── API_REFERENCE.md            # This file
```

## 🏗️ API Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────┐
│      Routes Layer               │
│  (Express route definitions)    │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│      Controllers Layer          │
│  (Request handling & response)  │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│      Services Layer             │
│  (Business logic & database)    │
└──────────────────────────────────┘
```

### Resource Model Relationships

```
State
├── ElectricityBoard
│   ├── User
│   ├── Consumer
│   │   ├── SmartMeter
│   │   │   ├── MeterReading
│   │   │   ├── ConsumptionAggregate
│   │   │   └── BillingReport
│   │   │       └── RecalculationLog
│   │   ├── CustomerQuery
│   │   ├── Notification
│   │   ├── CustomerConsent
│   │   ├── CustomerPreference
│   │   └── CustomerBillView
│   ├── ReportFormat
│   └── Tariff
└── DataRetentionPolicy
```

## 🔐 Authentication & Authorization

### Auth Flow

```
Client
  │
  ├─► Clerk Auth
  │      │
  │      └─► JWT Token
  │
  ├─► Send Request + JWT
  │
  ├─► Express Middleware
  │      │
  │      ├─► Verify JWT
  │      ├─► Resolve User
  │      └─► Permission Check
  │
  └─► Route Handler
```

### Permission System

| Permission              | Resource      | Operations                        |
| ----------------------- | ------------- | --------------------------------- |
| `user:manage`         | Users         | Create, Update Role/Scope, Delete |
| `audit:read`          | Audit Logs    | List, Export, Get                 |
| `consumer:read`       | Consumers     | List, Get                         |
| `consumer:update`     | Consumers     | Update, Delete                    |
| `meter:create`        | Smart Meters  | Create                            |
| `meter:read`          | Smart Meters  | Get, List                         |
| `meter:assign`        | Smart Meters  | Assign to Consumer                |
| `meter:update`        | Smart Meters  | Update Status                     |
| `billing:generate`    | Billing       | Generate, Aggregate               |
| `billing:read`        | Billing       | List, Get, Get Aggregates         |
| `billing:recalculate` | Billing       | Recalculate                       |
| `query:manage`        | Queries       | Manage, Classify, Resolve         |
| `notification:manage` | Notifications | Create, List, Delete              |
| `report:generate`     | Reports       | Generate, List, Download          |

### User Roles

```typescript
enum RoleType {
  SUPER_ADMIN     // All permissions, all scopes
  STATE_ADMIN     // Admin permissions for a state
  BOARD_ADMIN     // Admin permissions for a board
  SUPPORT_AGENT   // Can manage queries
  AUDITOR         // Read-only audit access
}
```

## 📊 Data Models

### User Model

```json
{
  "id": "uuid",
  "clerkUserId": "string (unique)",
  "name": "string",
  "email": "string (email)",
  "phone": "string",
  "role": "RoleType",
  "stateId": "uuid (optional)",
  "boardId": "uuid (optional)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Consumer Model

```json
{
  "id": "uuid",
  "clerkUserId": "string (unique, optional)",
  "name": "string",
  "phoneNumber": "string (optional)",
  "address": "string",
  "stateId": "uuid",
  "boardId": "uuid",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### SmartMeter Model

```json
{
  "id": "uuid",
  "meterNumber": "string (unique)",
  "status": "enum: ACTIVE|INACTIVE|FAULTY|DISCONNECTED",
  "consumerId": "uuid",
  "tariffId": "uuid",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### BillingReport Model

```json
{
  "id": "uuid",
  "meterId": "uuid",
  "tariffId": "uuid",
  "billingStart": "datetime",
  "billingEnd": "datetime",
  "totalUnits": "float",
  "energyCharge": "float",
  "fixedCharge": "float",
  "taxAmount": "float (optional)",
  "totalAmount": "float",
  "version": "integer (default: 1)",
  "isLatest": "boolean (default: true)",
  "generatedAt": "timestamp"
}
```

### CustomerQuery Model

```json
{
  "id": "uuid",
  "consumerId": "uuid",
  "queryText": "string (1-5000 chars)",
  "status": "enum: PENDING|AI_REVIEWED|RESOLVED|REJECTED",
  "aiCategory": "string (optional)",
  "aiConfidence": "float 0-1 (optional)",
  "adminReply": "string (optional)",
  "reviewedBy": "string (optional)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Notification Model

```json
{
  "id": "uuid",
  "consumerId": "uuid",
  "title": "string",
  "message": "string",
  "type": "string",
  "isRead": "boolean (default: false)",
  "createdAt": "timestamp"
}
```

### ConsumptionAggregate Model

```json
{
  "id": "uuid",
  "meterId": "uuid",
  "periodStart": "datetime",
  "periodEnd": "datetime",
  "granularity": "enum: HOURLY|DAILY|MONTHLY",
  "totalUnits": "float",
  "maxDemand": "float (optional)",
  "avgVoltage": "float (optional)",
  "createdAt": "timestamp"
}
```

### AuditLog Model

```json
{
  "id": "uuid",
  "userId": "uuid",
  "action": "string",
  "entity": "string",
  "entityId": "uuid",
  "metadata": "json (optional)",
  "createdAt": "timestamp"
}
```

## 🚀 Request/Response Flow

### Standard Request Format

```
POST /api/{resource}
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "field1": "value1",
  "field2": "value2"
}
```

### Standard Success Response

```
HTTP 200 / 201

{
  "success": true,
  "data": { /* resource data */ },
  "message": "Operation successful"
}
```

### Standard Error Response

```
HTTP 4xx / 5xx

{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

### List Response with Pagination

```
HTTP 200

{
  "success": true,
  "data": [ /* array of items */ ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

## 📋 Endpoint Categories

### 1. User Management Endpoints (8)

| Method | Endpoint                     | Purpose           |
| ------ | ---------------------------- | ----------------- |
| POST   | `/api/users`               | Create admin user |
| GET    | `/api/users`               | List users        |
| GET    | `/api/users/{id}`          | Get user details  |
| PATCH  | `/api/users/{id}/role`     | Update role       |
| PATCH  | `/api/users/{id}/scope`    | Update scope      |
| DELETE | `/api/users/{id}`          | Delete user       |
| GET    | `/api/users/{id}/consents` | List consents     |
| PATCH  | `/api/users/{id}/consents` | Update consent    |

### 2. Consumer Management Endpoints (7)

| Method | Endpoint                    | Purpose              |
| ------ | --------------------------- | -------------------- |
| POST   | `/api/consumers/register` | Register consumer    |
| GET    | `/api/consumers/me`       | Get self profile     |
| PATCH  | `/api/consumers/me`       | Update profile       |
| GET    | `/api/consumers`          | List all consumers   |
| GET    | `/api/consumers/{id}`     | Get consumer details |
| PATCH  | `/api/consumers/{id}`     | Update consumer      |
| DELETE | `/api/consumers/{id}`     | Delete consumer      |

### 3. Smart Meter Endpoints (6)

| Method | Endpoint                               | Purpose               |
| ------ | -------------------------------------- | --------------------- |
| POST   | `/api/smart-meters`                  | Create meter          |
| GET    | `/api/smart-meters/{id}`             | Get meter details     |
| PATCH  | `/api/smart-meters/{id}/assign`      | Assign to consumer    |
| GET    | `/api/smart-meters/consumer/{id}`    | Get consumer's meters |
| PATCH  | `/api/smart-meters/{id}/status`      | Update status         |
| GET    | `/api/smart-meters/{id}/consumption` | Get consumption       |

### 4. Billing Endpoints (8)

| Method | Endpoint                               | Purpose          |
| ------ | -------------------------------------- | ---------------- |
| POST   | `/api/billing/generate`              | Generate report  |
| POST   | `/api/billing/aggregate`             | Create aggregate |
| GET    | `/api/billing`                       | List bills       |
| GET    | `/api/billing/meter/{id}/aggregates` | Get aggregates   |
| GET    | `/api/billing/{id}`                  | Get bill details |
| POST   | `/api/billing/{id}/recalculate`      | Recalculate      |
| GET    | `/api/billing/{id}/recalculations`   | Get history      |
| POST   | `/api/billing/{id}/view`             | Record view      |

### 5. Query Endpoints (9)

| Method | Endpoint                          | Purpose          |
| ------ | --------------------------------- | ---------------- |
| POST   | `/api/queries`                  | Submit query     |
| GET    | `/api/queries/me`               | List my queries  |
| GET    | `/api/queries`                  | List all queries |
| PATCH  | `/api/queries/{id}/status`      | Update status    |
| PATCH  | `/api/queries/{id}/reply`       | Reply to query   |
| DELETE | `/api/queries/{id}`             | Delete query     |
| GET    | `/api/queries/ai/pending`       | Fetch for AI     |
| PATCH  | `/api/queries/{id}/ai-classify` | AI classify      |
| PATCH  | `/api/queries/{id}/ai-resolve`  | AI resolve       |

### 6. Notification Endpoints (6)

| Method | Endpoint                         | Purpose               |
| ------ | -------------------------------- | --------------------- |
| GET    | `/api/notifications`           | List my notifications |
| POST   | `/api/notifications`           | Create notification   |
| GET    | `/api/notifications/admin`     | List all              |
| PATCH  | `/api/notifications/read-all`  | Mark all read         |
| PATCH  | `/api/notifications/{id}/read` | Mark read             |
| DELETE | `/api/notifications/{id}`      | Delete                |

### 7. Report Endpoints (6)

| Method | Endpoint                       | Purpose         |
| ------ | ------------------------------ | --------------- |
| POST   | `/api/reports/formats`       | Create format   |
| GET    | `/api/reports/formats`       | List formats    |
| POST   | `/api/reports/generate`      | Generate report |
| GET    | `/api/reports`               | List reports    |
| GET    | `/api/reports/{id}/download` | Download        |
| DELETE | `/api/reports/{id}`          | Delete          |

### 8. Audit Endpoints (3)

| Method | Endpoint                  | Purpose           |
| ------ | ------------------------- | ----------------- |
| GET    | `/api/audit`            | List audit logs   |
| GET    | `/api/audit/export/csv` | Export CSV        |
| GET    | `/api/audit/{id}`       | Get audit details |

### 9. Reference Endpoints (7)

| Method | Endpoint                       | Purpose      |
| ------ | ------------------------------ | ------------ |
| POST   | `/api/reference/states`      | Create state |
| GET    | `/api/reference/states`      | List states  |
| POST   | `/api/reference/boards`      | Create board |
| GET    | `/api/reference/boards`      | List boards  |
| GET    | `/api/reference/boards/{id}` | Get board    |
| PATCH  | `/api/reference/boards/{id}` | Update board |
| DELETE | `/api/reference/boards/{id}` | Delete board |

### 10. Retention Endpoints (5)

| Method | Endpoint                       | Purpose       |
| ------ | ------------------------------ | ------------- |
| POST   | `/api/retention`             | Create policy |
| GET    | `/api/retention`             | List policies |
| PATCH  | `/api/retention/{id}`        | Update policy |
| DELETE | `/api/retention/{id}`        | Delete policy |
| POST   | `/api/retention/cleanup/run` | Run cleanup   |

### 11. Health Endpoint (1)

| Method | Endpoint    | Purpose      |
| ------ | ----------- | ------------ |
| GET    | `/health` | Health check |

## 🔄 Common Query Patterns

### Filtering

```
GET /api/users?role=STATE_ADMIN&page=1&limit=10
```

### Pagination

```
Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 10)
- sort: Sort field (optional)
- order: asc/desc (default: desc)
```

### Response Examples

**List with Pagination:**

```json
{
  "success": true,
  "data": [
    { "id": "uuid1", "name": "Item 1" },
    { "id": "uuid2", "name": "Item 2" }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## ⏱️ Rate Limiting

**Current Limits:**

- No hard limits enforced
- Recommended: 100 requests/minute per token
- Burst: Up to 200 requests

## 📅 Enums & Constants

### RoleType

```
SUPER_ADMIN    # Full access
STATE_ADMIN    # State-level access
BOARD_ADMIN    # Board-level access
SUPPORT_AGENT  # Query support
AUDITOR        # Read-only audit
```

### MeterStatus

```
ACTIVE        # Meter is operational
INACTIVE      # Meter is dormant
FAULTY        # Meter has issues
DISCONNECTED  # Meter is disconnected
```

### QueryStatus

```
PENDING      # Awaiting initial review
AI_REVIEWED  # AI has reviewed
RESOLVED     # Query resolved
REJECTED     # Query rejected
```

### ConsentType

```
ENERGY_TRACKING      # Track energy usage
AI_QUERY_PROCESSING  # Use AI for queries
```

### TariffType

```
RESIDENTIAL  # Residential tariff
COMMERCIAL   # Commercial tariff
INDUSTRIAL   # Industrial tariff
```

### AggregationGranularity

```
HOURLY   # Hourly aggregation
DAILY    # Daily aggregation
MONTHLY  # Monthly aggregation
```

### ReportFileFormat

```
PDF   # PDF format
CSV   # CSV format
XML   # XML format
JSON  # JSON format
```

## 🔍 Search & Filter Examples

### Find Users by Role

```
GET /api/users?role=STATE_ADMIN
```

### Get Paginated Results

```
GET /api/consumers?page=2&limit=20
```

### Filter Billing Reports by Date

```
GET /api/billing?page=1&limit=10
(Filter in response data)
```

### Get All Queries with Status

```
GET /api/queries?page=1&limit=50
(Filter in subscript: status=PENDING)
```

## 🛡️ Security Best Practices

### 1. Token Security

```
✓ Never hardcode tokens
✓ Use environment variables
✓ Rotate tokens regularly
✓ Use HTTPS only
```

### 2. Scope Management

```
✓ Users only see their scope
✓ SUPER_ADMIN can see all
✓ STATE_ADMIN sees state data
✓ BOARD_ADMIN sees board data
```

### 3. Permission Validation

```
✓ All operations checked against permissions
✓ Role-based access control (RBAC)
✓ Audit logging for all changes
✓ Enforce minimum permissions
```

## 🧪 Testing Scenarios

### Scenario 1: Set Up Billing System

```
1. Create State → Get state_id
2. Create Board → Get board_id
3. Create User (admin) → Get user_id
4. Create Tariff → Get tariff_id
5. Create Consumer → Get consumer_id
6. Create Meter → Get meter_id
7. Generate Bill → Get bill_id
```

### Scenario 2: Customer Support Flow

```
1. Consumer submits query
2. System fetches pending queries
3. AI classifies query
4. AI generates resolution or routes to support
5. Support agent replies
6. Consumer receives notification
7. Query marked as resolved
```

### Scenario 3: Data Retention

```
1. Create retention policy (e.g., 365 days for meter readings)
2. Monitor data age
3. Run cleanup when threshold reached
4. Archived data moved to backup
5. Verify audit logs
```

## 📈 Performance Considerations

### Pagination Best Practices

```
✓ Always use pagination for large lists
✓ Limit: 10-100 items per request
✓ Use page numbers, not offset
```

### Caching Strategy

```
✓ GET requests are cacheable
✓ POST/PATCH/DELETE bypass cache
✓ TTL: 5 minutes for reference data
```

### Database Indexes

```
✓ meterId, timestamp on MeterReading
✓ consumerId on BillingReport
✓ userId on AuditLog
```

## 🐛 Error Handling

### Common Error Cases

**Invalid Request**

```
HTTP 400 Bad Request
{
  "success": false,
  "message": "name is required",
  "statusCode": 400
}
```

**Not Authenticated**

```
HTTP 401 Unauthorized
{
  "success": false,
  "message": "Unauthorized",
  "statusCode": 401
}
```

**Insufficient Permissions**

```
HTTP 403 Forbidden
{
  "success": false,
  "message": "Forbidden",
  "statusCode": 403
}
```

**Resource Not Found**

```
HTTP 404 Not Found
{
  "success": false,
  "message": "Not found",
  "statusCode": 404
}
```

**Server Error**

```
HTTP 500 Internal Server Error
{
  "success": false,
  "message": "Internal server error",
  "statusCode": 500
}
```

## 📞 Support Resources

- **Documentation**: See POSTMAN_GUIDE.md
- **Quick Start**: See QUICK_START.md
- **OpenAPI Spec**: See openapi.json
- **API Base**: http://localhost:3000
- **Health Check**: GET /health

---

**Last Updated**: March 1, 2026
**API Version**: 1.0.0
**OpenAPI Version**: 3.0.0
