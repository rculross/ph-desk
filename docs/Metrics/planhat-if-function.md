# Calculated Metrics: the IF Function

## Calculated metrics content library - what are you looking for? 📚

An [introduction](https://help.planhat.com/en/articles/9587317-metrics-calculated-metrics)(helpful if you're looking to understand the broader data structure of Planhat, and its implications for calculated metrics)

[Use cases and examples](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases)(and some more[Examples](https://help.planhat.com/en/articles/9587041-calculated-metrics-examples))

How to work with [calculated metrics inside calculated metrics](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics)

Specific "Group Components":

The IF function unlocks a plethora of use cases for calculated metrics, allowing you to make time-series calculations conditional on rules of two types: 1) "has (no) value" and 2) "(less than, more than, equal to) value".

## What is it?

The IF function is a group operator, just like SUM, MAX, MIN, and so on. Put simply, it evaluates some condition based on other metrics, hard-coded values, or fields. The resulting value depends on whether the condition is true or false.

## What arguments does it have?

The function has two distinct configurations: first, "has value" vs. "has no value"; and second, "more than", "less than" and "equal to".

In the first case ("has (no) value"), the IF function takes 4 inputs, as follows:

```
["IF", value, "has (no) value", value if true, value if false]
```

In the second case ("less than", "more than", "equal to"), the IF function takes 5:

```
["IF", value 1, "less than"/"more than"/"equal to", value 2, value if true, value if false]
```

Where...

- values '1' and '2' are input values to compare (with the [below rules](https://help.planhat.com/en/articles/9587121-calculated-metrics-the-if-function#h_66f1252f2a)applying)
- 'operator' is one of: "has value", "has no value", "more than", "less than", "equal to", and is used to compare the two values in the function
- 'value if true' & 'value if false' are Part Components to output from the function depending on whether the criteria is met (true) or not (false)

## What can you use it for?

By embedding IF functions within one another, you can ultimately build a dynamic metric which calculates itself differently depending on which criterion is met. This means the IF function's use cases are truly limitless.

Here's a few examples to get your creative juices flowing...

### 1. Basic use cases: use IF to handle NULL values intelligently

There's one particularly salient application for the "has (no) value" operator. For example, you can eliminate the impact of missing data on your calculated metric, seamlessly replacing any missing (NULL) values ("has no value") with the metrics' 7-day average.

```json
["IF",
#every day I take the day's count of user logins
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "activities.loggedin"},
#the "has value" operator
{"type": "condition", "value": "has value"},
#if there is a value, the calculated metric uses it
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "activities.loggedin"},
#if there is no value, I take the average number of logins over the last 7 days
["DIVISION",
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.loggedin"},
{"type": "rawNumber", "value": 7}]]
```

### 2. Moderate use cases: use IF to simplify your most complex queries

Metric power-users are likely to have convoluted expressions involving operator chains like: SIGN, SUM, SIGN, SUBTRACTION, Value 1, Value 2, Value 3. Now the same can be achieved with IF alone, halving the number of operators involved. Let's take a look.

Say you sell X number of seats, and so you want an "opportunity" notification whenever a user goes above that seat value. You could previously create a flag of this kind with multiple operators (as below), but with the IF operator, the syntax becomes a whole lot easier...

**Before**

```json
["SIGN", ["SUM", ["SIGN", ["SUBTRACTION", {"type": "propertyValue", "prop": "company.custom.Max Seats feature X"}, {"type": "metricOverTime", "days": 750, "op": "SUM", "prop": "activities.Used feature X"}]], {"type": "rawNumber", "value": 1}]]
```

**After**

```json
["IF",{"type": "propertyValue", "prop": "company.custom.Max Seats feature X"},{"type": "condition", "value": "more than"},{"type": "metricOverTime", "days": 750, "op": "SUM", "prop": "activities.Used feature X"},{"type": "rawNumber", "value": 1}, {"type": "rawNumber", "value": 0}]
```

### 3. Advanced use cases: use IF to transform complex metrics

In the realm of IF, it's "more than", "less than" and "equal to" that have the real horsepower. But as ever, with great power comes great responsibility. To unlock more complex applications, we recommend you assess your use case carefully, then reach out to our colleagues at Planhat to help set everything up correctly.

Nonetheless, here's a taste of where IF can take you, to spark your imagination...

#### 3.1 Handling FX Rates - Company Calculated Metric

Imagine you want to track the revenue of your newly released product. Previously you were only able to track revenue in a local currency value, meaning you couldn't build the metric you wanted if your product was being sold in both USD and EUR. With IF, you can do just that (although in this case the FX rate is fixed, you could even have a custom metric pulling daily rates!).

```json
["IF",{"type": "propertyValue", "prop": "company.custom.Currency"},{"type": "condition", "value": "equal to"},{"type": "rawValue", "value": "USD"},{"type": "propertyValue", "prop": "company.custom.New feature ARR"},["DIVISION",{"type": "propertyValue", "prop": "company.custom.New feature ARR"},{"type": "rawNumber", "value": 1.07}]]
```

#### 3.2 Counting Active Users - End-User Calculated Metric

Perhaps you'd like to track the number of unique active users you have, from total user activities. This simple metric unlocks a breadth of possibility including the ability to track daily, weekly and monthly active users, as well as period-on-period changes. Or maybe you'd like to break down total user activity growth down into "growth in unique users", and "growth in average activity per user".

```json
["IF", {"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "activities.Logged in"}, {"type": "condition", "value": "more than"}, {"type": "rawNumber", "value": 0}, {"type": "rawNumber", "value": 1}, {"type": "rawNumber", "value": 0}]
```

## The Specifics: Input Values

As with all calculated metrics, since the introduction of [calculated metrics inside calculated metrics](https://support.planhat.com/en/articles/6175098-calculated-metrics-inside-calculated-metrics), you can input other metrics in addition to fields, and simple numeric (rawNumber) values.

That said, there are some logical constraints to what field components can be used with the IF function:

- For "has value" and "has no value" operators, you can input custom fields and system fields (of all types)
- For "more than", "less than" and "equal to" operators, you can input custom and system number fields
  - for "more than", "less than" - use "rawNumber" and numeric-type inputs
  - for "equal to" - use "rawValue" and text-type inputs
- In addition, for the "equal to" operator, you can input custom and system text type fields. For text fields "type" will be "rawValue".

📌 **Note:** since you can use text fields with the "equal to" operator, fields of type "list" also work (but "multipicklist" type fields don't, yet!)