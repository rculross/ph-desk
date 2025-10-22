# Calculated metrics: Overview & Concept

## Calculated metrics content library - what are you looking for? 📚

[A deep-dive technical introduction](https://help.planhat.com/en/articles/9590739-calculated-metrics-technical-introduction)(helpful if you're looking to understand the broader data structure of Planhat, and its implications for calculated metrics)

[Use cases and examples](https://help.planhat.com/en/articles/9587189-metrics-calculated-metrics-use-cases)(and some more[Examples](https://help.planhat.com/en/articles/9587041-calculated-metrics-examples))

Quite specific - [the SIGN function](https://help.planhat.com/en/articles/9587350-calculated-metrics-the-sign-function)

## Calculated Metrics

One thing we hear often from our customers is that the Success Team needs a list of customers (just as an example) "in the enterprise segment that on average have not used module X for more than Y days"

To get this information, the dev/tech team typically would run some database query and pull this list for the CS-team. This works great for most companies but then the next week you want some other list and since your developers have a lot of other things to do, these questions from the CS team become a problem.

In Planhat, we've solved this scaling challenge for Customer Success teams by building "Calculated Metrics".

Calculated metrics let you convert and combine a few raw metrics into new more complex metrics - as an example, instead of asking your tech team to send you:

- "average number of logins per week",
- "average number of logins per month",
- "total number of logins past 14 days",
- and so on..

Simply have your tech team send "number of logins per day" to Planhat, and then you can do the rest yourself in Planhat;

You can look at the average, min, max, sum, trend etc.. only based on that single raw metrics you send in.

Add a few more raw metrics and possibilities become endless.

The true power comes from combining the different data sources. This is perhaps best explained by an example:

Say one of your customers is on a subscription plan including 10 seats.

You add this Company model in Planhat (Soft Metric).

Then you send in an automatic daily metric "total users" as defined in your own system, to track how many seats (user accounts) they really have.

Now you can create a Calculated metric in Planhat where you compare, for each customer, the agreed number of users with the actual!

Some of your customer may be using only 10% or 50% of the seats they bought - which would be signal you may see a downgrade later, while others may be at more than 100% which would be a clear upgrade opportunity.

Now use this new calculated metric in your Planhat health score, or perhaps set an alert to notify you whenever a customer climbs above 100% utilization!

And obviously, you're not limited to only comparing two metrics.

If you're into it, you could set up deeply nested formulas combining any number of other metrics to truly get a clear picture of the value your customers are getting out of your product.