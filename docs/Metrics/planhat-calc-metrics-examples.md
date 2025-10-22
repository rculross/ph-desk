# Calculated Metrics - examples

## Calculated metrics content library - what are you looking for? 📚

[A deep-dive technical introduction](https://help.planhat.com/en/articles/9590739-calculated-metrics-technical-introduction)(helpful if you're looking to understand the broader data structure of Planhat, and its implications for calculated metrics)

Quite specific - [the SIGN function](https://help.planhat.com/en/articles/9587350-calculated-metrics-the-sign-function)

The formulas to create calculated metrics in Planhat give you a lot of freedom and flexibility. We also appreciate that they can feel a bit nerdy/confusing to some users so here we'll provide you with some examples as inspiration.

In all the examples above we'll use the metrics "daily logins", of course this is just an example and the same would apply to any other metric or combination of metrics.

## Example A: Number of daily logins.

So, let's assume you're tracking "login" as a user activity. In the Activity section of the usage module you'll then see logins day by day. If this is exactly what you want, you could simply make a calculated metric (if you need it for triggers, health etc) to track this original metric.

The formula to do it is:

```json
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "activities.login"}
```

The LAST "operator" will only consider the last data point/day with data of the original metric, so the number of days doesn't matter here, you could set it to 1, 30 or 100 and it would give the same result, assuming you have daily data.

Most likely, this is not what you want though. Since daily logins will fluctuate a lot, perhaps even drop to zero on a public holiday etc, reacting to daily changes is not suitable for most SaaS B2B.

Instead you might want to look a longer time period - for example, let's look at the weekly average, which should give you a much smoother curve.

There are two, slightly different ways to get this average number of daily logins depending on what you are after..

Say it's Monday and data for past 7 days data looks like this:

- Sunday: 0 (logins)
- Saturday: 0
- Friday: 10
- Thursday: 12
- Wednesday: 8
- Tuesday: 9
- Monday: 10

The most common way of getting the average is taking the sum of all activities for these days, and divide it by the number of days.

Heres's what the formula looks like:

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, {"type": "rawNumber", "value": 7}]
```

Given the data above you'd get (10 + 12 + 8 + 9 + 10) / 7 = 7

So on average 7 logins per day.

In some cases you may only want to include the days where you actually had some data in the average.

Typically this is not the case with User Activities but may well be for your account level metrics.

In this case you could use the "AVERAGE" operator and the formula would be:

```json
{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "activities.login"}
```

The result in this case would be (10 + 12 + 8 + 9 + 10) / 5 = 9.8.

Again this is just to show the concept of the AVERAGE operator, in practice you will have (and will want to include) the zeros for Sat and Sun.

## Example B: Number of daily logins vs Target

Now number of logins typically won't say a lot. You'll have some larger customers with hundreds of daily logins and some smaller with only a few daily logins. But that doesn't mean the smaller customer is doing bad, so you'll want to track Logins as compared to some expected level.

Let's say you have "expected number of weekly logins" from your customer dialog as a custom data point on your profiles in Planhat, then here's how you'd get the ratio:

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, {"type": "propertyValue", "prop": "company.custom.expected number of logins"}]
```

Assuming the "expected weekly logins" is 100 for some customer and the actual logins past 7 days were 50, then you'd get a value of 0.5, which likely would vary from day to day.

If you'd rather think of it as a percentage, you could just multiply by 100:

```json
["MULTIPLICATION", ["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, {"type": "propertyValue", "prop": "company.custom.expected number of logins"}], {"type": "rawNumber", "value": 100}]
```

Now instead of 0.5 you'd get a value of 50.

## Example C: Number of daily logins - Volatile Trend

Perhaps you don't have an agreed expected level to compare with, then you may turn to historical data for the given customer so you can compare the number of daily logins with the same number exactly one week ago;

```json
{"type": "metricOverTime", "days": 7, "op": "TREND", "prop": "activities.login"}
```

Most metrics will fluctuate a lot from day to day, and so will this metrics, though if you keep the number of days to an even multiple of 7, you'll at least be comparing the same day of the week.

## Example D: Number of daily logins - Medium Volatile Trend

If the volatile trend if too much for you (and it typically is) then rather than comparing specific days, you may want to compare the past month with the previous, or this week with the previous.

Here's how you would do it.

1. Get the value for this week

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}
```

2) Get the value for previous week, by summing past 2 weeks and then subtracting the current week.

```json
["SUBTRACTION", {"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.login"}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}]
```

3) Divide the two numbers.

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, ["SUBTRACTION", {"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.login"}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}]]
```

## Example E: Number of daily logins - Smooth Trend

If even example D is be too volatile for you, then you can get get an even smoother curve by comparing two overlapping averages, for example compare past week to the average over the past 10 weeks.

Here's how you would do that:

1) Get the value for this week

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}
```

2) Get the value for past 10 weeks

```json
["DIVISION", {"type": "metricOverTime", "days": 70, "op": "SUM", "prop": "activities.login"}, {"type": "rawNumber", "value": 10}]
```

3) Divide the two numbers.

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, ["DIVISION", {"type": "metricOverTime", "days": 70, "op": "SUM", "prop": "activities.login"}, {"type": "rawNumber", "value": 10}]]
```

These are just a few examples to get you inspired. there's plenty more to play around with, like Log functions in case you have exponential metrics.

We're more than happy to help you get this set up so please reach out to discuss your specific case!