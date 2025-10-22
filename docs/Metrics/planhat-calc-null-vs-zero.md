# Calculated Metrics: NULL vs. Zero Values

Calculated Metrics take Custom Metrics and User Activities as inputs, run a set of calculations on them, and then return a certain output value.

In calculations, missing values (NULLs) can mean different things, depending on the input data type, and your calculation's objective. That's why you can choose, for each Calculated Metric you create, whether the calculation should either:

- be able to return NULL values as outputs

or

- return NULL outputs as 0

While this seems like a simple distinction, it has some considerable implications for your metrics and the way they'll behave across Planhat. Let's take a closer look...

## A quick primer on NULLs

NULLs in calculated metric operations come from two sources: custom metrics, and user activities. Here's what defines a NULL value in each case.

### Custom Metrics

If there is no value for a Custom Metric for a certain day, it takes a value of NULL, which means there is no value. At a [global level](https://help.planhat.com/en/articles/9587120-custom-metrics-null-vs-zero-values), you can also decide whether values of 0 for Custom Metrics should be classified as NULL, or as actual 0 values.

### User Activities

There is no such thing as a User Activity with no value (NULL), because activities are always pushed when there is a value. However, when a Calculated Metric takes a User Activity which has no values for a given day as an input, the activity will be classified as NULL.

## Setting Your Calculated Metrics to Output NULLs

To decide whether any given calculated metric should be able to return NULL outputs, you can simply use the toggle "Treat empty/missed values as NULLs". Here's how it behaves:

**OFF**

- the metric will never output NULL: if NULL should technically be the result (e.g., if all inputs were NULL), then the metric will return 0

**ON**

- the metric will output NULL where necessary: if NULL is meant to be the result, then the metric will return NULL, meaning it will have no impact anywhere in Planhat

## Some Examples

### All Timeperiod Inputs = NULL

The clearest case of when a NULL result is generated is when all inputs are NULL, for example, let's imagine the user activity "activities.logins" had the following values for a given end user in a given week:

- Monday = NULL
- Tuesday = NULL
- Wednesday = NULL
- Thursday = NULL
- Friday = NULL
- Saturday = NULL
- Sunday = NULL

Thus, with the toggle ON...

**Part Components**

```json
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"} = NULL
{"type": "metricOverTime", "days": 7, "op": "MAX", "prop": "activities.logins"} = NULL
{"type": "metricOverTime", "days": 7, "op": "MIN", "prop": "activities.logins"} = NULL
{"type": "metricOverTime", "days": 7, "op": "AVERAGE", "prop": "activities.logins"} = NULL
{"type": "metricOverTime", "days": 7, "op": "LAST", "prop": "activities.logins"} = NULL
{"type": "daysSince", "prop": "activities.logins"} = NULL
```

**Group Components**

Multiplying anything by NULL, returns NULL

```json
["MULTIPLICATION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}, {"type": "rawNumber", "value": 2}] = NULL
```

Dividing NULL by anything, or dividing anything by NULL, returns NULL

```json
["DIVISION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}, {"type": "rawNumber", "value": 2}] = NULL
["DIVISION", {"type": "rawNumber", "value": 2}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}] = NULL
```

Subtracting NULL from NULL, or subtracting anything from NULL, returns NULL

```json
["SUBTRACTION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}] = NULL
["SUBTRACTION", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}, {"type": "rawNumber", "value": 2}] = NULL
```

Taking any value to the power of NULL, or taking NULL to the power of any value, returns NULL

```json
["POWER", {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}, {"type": "rawNumber", "value": 2}] = NULL
["POWER", {"type": "rawNumber", "value": 2}, {"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "activities.logins"}] = NULL
```

In all these cases, with the toggle OFF, the calculated metric would return 0.

## NULLs in Subsequent Metrics & Widgets

In any of the examples above, if the toggle is OFF, a Health Score based on these Calculated Metrics will have a 0 input. The score could fall dramatically, with no valid data to back it up. Similarly, in the case of a widget, a time-series chart showing weekly sales would drop to 0, when again, we simply don't have any data points to tell us what the real figures are.

On the other hand, if the toggle is ON, the Calculated Metric would have no impact at all on the Health Score, and the time-series chart would show no data at all for the week in question: the line section or bar would simply not show.

📌 **Note:** regardless of whether the toggle is ON or OFF, time-series charts will show no line or bar in the case of NULL values or missing data (e.g., due to a delay in the daily sync): there will simply be no bar/line section at all.