# Calculated Metrics Inside Calculated Metrics

You can reference calculated metrics inside a calculated metric.

This sounds trivial, but unlocks some really powerful use cases:

- Analyse interpolated data, e.g., when you have non-daily / spotty data (if that sounds theoretical, drop down [here](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics#h_f326b043ca)to see what it means 🤖 )
- Time-series analysis of numeric fields (fields, not metrics!), like looking at week-over-week trends, find the min/max or average value over a given period of time for any numeric field in your customer database
- Your metric library can become more dynamic, which means updating in one place updates everywhere related (note: with great power comes great responsibility here, be mindful of cascading effects of updates and circular references)

Content below:

- What it means
- How calculated metrics are processed (📌 hint: you can now decide the order of metric processing!)

Before we dive into use cases, let's quickly explain how to do it

🏆 Read more [here](https://help.planhat.com/en/articles/9590739-calculated-metrics-technical-introduction) about how to build calculated metrics in general.

To reference another calculated metric inside a calculated metric:

1. Copy the calculated metric ID, which you can find under the calculated metric title and will look like this

```
calculated.625577d94c890d12cbfe6bfd
```

2. Insert the ID as the property value in a calculated metric operation, like below where the references calculated metric is another time series that you can sum up, take an average over defined number of days, etc (more on that below)

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "calculated.625577d94c890d12cbfe6bfd"}
```

## Use case #1: Analyse interpolated data

Sometimes when working with metrics you want to perform multiple operations on an entire time-series. This is most often relevant when you have gaps in your data (i.e., it's sent in non-daily) which leads to you using the "LAST" operator to smooth it over time, and then you want to analyse that smoothed time-series. Examples:

- You send in a time series with a few "gaps" in the data
- You only care about the latest available data point, which might not be daily

Let's imagine the scenario below where you are pushing in 3 different metrics (Log-ins, Temperature, NPS) that all have 1 day of null value. You want to build a calculated metric to show what the 5-day rolling average is.

| | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 |
|---------|-------|-------|-------|-------|-------|
| Log-ins | 7 | 5 | 9 | 5 | - |
| Temp (C°) | 22 | 15 | 15 | - | 17 |
| NPS | 5 | - | - | - | - |

Depending on the metric, the null value could be interpreted differently. In the case of Log-ins, it probably means no one logged in that day, and we can assume that null equals 0. In the case of temperature, looking at the other days' values it seems that null means "no value sent" rather than 0 (maybe the thermometer was broken, there was something wrong with the internet connection, etc). In the NPS case, a data point is only sent in when updated, but we should still treat Day 2-5 like they have that value.

📌 **Side note:** use [this](https://help.planhat.com/en/articles/9587120-custom-metrics-null-vs-zero-values) setting to choose how Planhat interprets zeros: as 0 or as null.

How does this relate to nested calculated metrics? In the case of Temperature and NPS, you probably want to "smooth" the data by assuming some replacement figure for the null value (since assuming 0 will mess up the 5-day rolling average).

To solve this, you can build a calculated metric which looks at the Temperature or NPS and saves the latest available data point. So for Day 4, that means taking 15C°. For NPS, that means looking further back and taking the latest available (5). In the Temperature case, the calculated metric would look like this:

```json
// Temperature example: calculated.123456789
{"type": "metricOverTime", "days": 3, "op": "LAST", "prop": "custom.temperature"}
```

📚 **Calculated Metric extra class:** the number of "days" in the "LAST" function can be anything from 1 to infinity, depending on how far back you want to fetch data. If you say days = 1, that means Planhat will only look back 1 day for a data point - meaning if you have 2 days in a row with null value then you will get a null value. This makes sense if the data is volatile and data farther back than the day before won't correlate to today. 2-5 is perhaps a reasonable value for Temperature if you live in volatile Sweden - 60 if you live in sunny California!

For NPS, maybe we'll always take the last value available!

This will generate a new time-series as a calculated metric:

| | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 |
|---------|-------|-------|-------|-------|-------|
| Log-ins | 7 | 5 | 9 | 5 | 0 |
| Temp (C°) | 22 | 15 | 15 | 15 | 17 |
| NPS | 5 | 5 | 5 | 5 | 5 |

Great - all smoooooth. But now you want to "sum up" these 5 days in order to average them - but this doesn't work. Previously, you couldn't use the "average over 5 days" on this, since that operation couldn't be performed on calculated metrics. Now, you can!

Again, using the calculated metric example:

```json
// 5-day average of temperature: calculated.987654321
{"type": "metricOverTime", "days": 5, "op": "AVERAGE", "prop": "calculated.123456789"}
```

## Use case #2: Time-series analysis of numeric fields

In calculated metrics, you can reference a numeric field (i.e., point-in-time data) which turns it into a time-series.

This was possible before, but then you couldn't do any "analytics" on it, like:

- Define change over time (e.g., week-over-week change)
- Find the min/max value over a given period of time
- See the average over a period of time

With calculated metrics inside calculated metrics, you can:

The "first" calculated metric which turns field data into a metric could look like:

```json
// Field to metric: calculated.121212123
{"type": "propertyValue", "prop": "company.custom.employee count"}
```

Now, you can:

```json
// Average over last 7 days
{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "calculated.121212123"}

// Maximum value in last year
{"type": "metricOverTime", "days": 365, "op": "MAX", "prop": "calculated.121212123"}

...and so on!
```

Note that this does not work retroactively, i.e., Planhat only starts saving down the daily value from the day you set up the metric.

## Use case #3: Make your metric library more efficient and dynamic

### What it means

When you build up a library of metrics to understand your customer operations, you often end up having some depend on others.

Let's assume you have two metrics called "This week's logins" and "Last week's logins" which are based on summing up a custom metric being pushed in from your back-end. Now you want a "Week-over-Week change in logins" metric which does a week-by-week comparison. Without being able to reference other calculated metrics, this would have looked like:

```json
// Metric 1: THIS WEEK'S LOGINS
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "custom.logins_per_day"}

// Metric 2: LAST WEEK'S LOGINS
["SUBTRACTION",
{"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "custom.logins_per_day"},
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "custom.logins_per_day"}]]

// Metric 2: WEEK-OVER-WEEK CHANGE IN LOGINS
["DIVISION",
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "custom.logins_per_day"},
["SUBTRACTION",
{"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "custom.logins_per_day"},
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "custom.logins_per_day"}]]
```

Now, with the ability to reference other calculated metrics, it both looks cleaner and is more dynamic. Change one calculation, and it updates across. See below:

```json
// Metric 1: THIS WEEK'S LOGINS
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "custom.logins_per_day"}

// Metric 2: LAST WEEK'S LOGINS
["SUBTRACTION",
{"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "custom.logins_per_day"},
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "custom.logins_per_day"}]]

// Metric 2: WEEK-OVER-WEEK CHANGE IN LOGINS
["DIVISION",
{"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "calculated.626a62ecea8fbb3c3ed1086b"},
{"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "calculated.625577d94c890d12cbfe6bfd"}]
```

## Referencing Calculated Metrics on Related Models

If you're creating a company calculated metric, you can also reference calculated metrics on other, related models such as End Users, Assets, and Projects (just like you can reference custom metrics), for example:

```json
["SUM", {"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "enduser.email_events.sent"}, {"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "enduser.calculated.63df8599d800745c0f198456"} ]
```

Being able to run calculated metrics on the related object level and then roll these calculations up to the Company level unlocks a number of use cases involving pre-processing at the lower level. One of the most useful is count conditional (count the unique number of End Users, Assets, and Projects meeting a condition) based on a child-calculated metric, using the SIGN operator.

Here's an example...

### Example: Unique Active Users

We create a SIGN-based calculated metric on the related object, for example, to indicate which end users are active (have logged in at least once), in the past 14 days:

```json
["SIGN", ["SUM", {"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.loggedin"}]]
```

This gives us, for each end user, a 1 or 0 indicating whether they have logged in during the past 14 days. Then, by referencing this calculated metric from the Company level, I can sum up all the 1's and 0's. Since all the active end users have a value of 1, summing these values each day tells me the total number of active end users (end users who logged in at least once in the past 14 days) on each company:

```json
[{"type": "metricOverTime", "days": 1, "op": "SUM", "prop": "enduser.calculated.id"} ]
```

🚀 **Quick tip:** When combined with the IF function, this is particularly powerful, allowing you to count the number of unique related objects meeting certain criteria, at a Company level.