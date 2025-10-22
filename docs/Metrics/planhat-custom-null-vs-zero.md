# Custom Metrics: NULL vs. Zero Values

Zero values pushed in via custom metrics could be counted either as "null"/missed values or actual zero value. You can decide which is the right one for your use cases, and a Planhat "Super Admin" (staff member) can help you edit it.

Click the image to view it enlarged

📌**Important to note:** "Admin Settings" will not be visible for you, even if you have administrator access. If you would like to enable or disable the setting highlighted in the image above then please reach out to your CSM.

## What the setting does:

- **"Yes"**: days with "0" value will now count as a "0"
- **"No"**: days with "0" values will count as null

## Practical examples:

Let's assume we have 3 different custom metrics being pushed in to Planhat, found in the table below.

| | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 |
|---------|-------|-------|-------|-------|-------|
| Log-ins | 7 | 5 | 9 | 0 | 4 |
| Temp (C°) | 22 | 15 | 15 | 0 | 17 |
| NPS | 5 | 3 | 7 | 0 | 5 |

The question, which the setting is for, is how to look at Day 4's data.

- **Log-ins:** most likely 0 log-ins on Day 4 > setting should be "Yes"
- **Temperature:** most likely missing data on Day 4 > setting should be "No"
- **NPS:** most likely missing data on Day 4 > setting should be "No"

In other words: when you push in data where 0 means 0, the setting should be "on". The most common use cases for this is when pushing in usage activities, since it's a "counter"-type metric where 0 is the starting point. In the Temperature and NPS case, there is no "starting point" at 0, which means 0 likely means "no value":

Note that days with no values will always be counted as null.

## The implications:

Whether the setting is Yes/No mostly impacts subsequent calculated metrics, e.g., when using the "LAST" operator or do averages over time. Using the "Log-ins" example above:

If I use the "LAST" operator on Day 4, then:

- If "Yes", then Day 4 = 0 and so the last value is 0
- If "No", then Day 4 = null and so the last value is Day 3 = 9 > Day 4 = 9

If I use the "Average" operator on Day 1-5, then:

- If "Yes", then Day 4 has a value and is included in the average calculation, which produces an average of 5 (25/5)
- If "No", then Day 5 does not have a value and is not included in the average calculation, which produces an average of 6.25 (25/4)

**Note:** this is a global setting for all custom metrics. If you have multiple metrics that have different logics (like the three above), then you can:

- Transform the data you push in (e.g., turning the Day 4 value for log-ins from 0 to null before pushing it into Planhat)
- Prioritize value of accuracy between the metrics, and set logic accordingly