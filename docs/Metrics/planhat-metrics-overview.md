# Metrics Overview

This articles is part of a series on Metrics. Here's a summary of some other helpful articles to help you get started...

Or, if you're looking to unlock some more advanced use cases, you can check out a deeper dive into the Calculated Metrics concept [here](https://help.planhat.com/en/articles/9581429-calculated-metrics-overview-concept) and a technical introduction [here](http://support.planhat.com/en/articles/5720062-calculated-metrics-technical-introduction). You can also check out the [Metrics folder](https://help.planhat.com/en/collections/11434933-metrics) and pick for yourself.

There's a lot of depth to Planhat's time-series data capabilities, and there's no need to get stuck into it all at once. This is a good place to start...

## Article contents

## What are Metrics?

Time-series data is integral to Customer Success, as it is the best way to understand the development of your customer relationship over time. It allows you to ask important questions like: "What's the trending usage of Module A vs Module B in our Enterprise customers?" or "What's the pattern in Ticket requests from Customer A?".

There are several types of time-series data in Planhat and they can be saved to different data models, but in summary they are:

- **System Metrics**: default metrics Planhat creates out of the box
- **User Activities**: the actions of your End Users in your product
- **Custom Metrics**: product data associated with everything else
- **Conversations**: events generated each time you interact with a customer
- **Revenue**: key revenue data evolving over time
- **Tasks**: events generated each time you schedule or complete a task

All time-series data can be transformed into **Calculated Metrics**. These let you create totally custom views of your raw data, grouping it over time, combining different metrics together and performing wide range of other operations.

For example:

- Calculating the trending usage of a specific feature as a rolling 30 day average
- Summing the total number of interactions with a customer over time
- Combining different usage metrics to create a stickiness score of key features
- Calculating %s towards usage goals and thresholds

## How to Manage Your Metrics

The more time series data you bring into Planhat, the more important it becomes to organise it, which makes it easy to ensure that the metrics you're tracking are being utilised, and identify new opportunities to transform your raw data to action.

That's why Metrics are just like any other model: you can enrich them with custom fields create filters for them (in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data)), and visualize and interact with their data in [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) and [Pages](https://help.planhat.com/en/articles/10102923-page-types-in-upgraded-planhat).

Here's the Metrics section within the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data):

Click the image to view it enlarged

In Data Explorer, you'll find "Metric" both listed as a data model - in this menu is where you can add a new metric ...

Click the image to view it enlarged

... and also for models that can have associated Metrics (Company, End User, Project and Asset), you'll see Metric data in the "Time-series" tab:

Click the image to view it enlarged

## Metric Details

When in the [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) with "Metric" selected, you can click on the name of any Metric to open up its [Preview](https://help.planhat.com/en/articles/10191842-previews) (slide-out), including details such as the raw data or formula (depending on the type of Metric) - click through the different tabs.

Click the images to view them enlarged

### Chart

In the "Overview" tab of each Metric Preview, you'll find a chart. This is a summary view of the time-series data, which can be adjusted to show any period between a week and 3 years, and aggregate across Companies as a sum, average (of all Companies), average (of Companies with values), maximum or minimum.

You can use the filter in the top left to view the data for a specific Company.

For Custom Metrics and User Activities, the chart is directly reflecting the raw time series data logged for that given metric. For Calculated and System Metrics, it reflects the final processed time series, and will not show any values while the Metric is building.

### Aggregation Mode

Custom Metrics in Planhat are stored daily, with 1 data point per model (Company, End User, Asset, Project) each day. This means that if you push multiple data points to a specific model in a given day, Planhat needs to aggregate them into 1. This is why for Custom Metrics, you can choose whether Planhat should obtain a daily value via:

- SUM
- MIN
- MAX
- AVG
- LAST

### Formula (Calculated Metrics only)

This tab is where you set the formula your Calculated Metric should use to generate daily values. Here, you'll find a helpful set-up guide, and a magic example-generator, to get you started.

When you configure each Calculated Metric, you can also add conditions on what type of records the metric should apply to, and decide whether the metric should treat missed values as NULLs or 0's (more about that [here](https://support.planhat.com/en/articles/6930365-handling-nulls-in-calculated-metrics)).

### Metric availability in app (Calculated Metrics only)

Availability in Planhat setting allows you to specify in which cases will the Calculated Metric be available for use in app. Over time you will have lots of data in Planhat, This setting ensures Metrics are only available where you need them, helping keep Planhat simple and easy to use.

In a calculated metric Preview, you can see at the top what is the availability type for the metric.

When creating new calculated metric you can specify "Availability in Planhat" right away in the calculated metric creation form.

This setting has 3 options that you can choose from:

**Reporting & Data models (Featured)**

When this option is selected, the calculated metric will be displayed on Overview and Usage tabs on profiles of the Company and End User or on the Asset or Project Previews, as well as available in data tables, filters, automations, health factors, workflow conditions, widgets and formula fields.

**Reporting & Data models**

When this option is selected calculated metric will available in data tables, filters, automations, health factors, workflow conditions, widgets and formula fields, but won't be displayed in profile pages

**Reporting only**

When this option is selected calculated metric will be available only as input for other calculated metrics and widgets on pages.

Choosing the right option depends on what you intend to do with the calculated metric. If metric value is needed to roll up to higher level KPI and you don't expect to actually use it in your Planhat workflow then Reporting only is the right option for you.

Keeping only most important metrics with options Reporting & Data models (Featured) and Reporting & Data models will make creating filters, managing data table views easier for you as it will declutter the interface.

### Raw Data (Custom Metrics & User Activities only)

The Raw Data tab shows you the raw time-series data points for each record, in reverse chronological order, in addition to the relevant Company and End User, the timestamp of the ingested event, and the time it was ingested at.

## How We Calculate Your Metrics

Calculated Metric formulas refer to Custom Metrics and User Activities, meaning that these values must be logged before relevant Calculated Metrics are built to ensure accurate results.

Additionally, Calculated Metrics can refer to other Calculated Metrics, resulting in both nesting of metric calculations, and cross-model references between Company and End User/Asset/Project Calculated Metrics. This means the order in which Calculated Metrics are built also matters.

Fortunately, Planhat has a host of smart logic to ensure everything gets built in the right order, and on schedule. Here's a quick overview...

### Raw Data

Raw data is brought into Planhat in the form of Custom Metrics and User Activities. Generally, you can expect these to be ingested within a few minutes, although the ingestion process can take longer if there is a large volume of raw data points.

### Daily Build

Calculated Metrics are built automatically, once a day (nightly CET). The specific time window will vary depending on your specific tenant settings, and you can speak to your TAM or CSM if for any reason you would like your daily build to occur no earlier than a specific daily hour, to ensure that all your Custom Metrics and User Activities are received in time. Here's some important things to keep in mind:

- Calculated Metrics will automatically build changes made to underlying metrics in the **Metric Build Period** you have specified
  - the default Metric Build Period is 30 days: this means that if any of the metric's input values have changed in the last 30 days, the metric will rebuild, during the next Daily Build, to account for the change
  - however, if any input values change outside the build window, the metric will not rebuild the affected days
- If for any reason a Daily Build fails, it will be reattempted with the next Daily Build
- When you update any Calculated Metric's Formula, it, and all metrics referring to this Calculated Metric, will be rebuilt automatically
  - this means that you only ever need to manually rebuild a Calculated Metric directly referring to Custom Metrics or User Activities: all other Calculated Metrics referring to the rebuilt Calculated Metric will automatically be rebuilt

💡**Quick Tip**: you can change the default Metric Build Period to any value between 1 day and your tenant's Data Access Period (which by default is 730 days: 2 years). This default value will apply to all Metrics which do not have a value for the Metric Build Period, meaning that you can override the default Build Period by inputting any value for a specific metric.

### Dependent Metrics

Since Calculated Metrics can reference one another, it's important to keep track of which Metrics depend on which other Metrics.

In the "Trace" tab of a Metric Preview, you can see where that Metric is used across your tenant. In the screenshot below, the Calculated Metric in question is used in another Calculated Metric as well as multiple Pages.

## Importing & Exporting Metrics

### Excel & API

There is no difference importing & exporting Metric data using "Export to Excel" or API: you can...

- Import up to 100,000 rows/datapoints at a time
- Export up to 100,000 rows/datapoints at a time

When exporting via API, there is a default of 200, which can be overridden by manually updating the limit (up to a feasible value of 100000).

### Raw Values Export

There is no limit on the number of rows/datapoints you can export at a time using our Raw Values export, however there is a limit on the period: you can export a maximum of 1 month of data.