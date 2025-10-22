# Calculated Metrics: Technical Introduction

## Calculated metrics content library - what are you looking for? 📚

[A deep-dive technical introduction](https://help.planhat.com/en/articles/9590739-calculated-metrics-technical-introduction)(helpful if you're looking to understand the broader data structure of Planhat, and its implications for calculated metrics)

[Use cases and examples](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases)(and some more[Examples](https://help.planhat.com/en/articles/9587041-calculated-metrics-examples))

Quite specific - [the SIGN function](https://help.planhat.com/en/articles/9587350-calculated-metrics-the-sign-function)

This technical introduction will start by taking two steps back and give you a brief introduction to the overall Planhat data structure. Understanding the data structure will impact your ability to understand calculated metrics in-depth.

We're going to approach this like a funnel - start broad, and then narrow down to the end deliverable which is "how to build a calculated metric".

Sections:

## 1. Planhat Models

First, it's worthwhile to start by explaining models - probably the most fundamental element of Planhat's data structure.

[Models](https://help.planhat.com/en/articles/9587119-data-models) (similar to the "objects" you may be familiar with in other tools) are the core elements to which all raw data is associated with. For example, when you sell a deal then a license is created with an ARR value, a start date, end date, etc. Those three data points are part of the License model.

Without going into too much depth, let's make one comment on the data hierarchy of Planhat: the company model is at the top/center. For example, all licenses, end-users, conversations, tasks belong to a company. This makes intuitive sense - everything that happens with your customers belong to a customer. What this means is that the company model will often allow for standardised aggregations (e.g., we can see the end-user activities for Company X because all the end-users who performed the activities belong to a company by default).

Where can you find Planhat models in the app? Everywhere! They're literally what your Planhat is built upon.

For example, in [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer), you'll see the data models listed in a dropdown - pictured below.

(In both the screenshots above and below, note that some of the models shown in the screenshot have been renamed in this tenant, and not all models are available in every package.)

In the ["Data" Global Tool](https://help.planhat.com/en/articles/10037966-data-explorer) - where admins can configure fields etc. - you will see the models listed down the left-hand side.

When you're configuring Widgets (charts) for Dashboard and Presentation Pages, you choose which model to build it on (which data to visualize/analyze) via the "Object" dropdown menu.

## 2. Data types - fields and metrics

Data is associated with models, and exists in two main types: CRM data (fields etc.) and time-series data (metrics).

### 2A. Fields and Metrics

**Field:** a single-point-in-time data point (e.g., MRR, number of active licenses) of any type (list, text, number) that you typically find in the Data Module as columns

- **System fields:** standard fields in Planhat
- **Custom fields:** your own custom fields

**Metric:** numeric time-series data (e.g., active users but could also be MRR, active licenses) that lives in the Customer Intelligence Module

Both of these data types can be referenced across Planhat, and you can interact with them in [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) and [Pages](https://help.planhat.com/en/articles/10102923-page-types-in-upgraded-planhat).

### 2B. Metrics - the different types

Since we're talking about "building calculated metrics", let's explain the different types of Metrics a bit deeper. With "Metrics" selected in Data Explorer:

(You can see the "Type" property as a column in the screenshot above.)

- **System metrics:** standard metrics in Planhat
- **System-generated metrics:** there are also standard metrics under Conversations, Tasks, Revenue which are a function of data you input elsewhere in Planhat
  - For example, your Conversation Types (...create standard Conversation metrics) and Task activities (...create standard Task metrics)
- **Custom metrics:** this is raw data you are bringing into Planhat yourself for your own custom metrics (e.g., weeklyActiveUsers).
- **User activities:** this is raw data on usage you can bring into Planhat which can live on multiple models (company, end-user, project, asset)
- **Calculated metrics:** custom-built metrics in Planhat - let's continue below on how to build one

👑 **Best-practices on bringing in custom metrics**

- You cannot directly reference custom metrics everywhere in Planhat, so convert them to calculated metrics first (see below how-to)
- Push as raw / disaggregated data into Planhat as possible, and build calculated metrics on-top (vs. pushing in pre-calculated metrics). This makes your Planhat instance more adaptable and modular, allowing you to create that new metric in 2 years' time which you didn't know you wanted yet

## 3. Calculated Metrics

If you've seen [some examples](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases) of calculated metrics, you know they can look like this:

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}
```

```json
{"type": "propertyValue", "prop": "company.custom.expected number of logins"}
```

```json
["MULTIPLICATION",{"type": "rawNumber", "value": 100}, ["DIVISION",{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.active_seats"},{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.max_seats"}]]
```

There are several variations between these examples, and we will unpack the structural ones step-by-step below.

When you're creating a new calculated metric from scratch, you can click on the "here" link (shown in the example below) to display lots of technical information, similar to that which we will now cover in this article.

### 3A. Defining the calculated metric "type"

We'll start with the differences in "type" you can use within calculated metrics.

There are 5 broad types of calculated metrics:

**{"type": "rawNumber"}:** this is just if you want to write a number. Note that while all other arguments are written with " ", numbers are written without citation marks.

```json
{"type": "rawNumber", "value": 100}
```

**{"type": "propertyValue"}:** used when referencing a field (which does not exist as a time series). Note that the calculated metric will start tracking the data from today and going forward, and not retroactively. So when building a calculated metric of type propertyValue, then expect that the time series could be empty (value = 0) or constant for historical dates.

```json
{"type": "propertyValue", "prop": "company.custom.expected number of logins"}
```

**{"type": "metricOverTime"}:** used when referencing another system/custom metric or [calculated metric](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics) which already exists as time series data (i.e., "metric over time").

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.login"}
```

**{"type": "daysSince"}:** less common, measuring days since last occurrence, only available for Activities and Conversations.

```json
{"type": "daysSince", "prop": "activities.logins"}
```

**{"type": "totalSum"}:** very common, summing all values over all-time - this is an "all time cumulative sum" operator

```json
{"type": "totalSum", "prop": "activities.create user"}
```

📌 **Important to note**

As you can see in the examples above, the "type" you choose impacts the other arguments you need to input. For example, with a rawNumber you only need a "value" while for propertyValue and daysSince you only need a "prop".

### 3B. Calculated Metric Operators

The real power in calculated metrics doesn't come purely from referencing another data point, but rather in combining multiple ones into insight. For example, this week's number of active users vs. last week's number of active users. Making that comparison requires some type of operation, most likely a division or a subtraction.

- ADDITION
- SUBTRACTION
- MULTIPLICATION
- DIVISION
- MAXIMUM
- MINIMUM
- AVERAGE
- SIGN: one of the tricky ones is the SIGN function - read more on that [here](https://help.planhat.com/en/articles/9587350-calculated-metrics-the-sign-function). Another slightly more complex, function is IF, explained [here](https://help.planhat.com/en/articles/9587121-calculated-metrics-the-if-function).
- TREND: the "TREND" operator enables you to compare today's values to the value that you had 'x' days ago. For example, you could compare the number of logins today with the number of logins that you had 7 days ago.

Example calculated metric formula:

```json
{"type": "metricOverTime", "days": 7, "op": "TREND", "prop": "activities.login"}
```

### 3C. How to find the name of a metric/field you want to address

In the latter part of the metric, you need to address the data you want to represent. How do I find the name, and what are some naming conventions?

Metric names are always found in light grey below the given metric name when going into details. See three examples below.

- **Process Runs** is a custom metric with the name `metrics.Process Runs`
- **Health Score** is a system metric with the name `system.health`
- **Recurring Base** is a standard revenue metric with the name `revenue.rrvalue`

Field names are also found in light gray below the label name, or in the case of custom fields the "given name" = API name too.

📌 **Important to note**

You need to spell the name exactly as you find it. That includes both upper and lower case letters and spacing. So if you create a custom field called "No of companies" then the way to reference it in a calculated metric is `No of companies`.

### 3D. Addressable models in a calculated metric

We started this article by briefly explaining models, and now the reason for doing that might become clearer. As you can see, there are metrics and fields living under all models, and we need to clarify what you can and can't address when building a calculated metric.

There are four kinds of calculated metrics you can build:

- Company calculated metric (again, remember that company model = top/center-of-the-hierarchy)
- End-user calculated metric
- Asset calculated metric
- Project calculated metric

The rules for what models you can address are the following:

**For company calculated metrics you can reference:**

- Company custom and calculated metrics and company numeric fields
- End-user, Asset, and Project custom metrics (not fields)

**For End-user calculated metrics** = end-user metrics and end-user numeric fields

**For Asset calculated metrics** = Asset metrics and asset numeric fields

**For Project calculated metrics** = Project metrics and project numeric fields

### 3E. Referencing different properties in Planhat

Finally, let's bring it all together to explain how to reference properties of various data types.

#### Referencing calculated metrics

Read more [here](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics), but put shortly you use the calculated metric ID as follows:

```json
{"type": "metricOverTime", "days": 5, "op": "AVERAGE", "prop": "calculated.123456789"}
```

#### Referencing system or system-generated metrics

Write "system.[metricname]" or "revenue.[metricname]" or "task.[metricname]"

- Check this out by pressing "Generating a simple example" when editing a Calculated Metric and you can see how a system field is being referenced
- Use the {"type": "metricOverTime"} since we're addressing a metric

Average health in the past week compared to last month (the 100x multiplication is a matter of preference, turning percentages from e.g.. 0.08 to 8)

```json
["MULTIPLICATION",["DIVISION",{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "system.health"},{"type": "metricOverTime", "days": 30, "op": "AVERAGE", "prop": "system.health"}],{"type": "rawNumber", "value": 100}]
```

#### Referencing custom metrics

Write "metrics.[metricname]"

- Use the {"type": "metricOverTime"} since we're addressing a metric
- If it's a nested model metric, write [nested_model].metrics.[metricname]

Monthly active users as a share of total users

```json
["MULTIPLICATION",["DIVISION", {"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "metrics.monthly_active_users"},{"type": "metricOverTime", "days": 30, "op": "LAST", "prop": "metrics.total_users"}],{"type": "rawNumber", "value": 100}]
```

The calculation above might seem slightly complicated. What's "LAST"? And why is the metric "monthly" AND we take 30 days? Let's unpack.

- This is a case where you are pushing in "monthly active users" less than once per day (perhaps once a month)
- However, the calculated metric needs to calculate a value for each day, and it doesn't make practical sense for the value to be 0 on days where data isn't pushed in
- Therefore, we use "LAST" to look back in time and pick up the last available value
  - For example, maybe today is Nov 12 and monthly_active_users is pushed in on the 1st of each month, so we use "LAST" to bring in the data from Nov 1
- However, we only want to look back maximum 30 days to give this month's average active users, which is why we define "days" to be 30.
  - For example, using our previous case, if we would have set "days" to 2 then the calculation would be empty for Nov 12

#### Referencing fields

Finally, let's address fields.

- If system field: [model].[fieldname]
- If custom field: [model].custom.[fieldname]
- Use the {"type": "propertyValue"} since we're addressing a field

Number of Seats active - field addressed in the denominator

```json
["DIVISION",{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.active_seats"},{"type": "propertyValue","op": "LAST", "prop": "company.custom.seats"}]
```

A couple of notes when addressing fields in calculated metrics:

- This data will now be empty or constant historically because, as mentioned, we're starting to store a single-point-in-time data point as a time series
- You can not directly reference fields from a different model (so e.g., building a company calculated metric with an end-user field). You can indirectly solve this using something called "formula fields" which can make cross-model references, but that is currently not available to customers in the UI

## 4. Tips & tricks when when experimenting with calculated metrics

The best learning always comes from trial & error, so we encourage you to bring the theory from above into practice. Try building a few metrics. Examine the results. Go back to this article. Iterate.

So finally, we'd like to pass on some helpful notes to aide in that process.

### (Some) Quick notes on error messages

- If it says "Metric re-build in process", try refreshing the page and see if it remains
- Note that you will not be able to save/update a calculated metric with an incorrect syntax, so that's a "failsafe" to indicate whether your reference is correct or not

### Common root causes of incorrect results

When results from a calculated metric don't match the expected reality, this is often due to one of two factors: either the metric logic is incorrectly built, or the data input is erroneous.

- **Incorrect logic:** deeply think about the underlying data and how you manipulate it in the calculation. For example, are you sending in data which is already aggregated, and then summing it up over several days again?
- **Erroneous data:** naturally, if the data that is coming in is off, then all downstream data points will be off too. Here, use the "Show raw events" view on the custom metric or activities to examine what data is actually coming in. We suggest looking at this over time and filtering in companies you can sample check

### Note: How Calculated Metrics Build

Calculated metrics are built automatically once per day. The time of this daily sync job is set by default to run no earlier than 03:00 UTC. This means you need to ensure that the custom metric data you send into Planhat arrives before 03:00, in order for it to be built into the calculated metrics that reference them.

📌 **Note:** if you prefer to send your data at a different time, just speak to your CSM or TAM and they'll change the earliest daily sync job time for you. Additionally, if there is a risk that all or some of your data might arrive a little later than the daily sync job, we can configure the job to repeat after a delay, to catch any new data sent.

If your calculated metrics have clearly not built, despite your data having been ingested into the underlying custom metrics on time, you can rebuild the relevant calculated metrics for yourself or reach out to Planhat Support for further guidance.