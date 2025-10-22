# Calculated Metrics: the SIGN Function

## Calculated metrics content library - what are you looking for? 📚

An [introduction](https://help.planhat.com/en/articles/9587317-metrics-calculated-metrics)(helpful if you're looking to understand the broader data structure of Planhat, and its implications for calculated metrics)

[Use cases and examples](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases)(and some more[Examples](https://help.planhat.com/en/articles/9587041-calculated-metrics-examples))

How to work with [calculated metrics inside calculated metrics](https://help.planhat.com/en/articles/9587057-calculated-metrics-inside-calculated-metrics)

Specific "Group Components":

A powerful yet under-appreciated feature of Planhat is the SIGN function. It could also be a bit tricky to put into action, so let's break it down.

## What is it?

The SIGN function takes a number value as input and returns:

- 1 for all positive values
- -1 for all negative values
- 0 for zero/0

There is only one argument as input: a number value (which, of course, could be the output of another nested function).

## What can you use it for?

The SIGN function is often used for categorisation and/or for lifting up data to a higher level of abstraction. For example, instead of seeing "how many activities each user performed" you want to see "how many users made an activity per day". Here, the SIGN can play a role similar to the COUNT function (but which isn't available in calculated metrics). You turn a number that could be anything into three simple categories.

If that sounds overly theoretical, let's break down the concrete use cases. Broadly, there are two types of use cases.

___

### 1. Simple use cases: use SIGN similarly to COUNT

Categorising if a company has had any log-ins in the past 14 days (yes = 1, no = 0)

```json
["SIGN", ["SUM", {"type": "metricOverTime", "days": 14, "op": "SUM", "prop": "activities.loggedin"}]]
```

Share of used features where there are two features each represented by one event

```json
["DIVISION", ["SUM", ["SIGN", ["SUM", {"type": "metricOverTime", "days": 91, "op": "SUM", "prop": "activities.added a reminder"}]], ["SIGN", ["SUM", {"type": "metricOverTime", "days": 91, "op": "SUM", "prop": "activities.added a note"}]] ], {"type": "rawNumber", "value": 2}]
```

___

### 2. Advanced use cases: use SIGN to categorise in nested calculated metrics

Here, we recommend you to deeply assess the use case, why and how it adds value, and then involve our Planhat colleagues to help you set it up correctly. It gets tricky pretty quickly here - but hugely powerful.

An example use case to illustrate the potential: one Planhat customer wanted to use multiple custom time series metrics to categorise customers based on multiple conditions. By looking at custom activity metrics, they wanted to say:

Category 1: if user activity A > 0 OR MAX(user activity B) > 1000

This was solved using a combination of SIGN and other operators.