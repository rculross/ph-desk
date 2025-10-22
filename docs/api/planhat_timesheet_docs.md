# Timesheet Model

The Timesheet model represents a collection of time entries for a user, used for tracking time.

## Model Fields

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| _id |  | objectId | Planhat identifier |
| approvedBy |  | objectId | User who approved the timesheet |
| status |  | string | Status of the timesheet. Possible values are: "submitted", "approved", "returned". Default is "submitted" |
| timeEntries |  | array | Array of time entries associated with the timesheet |
| dateOfApproval |  | string | Date when the timesheet was approved |
| dateFrom |  | number | Start date of the timesheet period. Number of days since 1970-01-01 |
| dateTo |  | number | End date of the timesheet period. Number of days since 1970-01-01 |
| assignedModel |  | string | Model which the Timesheet is assigned to. Current supported value is "User" |
| assignedId |  | objectId | Id of which the Timesheet is assigned to. Currently only supports User Ids |

## POST Create Timesheet

Create a timesheet with no required fields. The timesheet will be created with the status "submitted", but the date range should be provided in the request body.

### Endpoint Details
- **URL:** `POST /timesheets`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request POST 'https://api.planhat.com/timesheets' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '{
  "timeEntries": [
    {
      "_id": "67d07487557181002fd16d50"
    },
    {
      "_id": "67d07694557181002fd16e1e"
    }
  ],
  "assignedId": "66eb28a6ef8857a5097fbce3",
  "assignedModel": "User",
  "dateFrom": 20156,
  "dateTo": 20163
}'
```

### Example Response

```json
{
  "timeEntries": [
    "67d07487557181002fd16d50",
    "67d07694557181002fd16e1e"
  ],
  "status": "submitted",
  "assignedModel": "User",
  "_id": "67d078fe557181002fd16f3e",
  "assignedId": "66eb28a6ef8857a5097fbce3",
  "dateFrom": 20156,
  "dateTo": 20163,
  "createdAt": "2025-03-11T17:55:10.313Z",
  "updatedAt": "2025-03-11T17:55:10.313Z",
  "__v": 0
}
```

## GET Single Timesheet

Retrieve a specific timesheet by its ID.

### Endpoint Details
- **URL:** `GET /timesheets/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request GET 'https://api.planhat.com/timesheets/67aca36fa8ba08053dee2ebf' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```

### Example Response

```json
{
  "_id": "67aca36fa8ba08053dee2ebf",
  "timeEntries": [
    "67aca36ea8ba08053dee2e73",
    "67aca36ea8ba08053dee2e74",
    "67aca36ea8ba08053dee2e75"
  ],
  "status": "submitted",
  "assignedModel": "User",
  "assignedId": "66eb28a6ef8857a5097fbce3",
  "dateFrom": 20128,
  "dateTo": 20135,
  "createdAt": "2025-02-12T13:34:39.353Z",
  "updatedAt": "2025-02-12T13:34:39.353Z",
  "__v": 0
}
```

## GET Multiple Timesheets

Retrieve a list of timesheets with optional filtering and pagination.

### Endpoint Details
- **URL:** `GET /timesheets`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)
- **Max Results:** 2,000 timesheets per request

### Query Parameters
- `limit` - Limit the list length. Default: 100, Max: 2,000
- `offset` - Start the list on a specific integer index
- `sort` - Sort based on a specific property. Prefix the property with "-" to change the sort order
- `select` - Select specific properties. Multiple properties can be specified separating them by commas

### Example Request

```bash
curl --location --request GET 'https://api.planhat.com/timesheets?limit=2&offset=0&select=_id,dateFrom,dateTo' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```

### Example Response

```json
[
  {
    "_id": "679a8fe00a84a200cd465542",
    "dateFrom": 20107,
    "dateTo": 20114
  },
  {
    "_id": "67a266e7c3074c019778e17c",
    "dateFrom": 20121,
    "dateTo": 20128
  }
]
```

## PUT Update Timesheet

Update an existing timesheet by passing the timesheet _id in the request URL as a parameter.

### Endpoint Details
- **URL:** `PUT /timesheets/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request PUT 'https://api.planhat.com/timesheets/67d078fe557181002fd16f3e' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '{
  "status": "approved"
}'
```

### Example Response

```json
{
  "_id": "67d078fe557181002fd16f3e",
  "timeEntries": [
    "67d07487557181002fd16d50",
    "67d07694557181002fd16e1e"
  ],
  "status": "approved",
  "assignedModel": "User",
  "assignedId": "66eb28a6ef8857a5097fbce3",
  "dateFrom": 20159,
  "dateTo": 20165,
  "createdAt": "2025-03-11T17:55:10.313Z",
  "updatedAt": "2025-03-11T17:57:12.306Z",
  "__v": 0,
  "approvedBy": "66eb28a6ef8857a5097fbce3",
  "dateOfApproval": "2025-03-11T17:57:12.305Z"
}
```

## PUT Bulk Upsert Timesheets

Bulk create and/or update multiple timesheets. To create a timesheet, there are no required fields. To update a timesheet it is required to specify _id in the payload.

### Endpoint Details
- **URL:** `PUT /timesheets`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)
- **Max Items:** 5,000 timesheets per request

### Example Request

```bash
curl --location --request PUT 'https://api.planhat.com/timesheets' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '[
  {
    "assignedId": "66eb28a6ef8857a5097fbce3",
    "assignedModel": "User"
  },
  {
    "_id": "67aca36fa8ba08053dee2ebf",
    "status": "returned"
  },
  {
    "_id": "67bf484af303d806b63d9a49",
    "status": "submitted"
  }
]'
```

### Example Response

```json
{
  "created": 1,
  "createdErrors": [],
  "insertsKeys": [
    {
      "_id": "67d08140557181002fd170dd"
    }
  ],
  "updated": 1,
  "updatedErrors": [],
  "updatesKeys": [
    {
      "_id": "67aca36fa8ba08053dee2ebf"
    }
  ],
  "nonupdates": 1,
  "modified": [
    "67aca36fa8ba08053dee2ebf"
  ],
  "upsertedIds": [
    "67d08140557181002fd170dd"
  ],
  "permissionErrors": [],
  "validationErrors": []
}
```

## DELETE Timesheet

Delete a timesheet by passing the _id in the request URL as a parameter.

### Endpoint Details
- **URL:** `DELETE /timesheets/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request DELETE 'https://api.planhat.com/timesheets/679a8fdd0a84a200cd4654aa' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```