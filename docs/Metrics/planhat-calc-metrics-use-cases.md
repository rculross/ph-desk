# Metrics: Calculated Metrics Use Cases

## Calculated metrics content library - what are you looking for? 📚

[A deep-dive technical introduction](https://help.planhat.com/en/articles/9590739-calculated-metrics-technical-introduction)(helpful if you're looking to understand the broader data structure of Planhat, and its implications for calculated metrics)

Quite specific - [the SIGN function](https://help.planhat.com/en/articles/9587350-calculated-metrics-the-sign-function)

Calculated Metrics in Planhat are extremely powerful. By structuring as formulas they are also incredibly flexible, but we understand they can be quite technical for some of our users! So fear not, in this article we're going to provide you with several brilliant calculated metric use cases and provide you with the formula templates so you can start using them right away😄!

Please note that the formula templates listed below will have sections in bold. If you see a section in bold, this just means the metric name needs updating to the name of the metric you want to use before you can implement it.

If you need any assistance implementing or modifying the use cases provided, please contact Support who will be more than happy to assist you 👍!

## Basic Calculated Metrics

A simple calculated metric would be to sum a single metric over a set period of time or to combine multiple metrics. To illustrate this we have several examples listed below:

### 1. Count of Live Chats over the past 90 days

If you wanted to know the amount of live chats that have taken place over the past 30 days then you would use the formula template below:

```json
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.chat"}
```

This is counting the total conversations over the past 30 days of type "chat". You can use any conversation type that you have available e.g. email, note, ticket and so on. As soon as this formula is up and running it will provide you with a count of the conversations that have taken place over the past 30 days.

If instead you wanted to see the Average number of chats per day each client had over the last 30 days, you could modify the formula like this:

```json
{"type": "metricOverTime", "days": 30, "op": "AVERAGE", "prop": "conversations.chat"}
```

### 2. Total Activities over the past 30 days

Another example would be if you wanted to know the total number of activities that have taken place over the past 30 days. To do this I would sum the "activity_count" System Metric for the past 30 days.

```json
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}
```

This metric is an out-of-the-box metric that sums all user events sent to Planhat. There are other System Metrics we provide that help cover a range of core CS use cases.

### 3. Count of Logins for Yesterday

Depending on your data, you might want to know the total logins over a set period. If you have login data available and you want to know the amount of logins there were yesterday, you would use the following formula template:

```json
{"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "activities.Logged in"}
```

In this example your data point for Logins is called "Logged in". If you changed the "days":1 to "days":30 you would see results for the last 30 days instead.

### 4. Total Downloads over the past 30 days

If you were tracking downloads and you wanted to know how many downloads there have been for 2 different download types over the past 30 days then you would use this template formula:

```json
["SUM",
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "activities.Downloaded Report Type 1"},
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "activities.Downloaded Report Type 2"}]
```

Once implemented, this formula would provide you with a count of the total downloads that have happened over the past 30 days for the 2 different download types specified.

Viewing data over longer periods of time is key in CS as it helps you understand real trends, rather than making you react to the inevitable daily lumps and bumps in customer usage.

### 5. Highest and Lowest Health Score Changes over the past week

To identify customers with the highest and lowest changes in health score over the past week we take the health score as it was a week ago and subtract it from the last known health score. The "LAST" operator provides us with the most recent value of that metric that has been received.

Once you've implemented this formula you will have a number showing you the change in health score. For example, last week "Company X" had a health score of 9 but this week "Company X" has a health score of 7 this means we would see a change of 2. The formula template that you would use to see the Health Score Changes over the past week is shown below:

```json
["SUBTRACTION",
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "system.health"},
["SUBTRACTION",
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "system.health"},
{"type": "metricOverTime", "days": 6, "op": "SUM", "prop": "system.health"}]]
```

The formula works in 2 parts. First it looks for the most recent Healthscore value, then it looks for the Healthscore 7 days ago and takes that away from yesterday's score.

## Advanced Calculated Metrics

Don't be alarmed 😄! An advanced calculated metric just means you're using multiple operators, or you're using multiple operators in conjunction with multiple metrics. We've provided some fantastic use cases with the formula template below:

### 1. Identifying Your Most Expensive Customers to Manage

To identify your most expensive customers to manage from a support and CSM perspective you would divide the customers recurring revenue by the number of conversations they have with your team.

You will need to identify which conversation types you want to plugin to the formula. In the same location as Calculated Metrics you will see a section called "Conversations". Conversation types can be used in this formula.

Once you've implemented the formula you will have a number showing you how much each customer is paying for each interaction with your team. For example, a customer pays 1000 per month and they have 10 interactions, this would mean they're paying 100 per interaction. You identify another customer who is also paying 1000 per month but they've had 20 interactions, this means they're paying 50 per interaction, making them more expensive to manage.

Most Expensive Customers to Manage Formula Template:

```json
["DIVISION",
{"type": "metricOverTime", "days": 30, "op": "AVERAGE", "prop": "revenue.rrvalue"},
["SUM",
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.type1"},{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.type2"},{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.type3"}]]
```

### 2. Seats Remaining (%)

If you wanted to calculate the percentage of seats your customers have left before they require an upgrade then you would use the formula template shown below.

The formula works by dividing the seats occupied by the total seats available and then multiplying by 100 to convert the result into a percentage.

```json
["MULTIPLICATION",
{"type": "rawNumber", "value": 100},
["DIVISION",
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.active_seats"},{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.max_seats"}]]
```

### 3. Feedback Performance (%)

As a company you might be tracking the amount of customer feedback that you've received. If want to track the increase or decrease in feedback provided over the past 2 weeks compared to the same period prior to that, you can use the formula template below:

```json
["MULTIPLICATION",
["DIVISION",
{"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.feedback-given"},
["SUBTRACTION",
{"type": "metricOverTime", "days": 28, "op": "SUM", "prop": "activities.feedback-given"},{"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.feedback-given"}]],{"type": "rawNumber", "value": 100}]
```

If you have your feedback data in Planhat, you can implement this formula quite quickly! All you need to do is rename the feedback metric to the name of your metric and add this as a calculated metric, enjoy!

### 4. Average Health Score of the past week Compared to the Average of the past month (%)

A drop in health score is never good news! If you want to compare the average health score over the past week compared to the average health score over the past month as a percentage then you would use the formula template below:

```json
["MULTIPLICATION",
["DIVISION",
{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "system.health"},
{"type": "metricOverTime", "days": 28, "op": "AVERAGE", "prop": "system.health"}],
{"type": "rawNumber", "value": 100}]
```

The formula template above is dividing the average health score over the past week compared to the average health score of the past month and then multiplying by 100 so we get the results as a percentage.

### 5. Percentage of Active Users over the past 30 days

The more active your users are the less likely they are to cancel 😄. By identifying the percentage of active users over the past 30 days, we then have the opportunity to reach out to those customers who are less active. Of course there's never any guarantees! but if your customers are not using your product, they're less likely to purchase upgrades and will eventually cancel.

The formula below is taking the last calculated count of active users over the past 30 days, dividing by the total amount of users and then multiplying by 100. The output provides us with the percentage of active users over the past 30 days. If you want to implement this calculated metric, simply copy the formula template below and plug it straight into Planhat.

```json
["MULTIPLICATION",
["DIVISION",
{"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "system.users_active_last30"},
{"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "system.users_total"}],
{"type": "rawNumber", "value": 100}]
```

### 6. Identify a Decline in Product Usage (%)

It's well known that customers don't suddenly stop using your application and cancel their subscription. Typically there's a downwards trend in activity over a period of time and without any intervention will ultimately lead to the customer cancelling their subscription.

That's what makes this formula so valuable! If you want to identify your customers that are at risk, based on a substantial decline in product usage then you would use this formula:

```json
["MULTIPLICATION",
{"type": "rawNumber", "value": 100},
["DIVISION",
["SUBTRACTION",
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"},["SUBTRACTION",
{"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.activity_count"},{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}]],
["SUBTRACTION",
{"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.activity_count"},{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}]]]
```

This formula might look frightening at first glance but let me ease your mind by explaining exactly what it's doing:

We're calculating the activity for the past 30 days and the prior 30 days to that, working out the difference in activity between those periods then dividing and multiplying those figures to turn it into a percentage.

Here's an example using figures:

- Last 60 days of activity: 87
- Last 30 days of activity: 34
- Prior 30 days of activity: 53
- Difference between the current and prior 30 days of activity: -19
- Results as a percentage: (-19/53)*100 = -35.84%

As you can see from the results, there's nearly a 36% drop in product usage meaning we need to take immediate action! This is a great example of how useful calculated metrics can be. This calculated metric allows you to easily identify significant drops in product usage.