# Metrics: System Metrics

Planhat's System Metrics display data such as: activity count, number of End Users and Health Score.

Click the image to view it enlarged

These can be visualised in line graphs in the ["Time-series" tab](https://help.planhat.com/en/articles/10037966-data-explorer#h_8e53b87a57) on the Company model in [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer). You can look for trends and patterns or compare metrics on the same line graph.

There's a lot more that you can do with System Metrics if you start using them with Calculated Metrics. If you would like to know more about Calculated Metrics check out this article: [Calculated Metrics](https://help.planhat.com/en/articles/9587317-metrics-calculated-metrics) and if you're already familiar with Calculated Metrics but you want to see more examples I recommend that you check out this article: [Calculated Metrics Use Cases](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases) 👍.

We're going to talk about the System Metrics that are available and how you can incorporate those into Calculated Metrics with the use of examples. We have included the formulas so you can not only see how the metrics are written but you can take the formula and plug it straight in for immediate use!

## Number of Users

The "Number of Users" system metric counts the End Users (your contacts and users at customers and prospects). On its own, the "Number of Users" metric provides a count of End Users. With the use of mathematical operators and the ability to combine metrics we have the option to create a wide range of powerful Calculated Metrics that will provide us with actionable insights.

Both of the examples below are utilising the "Number of Users" System Metric:

Calculate the average number of users over the past month.

```json
{"type": "metricOverTime", "days": 30, "op": "AVERAGE", "prop": "system.users_total"}
```

2. Calculate the percentage of active users over the past 30 days.

```json
["MULTIPLICATION",["DIVISION", {"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "system.users_active_last30"},{"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "system.users_total"}],{"type": "rawNumber", "value": 100}]
```

## Activity Count

The "user activity" data that you import populates the "Activity Count" metric. Tracking your customers' activity on a daily basis provides great value on its own, but there's so much more we can do with it 😄! We've provided a couple of Calculated Metric examples that are utilising the "Activity Count" System Metric:

1. Rather than just tracking the daily user activity which is likely to be more volatile, you can track your user activity over a set period of time! The formula below will sum the last 30 days of user activity.

```json
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}
```

2. It would be very useful to know what my activity levels are this month compared to last month. The formula below does exactly that! Planhat has made it simple for you to track any increase or decrease in usage over a set period of time with the use of System and Calculated metrics.

```json
["MULTIPLICATION", {"type": "rawNumber", "value": 100}, ["DIVISION", {"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}, ["SUBTRACTION", {"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.activity_count"}, {"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}]]]
```

## Health Score

The "Health Score" metric reflects the [Company Health Score](https://help.planhat.com/en/articles/10045917-configuring-health-scores-and-success-units-in-upgraded-planhat#h_2f6b986c63). The health score is displayed on a weekly basis so you can see how the health score is changing week by week which is great. But you guessed it, there's so much more we can do with this metric 😃!

To give you an idea of some of the ways you can use your health score metric within a calculated metric, we've provided a couple of examples below:

1. In addition to tracking the health score weekly, you might want to track the health score daily so you can spot declining health scores quicker meaning you can take action quicker.

```json
["SUBTRACTION",{"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "system.health"},["SUBTRACTION", {"type": "metricOverTime", "days": 2, "op": "SUM", "prop": "system.health"}, {"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "system.health"}]]
```

2. Another cool metric here! We're taking the average health score over the past week and we're comparing it to the average health score over the past month and presenting the answer as a percentage! I think you'll agree, this is very useful!

```json
["MULTIPLICATION",["DIVISION",{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "system.health"},{"type": "metricOverTime", "days": 28, "op": "AVERAGE", "prop": "system.health"}],{"type": "rawNumber", "value": 100}]
```

## CSM Score

"CSM Score" is a system (standard/default) rating field on the Company model. This CSM Score metric on its own shows you a score between 1 and 5 which is useful to gauge the current relationship with the customer. But similar to the health score examples above, you can track the CSM score percentage change over a set period of time. This can be useful to see how a relationship has grown or deteriorated over a period of time.

```json
["MULTIPLICATION", {"type": "rawNumber", "value": 100}, ["DIVISION", {"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.csm_score"},["SUBTRACTION", {"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.csm_score"}, {"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.csm_score"}]]]
```

## User active last 'X' days

The last four System Metrics are tracking how many End Users were last active over a set time period. We've provided you with what we believe are most useful and commonly used time periods which are: the last day, week, month (30 days) and quarter (90 days).

As shown earlier in this article, you can visualise all of these metric time periods in parallel on a line graph allowing you to easily compare any change in activity between time periods. This is obviously very cool, but there's more 😄!

It's useful to know the percentage of End Users that have been active over the past day, week or month. We can do this by incorporating our System Metrics into a Calculated Metric. The formulas below are dividing the amount of End Users by the total activity over a set time period, then multiplying by 100 which provides you with the percentage of End Users that have been active over the past day, week and month.

Calculate the percentage of End Users that have been active over the past day:

```json
["MULTIPLICATION",["DIVISION", {"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "system.users_active_last1"},{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "system.users_total"}],{"type": "rawNumber", "value": 100}]
```

Calculate the percentage of End Users that have been active over the past week:

```json
["MULTIPLICATION",["DIVISION", {"type": "metricOverTime", "days": 7, "op": "LAST", "prop": "system.users_active_last7"},{"type": "metricOverTime", "days": 7, "op": "LAST", "prop": "system.users_total"}],{"type": "rawNumber", "value": 100}]
```

Calculate the percentage of End Users that have been active over the past month:

```json
["MULTIPLICATION",["DIVISION", {"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "system.users_active_last30"},{"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "system.users_total"}],{"type": "rawNumber", "value": 100}]
```