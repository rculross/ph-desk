# Calculated Metric Library

🎥 Quick video overview

## Cost of Service

### What it does:

Shows which of your customers are the most expensive to manage from a support and CSM perspective:

### How it works:

The metric divides each customer's recurring revenue by the number of conversations they have with your team.

### The result

A number showing how much each customer pays for each interaction with your team. For example, a customer paying 100 with 10 interactions, pays 10 for each interaction, whereas a customer paying 100 with 5 interactions pays 20 for each interactions making them a more affordable customer for you.

```json
["DIVISION",
{"type": "metricOverTime", "days": 30, "op": "AVERAGE", "prop": "revenue.rrvalue"},
["SUM",
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.type1"},
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.type2"},
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "conversations.type3"}]
```

## Nominal Change of the Health Score over a certain period

**What it does:** Identifies the customers with the highest and lowest changes in the health score.

**How it works:** The metric subtracts the health score within a give period.

### The result

The positive or negative value between the latest health score and the health score some time in the past.

```json
["SUBTRACTION",
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "system.health"},
["SUBTRACTION",
{"type": "metricOverTime", "days": 7, "op": "SUM", "prop": "system.health"},
{"type": "metricOverTime", "days": 6, "op": "SUM", "prop": "system.health"}]]
```

## Growth Rate of Enduser Activity [%]

**What it does:** Identifies the customers at-risk, with a substantial decline in product usage.

**How it works:** The metric is based on the growth rate formula, dividing the difference between the present value and past value by the past value.

### The result

The growth or decline of the product usage between two periods of time. In this example, the metric displays at any point in time what is the percentage variation (positive or negative) of the product usage in the past 30 days compared to the same period prior to that.

```json
["MULTIPLICATION",
{"type": "rawNumber", "value": 100},
["DIVISION",
["SUBTRACTION",
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"},
["SUBTRACTION",
{"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.activity_count"},
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}]],
["SUBTRACTION",
{"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.activity_count"},
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}]]]
```

## Growth TREND of Enduser Activity [%]

**What it does:** Variation of the Growth Rate that achieves the same goal, identifying opportunities and risks within your customer base in terms of product usage.

**How it works:** The metric is simply dividing the activity count in the past 30 days by the 30 days prior to that.

### The result

The percentage of the product usage in the latest period with a period in the past. For example, if Exxon increased their general activity in your application by +13% in the past month this metric will return 113%. That is, the product usage in the past month is 113% of the month before. If there was a decrease in activity, say -18%, then this metric would return 82%.

This example can be adapted to specific enduser activities, e.g. report downloads.

```json
["MULTIPLICATION",
{"type": "rawNumber", "value": 100},
["DIVISION",
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"},
["SUBTRACTION",
{"type": "metricOverTime", "days": 60, "op": "SUM", "prop": "system.activity_count"},
{"type": "metricOverTime", "days": 30, "op": "SUM", "prop": "system.activity_count"}]]]
```

## Seat or License Utilisation [%]

**What it does:** Identifies upselling opportunities but also stagnant growth within your customer base.

**How it works:** The metric divides the number of seats in use by the contracted/purchased amount of seats.

### The result

A percentage of seats left to utilise before they need to increase their subscription with you. It can be combined with triggers to notify the CSM or to create a task automatically.

```json
["MULTIPLICATION",
{"type": "rawNumber", "value": 100},
["DIVISION",
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.active_seats"},
{"type": "metricOverTime", "days": 1, "op": "LAST", "prop": "metrics.max_seats"}]]
```