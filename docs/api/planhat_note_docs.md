# Note Model

Notes in Planhat are technically Conversations. You can create your own custom Touch Types to easily distinguish between different types of notes. You can also use custom fields to add more nuance to your Notes.

It's quite common for Notes in Planhat to sync with external systems such as Salesforce, Notes can also be created via Zapier or Planhat's native incoming webhooks.

## Model Fields

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| _id |  | objectId | Planhat identifier |
| companyId | Yes | objectId | Related company id (planhat identifier) |
| subject |  | string | Title of the note |
| description |  | string | Description of the note |
| date |  | string | Date when note was created. In ISO format |
| activityTags |  | array | Array of tag's objectId |
| users |  | array | Array of user's objects |
| companyExternalId |  | string | The External Company Id |
| type | Yes | string | For this model should be note |
| endusers |  | array | Array of enduser's objects |
| custom |  | object | A flexible object with custom data |

## POST Create Note

Create a new note.

### Endpoint Details
- **URL:** `POST /conversations`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Notes
- To create a note it's required to define in the payload a companyId and type as note.
- You can instead reference the company externalId or sourceId using the following command structure: "companyId": "extid-[company externalId]" or "companyId": "srcid-[company sourceId]".

### Example Request

```bash
curl --location --request POST 'https://api.planhat.com/conversations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '{
  "users": [
    {
      "id": "5d66266e187f60020bc8036f",
      "name": "Ivars",
      "isOwner": true
    }
  ],
  "date": "2021-08-22T16:15:50.772Z",
  "type": "note",
  "companyId": "61006bc89a3e0b702ed8ea49",
  "subject": "Support with Tenet",
  "description": "Support session with the client",
  "activityTags": [
    "5f514794dc005f275e9cc20c"
  ],
  "endusers": [
    {
      "id": "610091916d643a7c418aef42",
      "name": "Jane Doe"
    }
  ]
}'
```

### Example Response

```json
{
  "starred": false,
  "pinned": false,
  "autoTags": [],
  "activityTags": [
    "5f514794dc005f275e9cc20c"
  ],
  "emailTemplateIds": [],
  "isOpen": false,
  "tags": [],
  "waitsToBeFiltered": true,
  "timeBucket": [],
  "archived": false,
  "_id": "61081aede03cf31e13ea1e51",
  "users": [
    {
      "id": "5d66266e187f60020bc8036f",
      "name": "Ivars",
      "isOwner": true
    }
  ],
  "date": "2021-08-22T16:15:50.772Z",
  "type": "note",
  "companyId": "61006bc89a3e0b702ed8ea49",
  "subject": "Support with Tenet",
  "description": "Support session with the client",
  "endusers": [
    {
      "id": "610091916d643a7c418aef42",
      "name": "Jane Doe"
    }
  ],
  "snippet": "Support session with the client",
  "companyName": "Tenet",
  "createDate": "2021-08-02T16:18:53.730Z",
  "sender": [],
  "history": [],
  "__v": 0,
  "companySourceId": "119",
  "owner": "60ccb1c5965cc9e0f3848075",
  "followers": [],
  "userId": "610015551b990c65d4fb0a4c",
  "note": "Support with Tenet: Support session with the client",
  "nickName": "Jest tests"
}
```

## GET Single Note

Retrieve a specific note by its ID.

### Endpoint Details
- **URL:** `GET /conversations/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Notes
- To get a specific note it's required to pass the _id in the request URL as a parameter.
- Alternately it's possible to get a note using its externalId adding a prefix and passing this keyable as identifiers.
- Example: `GET /conversations/extid-[externalId]`

### Example Request

```bash
curl --location --request GET 'https://api.planhat.com/conversations/60fee824a4c764252c877c2b' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```

### Example Response

```json
{
  "date": "2021-07-26T16:51:44.146Z",
  "userIds": [
    "5f16fd8eee876638a9f2483c"
  ],
  "isCustomType": false,
  "subject": "t6",
  "_id": "60fee824a4c764252c877c2b",
  "type": "note",
  "tags": [],
  "createDate": "2021-07-26T16:51:48.720Z",
  "companyId": "584d9d5505ba1b622f04adb3",
  "companyName": "Daimler North America",
  "users": [
    {
      "id": "5f16fd8eee876638a9f2483c",
      "name": "Ernesto",
      "isOwner": true
    }
  ],
  "endusers": [],
  "assigneeName": "",
  "activityTags": [],
  "hasAttachments": false,
  "isSeen": false,
  "starred": false,
  "pinned": false,
  "archived": false,
  "custom": {
    "Activity Count": 0,
    "Days in Phase": 0,
    "Logins": 0
  }
}
```

## GET Multiple Notes

Retrieve a list of notes with optional filtering and pagination.

### Endpoint Details
- **URL:** `GET /conversations`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)
- **Max Results:** 2,000 notes per request

### Query Parameters
- `companyId` - Filter using company id. Multiple ids can be used separating them by commas
- `limit` - Limit the list length. Default: 30, Max: 2,000
- `offset` - Start the list on a specific integer index
- `sort` - Sort based on a specific property. Prefix the property with "-" to change the sort order
- `select` - Select specific properties. Multiple properties can be specified separating them by commas

### Example Request

```bash
curl --location --request GET 'https://api.planhat.com/conversations?limit=2&offset=0' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```

### Example Response

```json
[
  {
    "date": "2021-07-29T15:29:34.330Z",
    "userIds": [
      "58e231b14246fc73139f29e8"
    ],
    "hasMore": false,
    "isCustomType": false,
    "subject": "Chat with the client",
    "snippet": "Slack chat with the client.",
    "_id": "6102e3b08084189dcbf0e3f0",
    "type": "note",
    "tags": [],
    "createDate": "2021-07-29T17:21:52.347Z",
    "companyId": "61006bc89a3e0b702ed8ea49",
    "companyName": "Leo company",
    "users": [
      {
        "id": "58e231b14246fc73139f29e8",
        "name": "Alex",
        "isOwner": true
      }
    ],
    "endusers": [
      {
        "id": "610091916d643a7c418aef42",
        "name": "Lara Croft"
      }
    ],
    "assigneeName": "",
    "activityTags": [],
    "hasAttachments": false,
    "isSeen": false,
    "starred": false,
    "pinned": false,
    "archived": false
  },
  {
    "date": "2021-07-26T16:51:44.146Z",
    "userIds": [
      "5f16fd8eee876638a9f2483c"
    ],
    "isCustomType": false,
    "subject": "t6",
    "_id": "60fee824a4c764252c877c2b",
    "type": "note",
    "tags": [],
    "createDate": "2021-07-26T16:51:48.720Z",
    "companyId": "584d9d5505ba1b622f04adb3",
    "companyName": "Daimler North America",
    "users": [
      {
        "id": "5f16fd8eee876638a9f2483c",
        "name": "Ernesto",
        "isOwner": true
      }
    ],
    "endusers": [],
    "assigneeName": "",
    "activityTags": [],
    "hasAttachments": false,
    "isSeen": false,
    "starred": false,
    "pinned": false,
    "archived": false,
    "custom": {
      "Activity Count": 0,
      "Days in Phase": 0,
      "Logins": 0
    }
  }
]
```

## PUT Update Note

Update an existing note by passing the note _id in the request URL as a parameter.

### Endpoint Details
- **URL:** `PUT /conversations/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request PUT 'https://api.planhat.com/conversations/61081aede03cf31e13ea1e51' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '{
  "subject": "Possible upgrade",
  "description": "<p>The client is insterested in a subscription upgrade.</p>"
}'
```

### Example Response

```json
{
  "_id": "61081aede03cf31e13ea1e51",
  "starred": false,
  "pinned": false,
  "autoTags": [],
  "activityTags": [
    "5f514794dc005f275e9cc20c"
  ],
  "emailTemplateIds": [],
  "isOpen": false,
  "tags": [],
  "waitsToBeFiltered": true,
  "timeBucket": [],
  "archived": false,
  "users": [
    {
      "id": "5d66266e187f60020bc8036f",
      "name": "Ivars",
      "isOwner": true
    }
  ],
  "date": "2021-08-22T16:15:50.772Z",
  "type": "note",
  "companyId": "61006bc89a3e0b702ed8ea49",
  "subject": "Possible upgrade",
  "description": "<p>The client is insterested in a subscription upgrade.</p>",
  "endusers": [
    {
      "id": "610091916d643a7c418aef42",
      "name": "Jane Doe"
    }
  ],
  "snippet": "The client is insterested in a subscription upgrade.",
  "companyName": "Tenet",
  "createDate": "2021-08-02T16:18:53.730Z",
  "sender": [],
  "history": [],
  "__v": 0
}
```

## DELETE Note

Delete a note by its ID.

### Endpoint Details
- **URL:** `DELETE /conversations/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request DELETE 'https://api.planhat.com/conversations/61081aede03cf31e13ea1e51' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```

### Example Response

```json
{
  "starred": false,
  "pinned": false,
  "autoTags": [],
  "activityTags": [
    "5f514794dc005f275e9cc20c"
  ],
  "emailTemplateIds": [],
  "isOpen": false,
  "tags": [],
  "waitsToBeFiltered": true,
  "timeBucket": [],
  "archived": false,
  "_id": "61081aede03cf31e13ea1e51",
  "users": [
    {
      "id": "5d66266e187f60020bc8036f",
      "name": "Ivars",
      "isOwner": true
    }
  ],
  "date": "2021-08-22T16:15:50.772Z",
  "type": "note",
  "companyId": "61006bc89a3e0b702ed8ea49",
  "subject": "Possible upgrade",
  "description": "<p>The client is insterested in a subscription upgrade.</p>",
  "endusers": [
    {
      "id": "610091916d643a7c418aef42",
      "name": "Jane Doe"
    }
  ],
  "snippet": "The client is insterested in a subscription upgrade.",
  "companyName": "Tenet",
  "createDate": "2021-08-02T16:18:53.730Z",
  "sender": [],
  "history": [],
  "__v": 0
}
```

## PUT Bulk Upsert Notes

Create and/or update multiple notes in a single request.

### Endpoint Details
- **URL:** `PUT /conversations`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)
- **Max Results:** 5,000 notes per request

### Notes
- To create a note it's required to define a companyId.
- You can instead reference the company externalId or sourceId using the following command structure: "companyId": "extid-[company externalId]" or "companyId": "srcid-[company sourceId]".
- To update a note it is required to specify in the payload the _id.
- Since this is a bulk upsert operation it's possible to create and/or update multiple notes with the same payload.

### Example Request

```bash
curl --location --request PUT 'https://api.planhat.com/conversations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '[
  {
    "users": [
      {
        "id": "5d66266e187f60020bc8036f",
        "name": "Ivars",
        "isOwner": true
      }
    ],
    "date": "2021-08-22T16:15:50.772Z",
    "type": "note",
    "companyId": "61006bc89a3e0b702ed8ea49",
    "subject": "Support with Tenet",
    "description": "Support session with the client",
    "activityTags": [
      "5f514794dc005f275e9cc20c"
    ],
    "endusers": [
      {
        "id": "610091916d643a7c418aef42",
        "name": "Jane Doe"
      }
    ]
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
      "_id": "61672167d4ac8780f8f680af"
    }
  ],
  "updated": 0,
  "updatedErrors": [],
  "updatesKeys": [],
  "nonupdates": 0,
  "modified": [],
  "upsertedIds": [
    "61672167d4ac8780f8f680af"
  ],
  "permissionErrors": []
}
```