# How to calculate number of End Users per Company

If the number of End Users per Company is an important metric for you to track (for example your pricing is based on # of seats/users in the Company) you can do so by creating a calculated metric.

If you just want the total count of End Users in the Company, you can use the system metric "Number of Users".

Here is how you would set up the equation:

```json
{"type": "metricOverTime", "prop": "system.users_total"}
```

**Always, when creating a calculated metric and specifying which metric/activity to use, use the EXACT spelling, spacing, and capitalization that displays.**

However, when creating calculated metrics from the System Metrics, use the following:

- system.users_total (for Number of users)
- system.activity_count (for Activity Count)
- system.users_active_last1 (for Users active last day)
- system.users_active_last7
- system.users_active_last30
- system.users_active_last90

Let us know if you need any help setting up new calculated metrics for your business.

## Being Alerted of Overuse

This is a great calculated metric to create because you are able to be alerted if the company is above their # of seats.

To do this, you can create segments for the # of seats sold (which can sometimes relate to the price level package they have purchased). Then, create an automation to be alerted for when a company in that segment rises above that threshold.

Read [here](https://help.planhat.com/en/articles/9587184-ways-to-segment-your-customers-in-planhat) for more ideas on how to segment your customers in Planhat.