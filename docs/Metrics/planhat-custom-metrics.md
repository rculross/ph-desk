# Metrics: Custom Metrics and User Activities

This article is about product analytics, it's a fairly long article but reading it helps you understand the basics of how usage and calculated metrics work in Planhat. Grab a cup of coffee and let's get started.

## 📊 Three types of data

For the typical SaaS B2B, Product Usage is one of the main pillars in customer success.

Usage is all about data and you have three different types of data sources. You may want to leverage only one, two or all three of them. The three different types of data sources are:

- User Activities
- Custom Metrics
- Soft Metrics

### 1. User Activities

Activities are tracked per End User, and typically you'll want to capture at least 5-10 main actions that your End Users perform.

It's likely you'll want to track activities from different modules of your product which will help you understand which parts of your product are being used to help you drive product adoption.

While user activities are tracked and can be followed up per End User, they're also automatically aggregated on Company, Asset or Project level, so you can see how each of your customers are using your product overall.

This data can be collected by adding Planhat's [Tracking Script](https://docs.planhat.com/#user_activities) to your product, just like you would with Google Analytics or something similar. Alternatively you can send events straight to our [API](https://docs.planhat.com/#user_activities), Segment, Pendo or Mixpanel integrations. Finally, you can also import user activities by using our User Tracking Events Excel import template.

### 2. Custom Metrics

In most cases, just looking at user activity data will be a good start, but it won't take you all the way. A number of important metrics can only be tracked on Company level, since they do not directly result from a specific End User taking some form of action in your product. For example: "Megabytes of storage used", "Number of user accounts", "Total number of projects" etc.

Generally this type of data will be pulled from your own system and sent into Planhat once a day. It's quick and easy to send this data using our [API](https://docs.planhat.com/#metrics).

📣 **Pro tip:** Sometimes you might end up with wrong data added to user activities or custom metrics. If you want to remove data points from a user activity or custom metric for certain data range you can use "Remove Raw Data" option accessed via the ellipsis symbol (3 dots) in the Metric Preview.

Then select date ranges that you want to delete raw values for

Once you confirm your choice, your metric values according to specified period will be marked for deletion.

Please note that:

- deletions happen once every 25 minutes, so you might need to wait to actually see data deleted
- any custom metric or activity that has been synced to Planhat within last 90 minutes will still be in the initial processing and deletion will be available only after the 90 minutes have passed
- date that you select when deleting corresponds to raw value date, not ingestion date

### 3. Soft Metrics

This could be any numeric data point outside user activities or custom metrics such as things stipulated in the license agreement, or a usage target agreed with the customer during onboarding.

For example, the contract with a specific customer may say they're allowed to have 10 seats (user accounts). Or you may have set a common goals that the customer should login 500 times during the first year (a simple example but you get the idea).

We call them soft metrics because they're generally not saved on any computer but exist as verbal agreements or in some contract, which means the data can be manually added to Planhat or synced from a static data source like your CRM.

For most CSMs this data is either not available at all, or is siloed away from related data meaning manual work is required on a regular basis to blend data together and gain useful insights, eg active users / licenses user seats.

## 📚 Calculated Metrics - Concept

One thing we hear often from our customers is that the Success Team need a list of customers (just as an example) "in the enterprise segment that on average have not used module X for more than Y days".

To get this information, the technical team typically would run some database query and pull this list for the CS team. This works great for most companies but then the following week you want some other list and since your developers have a lot of other things to do, these questions from the CS team become a problem.

In Planhat, we've solved this scaling challenge for Customer Success teams by building what we call "[Calculated Metrics](https://help.planhat.com/en/articles/9587317-metrics-calculated-metrics)".

Calculated metrics let you convert and combine a few raw metrics into new more complex metrics - as an example, instead of asking your technical team to send you:

- average number of logins per week,
- average number of logins per month,
- total number of logins past 14 days

Simply have your technical team send "number of logins per day" to Planhat, and then you can do the rest yourself in Planhat. You can look at the average, min, max, sum, trend etc using the metric that you sent in. Add a few more raw metrics and possibilities become endless.

🚀 **Quick tip:** this [article](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases) contains examples of useful calculated metrics.

The true power comes from combining the different data sources. For example, let's say that one of your customers (Companies) is on a subscription plan including 10 seats. You add this level to the Company in Planhat (Soft Metric). Then you send in an automatic daily metric "total users" as defined in your own system, to track how many seats (user accounts) they really have.

Now you can create a calculated metric where you compare, for each customer, the agreed number of users with the actual! Some of your customers may be using only 10% or 50% of the seats they bought - which would be a signal that you see as a downgrade later on, while others may be at 100% which would be a clear upgrade opportunity.

Now use this new calculated metric in your Planhat health score, or perhaps set an alert to notify you whenever a customer climbs above 100% utilization, or a quick visual guide with a [Success Unit](https://help.planhat.com/en/articles/9587132-success-units).

📣 **Pro tip:** you're not limited to only comparing two metrics, if you're into it, you could set up deeply nested formulas combining any number of other metrics to truly get a clear picture of the value your customers are getting out of your product.

## 👨🏫 Calculated Metric Examples

The formulas to create calculated metrics in Planhat give you a lot of freedom and flexibility. We also appreciate that they can feel a bit confusing to some of our less technical users so we have provided you with several examples 🤓.

In all the examples below we'll use the metrics "daily logins", of course this is just an example and the same would apply to any other metric or combination of metrics.

📣 **Pro tip:** since calculated metrics can also be [based on other calculated metrics](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics), there's no need to build complex nested formulas. But of course, anything you can achieve by combining calculated metrics is also possible with a single calculated metric.

### Example A: Number of daily logins

Let's assume you're tracking "login" as a user activity. If this is exactly what you want, you could simply make a calculated metric (if you need it for triggers, health etc) to track this original metric.

This is the calculated metric formula that you would use:

```json
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "activities.login"}
```

The LAST operator will only consider the last data point/day with data of the original metric, so the number of days doesn't matter here, you could set it to 1, 30 or 100 and it would give the same result, assuming you have daily data.

Most likely, this is not what you want though. Since daily logins will fluctuate a lot, perhaps even drop to zero on a public holiday etc, reacting to daily changes is not suitable for most SaaS B2B.

Instead you might want to look a longer time period - for example, let's look at the weekly average, which should give you a much smoother curve. There are two, slightly different ways to get this average number of daily logins depending on what you are after.

Imagine today is Monday and data for past 7 days data looks like this:

- Sunday: 0 (logins)
- Saturday: 0
- Friday: 10
- Thursday: 12
- Wednesday: 8
- Tuesday: 9
- Monday: 10

The most common way of getting the average is by taking the sum of all the activities for these days and then divide it by the number of days.

This is what the calculated metric formula looks like:

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, {"type": "rawNumber", "value": 7}]
```

Given the data above you would get: (10 + 12 + 8 + 9 + 10) / 7 = 7, on average 7 logins per day.

In some cases you may only want to include the days where you actually had some data in the average. Typically this is not the case with User Activities but may well be for your account level metrics.

In this case you could use the "AVERAGE" operator and the formula would be:

```json
{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "activities.login"}
```

The result in this case would be (10 + 12 + 8 + 9 + 10) / 5 = 9.8.

Again this is just to show the concept of the AVERAGE operator, in practice, you will have (and will want to include) the zeros for Saturday and Sunday.

### Example B: Number of daily logins vs Target

Number of logins typically won't say a lot. You'll have some larger customers with hundreds of daily logins and some smaller with only a few daily logins. But that doesn't mean the smaller customer is doing bad, so you'll want to track logins and compare it to the expected level.

Let's say you have "expected number of weekly logins" from your customer dialog as a custom data point on your company profiles in Planhat. This is the formula that you would use to get the ratio:

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, {"type": "propertyValue", "prop": "company.custom.expected number of logins"}]
```

Assuming the "expected weekly logins" is 100 for some customer and the actual logins past 7 days were 50, then you'd get a value of 0.5, which likely would vary from day to day.

If you'd rather think of it as a percentage, you could just multiply by 100:

```json
["MULTIPLICATION", ["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, {"type": "propertyValue", "prop": "company.custom.expected number of logins"}], {"type": "rawNumber", "value": 100}]
```

Now instead of 0.5 you'd get a value of 50.

### Example C: Number of daily logins - Volatile Trend

Perhaps you don't have an agreed expected level to compare with, then you may turn to historical data for the given customer so you can compare the number of daily logins with the same number exactly one week ago;

```json
{"type": "metricOverTime", "days": 7, "op": "TREND", "prop": "activities.login"}
```

Most metrics will fluctuate a lot from day to day, and so will this metrics, though if you keep the number of days to an even multiple of 7, you'll at least be comparing the same day of the week.

### Example D: Number of daily logins - Medium Volatile Trend

If the volatile trend is too much for you (and it typically is) then rather than comparing specific days, you may want to compare the past month with the previous, or this week with the previous. This is how you would do that:

1. Get the value for this week:

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}
```

2) Get the value for previous week, by summing the past 2 weeks and then subtracting the current week:

```json
["SUBTRACTION", {"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.login"}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}]
```

3) Divide the two figures:

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, ["SUBTRACTION", {"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.login"}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}]]
```

### Example E: Number of daily logins - Smooth Trend

If example D is too volatile for you, then you can get get an even smoother curve by comparing two overlapping averages, for example compare past week to the average over the past 10 weeks. Here's how you would do that:

1) Get the value for this week:

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}
```

2) Get the value for past 10 weeks:

```json
["DIVISION", {"type": "metricOverTime", "days": 70, "op": "SUM", "prop": "activities.login"}, {"type": "rawNumber", "value": 10}]
```

3) Divide the two numbers:

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}, ["DIVISION", {"type": "metricOverTime", "days": 70, "op": "SUM", "prop": "activities.login"}, {"type": "rawNumber", "value": 10}]]
```

These are just a few examples to get you inspired. There's plenty more to play around with, like Log functions in case you have exponential metrics.