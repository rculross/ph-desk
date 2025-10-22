# Metrics: Calculated Metrics

Calculated Metrics are a way to convert and combine raw metrics into new, more complex metrics to show exactly what you want and need to know about your customer's usage of your products.

Typically a Customer Success team would be required to send database query requests to the IT department which takes up everyone's time. There may even be multiple data requests, e.g. average number of downloads per week, average number of downloads per month and total downloads over the past year.

With Calculated Metrics, you can simply request downloads per day from IT or get raw user activities via API or product usage tools, and do all of the calculations yourself with the use of the average, min, max, sum and last saving time whilst providing the freedom and flexibility you require.

📌 **Important to note:** This article provides quite a bit of detail, so grab a coffee ☕️, settle in and get ready to learn about creating calculated metrics.

🚀 **Quick tip:** Calculated metrics roll up to the Company level and if starred become part of the charts on your "Usage" tab on the company profile.

## How to Create a Calculated Metric

To create a Calculated Metric in upgraded Planhat (ws.planhat.com), go to [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer), select "Metric" in the dropdown menu, and click "+ Metric".

This will open up a modal where you can see a variety of Metric Templates. Templates make it super simple to add Metrics to your Planhat tenant. On the left-hand side you can see a series of categories to choose between.

In the top-left of the modal above, you can click "+ Calculated metric" if you would like to create a Calculated Metric from scratch, via a form like the one below.

It's important to remember when you're creating a Calculated Metric and specifying which Metric/Activity to use, you must use the exact spelling, including capitals.

For this example, we're going to be calculating the number of downloads over the past 90 days (you might not be tracking the number of downloads, so you would replace this metric with something else that you are tracking). Start off by naming your metric, we've named ours "Number of downloads". Then you need to enter your formula in the grey box below. For this example, we would use the formula below in order to calculate the number of downloads over the past 90 days.

```json
["SUM", {"type": "metricOverTime", "days": 90, "op": "SUM", "prop": "activities.Downloaded a report"}, {"type": "metricOverTime", "days": 90, "op": "SUM", "prop": "activities.downloaded content"}]
```

Let's break the equation down and explain what the equation is doing. The equation below is telling the system that we want to see the past 90 days of data.

```json
{"type": "metricOverTime", "days": 90,
```

The next part of the equation is telling the system to SUM the metric "activities.Downloaded a report".

```json
"op": "SUM", "prop": "activities.Downloaded a report"},
```

The whole equation is telling the system to SUM the metrics "activities.Downloaded a report" and "activities.downloaded content" over the past 90 days. We're taking two separate metrics and combining them to create a new metric.

```json
["SUM", {"type": "metricOverTime", "days": 90, "op": "SUM", "prop": "activities.Downloaded a report"}, {"type": "metricOverTime", "days": 90, "op": "SUM", "prop": "activities.downloaded content"}]
```

When creating a calculated metric you can incorporate a vast range of metrics. Any metrics that you have available in the following sections can be used: [other Calculated Metrics](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics), System Metrics, User Activities, Company Metrics, Conversations, Tasks and Revenue. We've provided some examples below to help illustrate how to incorporate these metrics into your calculated metrics.

🚀 **Quick tip:** to keep track of all your calculated metrics, populate the "description" box in the metric editor. When you hover over the metric name you'll see an information (i) symbol, giving you a description preview.

## System Metrics

We want to view the average CSM score over a 90-day period. Look at the equation used to achieve this in the image below. As you can see, we've used the 'system.csm_score' System Metric in the Calculated Metric.

All of the System Metrics listed below can be utilised in the same way:

- system.users_total (Number of users)
- system.activity_count (Activity count)
- system.health (Health score)
- system.csm_score (CSM score)
- system.users_active_last1 (Users active last day)
- system.users_active_last7 (Users active last seven days)
- system.users_active_last30 (Users active last thirty days)
- system.users_active_last90 (Users active last ninety days)

## User Activities

We would like to know the amount of reports that have been downloaded over the last 100 days. The equation in the image below is used to achieve this and as you may have noticed, the first part of the naming convention now begins with 'activities' not 'system'. Because we're using a metric from the "User Activities" section.

## Company Metrics

We would like to see the forecast over the last 32 days. We can do this by using the "Company Metrics" in a Calculated Metric. When we're writing an equation we use 'metrics' not 'Company Metrics' as you can see in the image below.

## Conversations

We would like to see the total live chats that have occurred over the past 90 days. We can do this by using "Conversations" in a Calculated Metric. The equation to do this is in the image below.

**Note: Conversations Metric Logic**

The `conversation.ticket` metric is defined by the following logic:

Each ticket can have multiple chats going back and forward. This metric will count the tickets that had a new "chat reply/message", per day.

So if:

- Apr 17: 2 new tickets created -> value: 2
- Apr 18: 1 of the tickets from yesterday had 14 messages -> value: 1
- Apr 19: no chats -> value: 0
- Apr 20: 1 new ticket created, 1 of the old tickets had a reply -> value: 2

**What this metric says...**

The metric measures ticket/support workload/intensity. Instead of only measuring "new tickets created" (which doesn't capture load on previously opened but unresolved tickets) or "total chats" (which is a very noisy and volatile figure, since some people wrong long single messages and others write each sentence as a message), this measures "Number of tickets with activity today".

## Tasks

We would like to see the total amount of tasks in the past. We can do this by using "Tasks" in a Calculated Metric. The equation to do this ("Tasks completed in the last day") is in the image below.

## Revenue

We would like to see the average contract length over the past 100 days. We can do this by using "Revenue" in a Calculated Metric. The equation to do this is in the image below.

Once you've had a go for yourself and you understand the basics you might want to create some more advanced calculated metrics, if that's the case, we recommend reading: [Calculated Metrics Use Cases](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases).

We hope this has been informative and easy to follow. We understand for some of our users this is quite technical so if you need any assistance setting up your calculated metrics, please contact support who will be more than happy to assist you 👍.