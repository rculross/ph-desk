# How to calculate the total number of a certain user activity

Sometimes certain actions or activities users take in your platform are important for you to track (for example your sticky features).

If you're tracking them and sending this data into Planhat, then you as a CSM are able to be alerted about a drop in usage, a drop can affect your customer health score, and it can trigger several other actions in Planhat.

It's also beneficial because a customer might be using one feature, or doing a certain activity a lot and that could indicate they are ready for an upsell or a cross-sell.

## Creating the Calculated Metric

The very basic metric that calculates the total # in a certain time period:

```json
{"type": "metricOverTime", "days": x, "op": "LAST/SUM", "prop": "activities.name"}
```

- **x** = you enter the amount of days you would like this metric to consider
- **op** = you use LAST if you're using 1 day (so then it will consider the number activities for each day), and use SUM when you have more than 1 day
- **prop** = the first part is to call out which type of information the metric should consider, and in this example we are using "activities."
- **name** = the name of the activity you send into Planhat. Make sure it has the exact same wording and spacing as it shows in the left side of the screen where all of your activities and metrics are listed.

You're also able to create averages, trends, etc. It just depends on what your team is looking to track.