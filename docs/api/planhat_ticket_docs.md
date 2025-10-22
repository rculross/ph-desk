# Ticket Model

Tickets in Planhat are Conversations, so if you plan to send tickets to Planhat via API then you can also use that endpoint. The ticket endpoint contains a bit of convenience logic for saving tickets specifically, like setting the proper type automatically.

Most customers sync tickets from an external system like Zendesk or Salesforce. In case your ticketing system isn't natively supported or you have your own system for it, this API provides the necessary functionality.

## Model Fields

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| _id |  | objectId | Planhat identifier |
| source |  | string | The name of the system this ticket originates from. Typically "Zendesk", "Desk", etc., but since you're reading these docs you may have your tickets in some other tool |
| companyId | Yes | objectId | Related company id (planhat identifier) |
| sourceId | Yes | string | Id of the ticket in the source system |
| email | Yes | string | Email of the person who submitted the ticket. Items without email will be silently dropped |
| domains |  | array | Array of strings (required if companyExternalId not specified) |
| companyExternalId |  | string | The External Company Id |
| title |  | string | If the ticket has a title or main subject |
| description |  | string | Description of the ticket |
| url |  | string | Url to where more information can be found about this ticket |
| tags |  | array | Array of tags in string format |
| type |  | string | The type of the ticket. Use as you like, but typically it could be: "bug", "feature request", "training", etc |
| severity |  | string | String describing the severity, no restrictions on the scale apart from that |
| product |  | string | Name of the product to which the ticket relates |
| timeSpent |  | integer | Time spent on this ticket, measured in number of minutes |
| status |  | string | Any status options you like. Typically "new", "pending", "open", "resolved", "closed", or something similar |
| history |  | array | Array of objects containing the status history of the ticket |

## GET Multiple Tickets

Retrieve a list of tickets with optional filtering and pagination.

### Endpoint Details
- **URL:** `GET /tickets`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)
- **Max Results:** 10,000 tickets per request

### Query Parameters
- `companyId` - Filter using company id. Multiple ids can be used separating them by commas
- `limit` - Limit the list length. Default: 500, Max: 10,000
- `offset` - Start the list on a specific integer index
- `sort` - Sort based on a specific property. Prefix the property with "-" to change the sort order
- `select` - Select specific properties. Multiple properties can be specified separating them by commas
- `status` - Filter by status of tickets
- `email` - Filter by email
- `search` - Filter ticket searching for matching strings in the snippets

### Example Request

```bash
curl --location --request GET 'https://api.planhat.com/tickets?s=open&cid=61006bc89a3e0b702ed8ea49&l=1' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```

### Example Response

```json
[
  {
    "_id": "60d4e139e9c01e379effa355",
    "externalId": "5003X00002CDLbHQAX",
    "type": "ticket",
    "source": "salesforce",
    "subType": "ticket",
    "subject": "[00001044] SFDC Case 1",
    "snippet": "Test case from SFDC",
    "email": "jbacon@gmail.com",
    "status": "New",
    "history": [
      {
        "status": "New",
        "time": "2021-06-24T19:47:05.084Z"
      }
    ],
    "url": "https://eu29.salesforce.com/5003X00002CDLbHQAX",
    "createDate": "2021-06-24T19:38:16.000Z",
    "updateDate": "2021-06-24T19:38:16.000Z",
    "date": "2021-06-24T19:38:16.000Z",
    "days": 18802,
    "timeBucket": [
      "2021",
      "2021-Q2",
      "2021-6",
      "2021-W26"
    ],
    "companyId": "56bccdf554d64d837d01be80",
    "companyName": "Exxon",
    "endusers": [
      {
        "id": "5f7e1a07dcd4235b544f3ce4",
        "name": "John Bacon"
      }
    ],
    "inDate": "2021-06-24T19:38:16.000Z",
    "custom": {
      "Closed Date": null,
      "Created Date": "2021-06-24T19:38:16.000+0000",
      "Days in Phase": 0,
      "Logins": 0,
      "Renewal in days": -1,
      "Activity Count": 0,
      "Week No": 29.285714285714285
    },
    "starred": false,
    "pinned": false,
    "activityTags": [],
    "emailTemplateIds": [],
    "isOpen": false,
    "tags": [],
    "waitsToBeFiltered": true,
    "archived": false,
    "users": [],
    "sender": []
  }
]
```

## PUT Bulk Upsert Tickets

Bulk create and/or update multiple tickets. To create a ticket it's required to define a sourceId, email, and domains. To update a ticket it is required to specify in the payload one of the following keyables, listed in order of priority: _id, sourceId.

### Endpoint Details
- **URL:** `PUT /tickets`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)
- **Max Items:** 5,000 tickets per request

### Example Request

```bash
curl --location --request PUT 'https://api.planhat.com/tickets' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}' \
--data-raw '[
  {
    "sourceId": "119",
    "source": "freshdesk",
    "status": "open",
    "history": [{"status": "open", "time": "2019-12-15T09:09:08.000Z"}],
    "title": "Test Ticket",
    "description": "Let have a chat?",
    "url": "http://urltoyourticket.com/119",
    "type": "ticket",
    "email": "ojpsoi57pzn@gmail.com",
    "name": "first-ojpsoi57pzn",
    "companyId": "61006bc89a3e0b702ed8ea49",
    "agentEmail": null,
    "domains": ["planhat.com", "google.com"]
  }
]'
```

## DELETE Ticket

Delete a ticket by passing the _id in the request URL as a parameter.

### Endpoint Details
- **URL:** `DELETE /tickets/{id}`
- **Authentication:** Bearer token required
- **Rate Limits:** 200 calls/minute (soft), 150 req/sec (hard)

### Example Request

```bash
curl --location --request DELETE 'https://api.planhat.com/tickets/{_id}' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {{apiToken}}'
```
