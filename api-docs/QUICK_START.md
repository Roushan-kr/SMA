# SmartMettr API - Quick Start Guide

## 📦 What You Have

Three files have been generated in your project root:

1. **`openapi.json`** - Full OpenAPI 3.0 specification (can be imported to Swagger, Redoc, etc.)
2. **`postman-collection.json`** - Postman collection with 120+ pre-configured requests
3. **`POSTMAN_GUIDE.md`** - Detailed documentation

## 🚀 Getting Started in 5 Minutes

### Step 1: Open Postman

- Download [Postman](https://www.postman.com/downloads/) if you don't have it
- Launch the application

### Step 2: Import Collection

1. Click **File** → **Import**
2. Choose **Upload Files**
3. Select `postman-collection.json`
4. Click **Import**

✅ Done! Your collection is ready to use.

### Step 3: Set Your JWT Token

1. Find the collection in left sidebar: **SmartMettr Energy Management API**
2. Click the **Variables** tab
3. In the `jwt_token` row, paste your Clerk JWT in **Current Value**
4. Click **Save**

### Step 4: Start Testing

1. Expand any folder (e.g., **Health Check**)
2. Click on a request (e.g., **Health Status**)
3. Click **Send** button
4. View the response below

## 📋 Pre-configured Requests

### Quick Examples

#### 1. Health Check

```
GET /health
No authentication needed
```

👉 **Use this to verify the API is running**

#### 2. Create a User

```
POST /api/users
Body: {
  "name": "John Admin",
  "role": "STATE_ADMIN",
  "email": "john@example.com"
}
```

👉 **Creates a new admin user**

#### 3. Register Consumer

```
POST /api/consumers/register
Body: {
  "name": "Jane Doe",
  "address": "123 Main St",
  "stateId": "{{state_id}}",
  "boardId": "{{board_id}}"
}
```

👉 **Consumer self-registration**

#### 4. Create Smart Meter

```
POST /api/smart-meters
Body: {
  "meterNumber": "SM-001",
  "tariffId": "{{tariff_id}}"
}
```

👉 **Register new smart meter**

#### 5. Generate Billing Report

```
POST /api/billing/generate
Body: {
  "meterId": "{{meter_id}}",
  "billingStart": "2024-02-01T00:00:00Z",
  "billingEnd": "2024-02-29T23:59:59Z"
}
```

👉 **Generate monthly bill**

## 🔑 Collection Variables

Update these with your actual values:

| Variable      | Where to Use        | Example                 |
| ------------- | ------------------- | ----------------------- |
| `base_url`    | All requests        | `http://localhost:3000` |
| `jwt_token`   | Auth header         | `eyJhbGc...`            |
| `state_id`    | State operations    | UUID from create state  |
| `board_id`    | Board operations    | UUID from create board  |
| `consumer_id` | Consumer operations | UUID from register      |
| `meter_id`    | Meter operations    | UUID from create meter  |
| `bill_id`     | Billing operations  | UUID from generate bill |
| `query_id`    | Query operations    | UUID from submit query  |

**How to Update Variables:**

1. Click collection name → **Variables** tab
2. Edit the **Current Value** field
3. Click **Save**

## 📚 All Available Endpoints

### Users (8 endpoints)

- ✅ `POST /api/users` - Create user
- ✅ `GET /api/users` - List users
- ✅ `GET /api/users/{id}` - Get user
- ✅ `PATCH /api/users/{id}/role` - Update role
- ✅ `DELETE /api/users/{id}` - Delete user

### Consumers (7 endpoints)

- ✅ `POST /api/consumers/register` - Register
- ✅ `GET /api/consumers/me` - Get profile
- ✅ `PATCH /api/consumers/me` - Update profile
- ✅ `GET /api/consumers` - Admin list
- ✅ `DELETE /api/consumers/{id}` - Delete

### Smart Meters (6 endpoints)

- ✅ `POST /api/smart-meters` - Create meter
- ✅ `GET /api/smart-meters/{id}` - Get meter
- ✅ `PATCH /api/smart-meters/{id}/assign` - Assign to consumer
- ✅ `PATCH /api/smart-meters/{id}/status` - Update status
- ✅ `GET /api/smart-meters/{id}/consumption` - Get consumption

### Billing (8 endpoints)

- ✅ `POST /api/billing/generate` - Generate report
- ✅ `POST /api/billing/aggregate` - Create aggregate
- ✅ `GET /api/billing` - List reports
- ✅ `GET /api/billing/{id}` - Get report
- ✅ `POST /api/billing/{id}/recalculate` - Recalculate
- ✅ `POST /api/billing/{id}/view` - Record view

### Queries (9 endpoints)

- ✅ `POST /api/queries` - Submit query
- ✅ `GET /api/queries/me` - My queries
- ✅ `GET /api/queries` - Admin list
- ✅ `PATCH /api/queries/{id}/reply` - Reply
- ✅ `PATCH /api/queries/{id}/ai-classify` - AI classify
- ✅ `PATCH /api/queries/{id}/ai-resolve` - AI resolve

### Notifications (6 endpoints)

- ✅ `POST /api/notifications` - Create
- ✅ `GET /api/notifications` - My notifications
- ✅ `GET /api/notifications/admin` - Admin list
- ✅ `PATCH /api/notifications/{id}/read` - Mark as read
- ✅ `DELETE /api/notifications/{id}` - Delete

### Reports (6 endpoints)

- ✅ `POST /api/reports/formats` - Create format
- ✅ `GET /api/reports/formats` - List formats
- ✅ `POST /api/reports/generate` - Generate report
- ✅ `GET /api/reports` - List reports
- ✅ `GET /api/reports/{id}/download` - Download

### Audit (3 endpoints)

- ✅ `GET /api/audit` - List logs
- ✅ `GET /api/audit/export/csv` - Export CSV
- ✅ `GET /api/audit/{id}` - Get log

### Reference Data (7 endpoints)

- ✅ `POST /api/reference/states` - Create state
- ✅ `GET /api/reference/states` - List states
- ✅ `POST /api/reference/boards` - Create board
- ✅ `GET /api/reference/boards` - List boards
- ✅ `DELETE /api/reference/boards/{id}` - Delete board

### Retention (5 endpoints)

- ✅ `POST /api/retention` - Create policy
- ✅ `GET /api/retention` - List policies
- ✅ `PATCH /api/retention/{id}` - Update policy
- ✅ `DELETE /api/retention/{id}` - Delete policy

**Total: 60+ Endpoints**

## 🔐 Authentication

All endpoints (except `/health`) require a **Bearer JWT token**:

1. Get your JWT token from Clerk
2. Go to Postman collection → **Authorization** tab
3. Select **Bearer Token**
4. Paste token or use `{{jwt_token}}` variable

## 📊 Common Response Patterns

### Success Response

```json
{
  "success": true,
  "data": {
    /* actual data */
  },
  "message": "Operation successful"
}
```

### List Response with Pagination

```json
{
  "success": true,
  "data": [
    /* array of items */
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

## ⚡ Common HTTP Methods

| Method | Purpose             | Example                      |
| ------ | ------------------- | ---------------------------- |
| GET    | Retrieve data       | `GET /api/users`             |
| POST   | Create new resource | `POST /api/users`            |
| PATCH  | Update resource     | `PATCH /api/users/{id}/role` |
| DELETE | Remove resource     | `DELETE /api/users/{id}`     |

## 🎯 Testing Workflow

### 1. Setup Phase

```
1. Create Reference Data
   POST /api/reference/states
   POST /api/reference/boards

2. Create Users
   POST /api/users

3. Create Consumers
   POST /api/consumers/register
```

### 2. Business Operations

```
1. Create Smart Meters
   POST /api/smart-meters

2. Assign to Consumers
   PATCH /api/smart-meters/{id}/assign

3. Generate Bills
   POST /api/billing/generate

4. Handle Queries
   POST /api/queries
   PATCH /api/queries/{id}/ai-resolve
```

### 3. Monitoring

```
1. View Audit Logs
   GET /api/audit

2. Track Notifications
   GET /api/notifications

3. Check Policies
   GET /api/retention
```

## 🛠️ Using OpenAPI with Other Tools

### Swagger UI

```bash
npm install -g swagger-ui-dist
swagger-ui-dist serve -p 8000 openapi.json
# Visit http://localhost:8000
```

### ReDoc

```bash
npm install -g redoc-cli
redoc-cli serve openapi.json
# Visit http://localhost:8080
```

### API Gateway Import

- AWS API Gateway: Import → OpenAPI → Select `openapi.json`
- Azure API Management: Create from OpenAPI
- Kong: `kong openapi spec import openapi.json`

## 🔍 Debugging Tips

### Problem: 401 Unauthorized

```
✓ Check JWT token is valid
✓ Check token in Authorization header
✓ Check token hasn't expired
```

### Problem: 404 Not Found

```
✓ Verify resource UUID exists
✓ Check spelling of endpoint
✓ Verify correct base_url
```

### Problem: 400 Bad Request

```
✓ Check all required fields are present
✓ Validate JSON format (no syntax errors)
✓ Check field data types match schema
```

### Problem: 403 Forbidden

```
✓ Verify user has required permission
✓ Check user role is appropriate
✓ Verify scope (state/board) is correct
```

## 📞 API Status

| Endpoint      | Method | Status           |
| ------------- | ------ | ---------------- |
| `/health`     | GET    | ✅ UP            |
| All endpoints | \*     | 🔐 Requires Auth |

## 📖 Need More Details?

See **`POSTMAN_GUIDE.md`** for:

- Detailed endpoint documentation
- Request/response examples
- Authentication setup
- Best practices
- Error handling
- Complete workflows

## 🚀 Next Steps

1. ✅ Import collection
2. ✅ Set JWT token
3. ✅ Test `/health` endpoint
4. ✅ Create reference data (states, boards)
5. ✅ Create users and consumers
6. ✅ Create smart meters
7. ✅ Generate billing reports
8. ✅ Submit and process queries
9. ✅ Create notifications
10. ✅ Monitor audit logs

---

**Happy Testing! 🎉**

For questions or issues, check `POSTMAN_GUIDE.md` or contact support.
