# Replacement codes (dynamic references) in Automations

## Summary

- Replacement codes are dynamic references that are used throughout Custom Automations, and in messages in Templated Automations
- Examples of replacement codes are `<<object.name>>`, `<<Step 2.firstName>>` and `<<time.now>>`
- Because these replacement codes are dynamic, they can be filled in with different data in different Automation runs - e.g. `<<time.today>>` could be June 6th 2025 in one Automation run, and 11th November 2025 in another Automation run
- Replacement codes can refer to data in the trigger, data in steps, the current date, the person who triggered the Automation, and so on

## Who is this article for?

Planhat Users who are building Custom Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- Replacement codes (dynamic references) in Automations ⬅️ You are here

## Article contents

**This is a technical deep-dive article**

Read on if you'd like to learn about the dynamic replacement codes you can use when configuring Automations. Please ensure you read our articles on [Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations) and [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) before this one, so you are familiar with the context of where these codes are used.

If you would simply like a general introduction to Automations, check out our overview article [here](https://help.planhat.com/en/articles/9587240-automation-overview).

## What are replacement codes?

Planhat Automations are a fantastic way for you to automate actions in Planhat, with the general process of "when x happens, do y" - although they can be a lot more advanced than that (e.g. with branching) if you like.

[Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations) have a simple "sentence structure" UI and are pre-configured (yet customizable) to speed up your set-up process, and [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) have a sleek and intuitive flowchart UI with dropdown menus etc., but in some circumstances you will need to use special replacement codes.

These codes have `<<` `>>` at either side of them, and you need to be precise with spelling, capitalization and spaces within the codes.

Here are a couple of examples of replacement codes in messages within [Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations):

And here are some replacement codes in [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations):

## Why use replacement codes?

Replacement codes enable dynamic references - that means the exact data they refer to will vary between Automation runs. To give a practical example, using these dynamic replacement codes means you can configure an Automation so that it can generate the message:

"Betty, Tanisha Foreman from Apple has given an NPS rating of 5"

in one run, and

"Ravi, Lesley Fisher from GSK has given an NPS rating of 10"

the next time it runs.

Replacement codes are particularly relevant for [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations), as you will need to use them in steps throughout the Automation, but they are also used in custom messages in [Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations).

📚 **Further reading**

To see lots of examples of replacement codes in action, check out our separate article on Automation worked examples, which will be available soon.

## Common replacement codes - explanations and examples

Let's take a look at some of the most common code elements. We'll explain what these code references mean, and with your new understanding you'll be able to easily identify the codes you need for your Automations.

### "object"

You'll often see "`object`" references within these dynamic replacement codes. You can see some examples in the screenshots above:

- `<<object.name>>`
- `<<object.phase>>`
- `<<object.companyName>>`
- `<<object._id>>`
- `<<object.companyId>>`
- ... and so on.

So what is this referring to?

Firstly, a quick terminology lesson:

- **Model** - Planhat [data models](https://help.planhat.com/en/articles/9587119-data-models) are Company, End User, License, Opportunity, and so on. You can think of them as like containers for data
- **Record** - data within those models - e.g. if Company is the model, then BMW, Microsoft and Nike can be records; and if End User is the model, then Katie Chambers, Jason Bendefy and Sally Peters can be records

In these Automation example codes, "`object`" is referring to the record in the trigger of the Automation.

So, for example, if the trigger of the Automation is "when Company Phase is Onboarding", and your Company "GSK" gets moved into Onboarding and triggers the Automation, then "`object`" in the code refers to the Company "GSK".

The next part of the code (after "`object.`") refers to a property (most commonly a field) on that model/record. So if we take the example of `<<object.name>>`, this will look at the "name" system (default/standard) field on the Company model, and specifically that field value of that record - so in this case, the field value will be "GSK".

If we take a different example, where the trigger is "when End User is tagged as Champion", if you use the replacement code `<<object.companyId>>`, it will look at the End User that triggered the Automation (e.g. Alessandro Termine), and specifically at the "`companyId`" property on that record, which is how you can identify which Company that End User is associated with (e.g. Novus Biologicals).

### Property names

We introduced property references in the section above, when we spoke about "object" codes, but let's really dive deep into that topic now.

The examples above were all using system (i.e. default/standard) fields on the model in the trigger. There are a number of places where you can check field names:

- In the ["Data" Global Tool (i.e. "Data Model" Global Tool)](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data), ensure you have your desired model selected in the column on the left, and then in the "Fields" tab, you can view field names. For system fields, look at the gray text underneath the label name - this API name is what you should use in the Automation replacement codes
- You can see properties listed in the "event details" in the logs - for more about this, see [here](https://help.planhat.com/en/articles/9587341-simple-automation-troubleshooting-with-execution-logs)
- You can find system fields listed for each model in the [Planhat API documentation](https://docs.planhat.com/#planhat_models)

When it comes to custom fields (as opposed to system fields):

- There isn't a separate API name and label name - the label (UI) name is the name you should use in the Automation replacement code
- You need to write "`custom.`" in front of the name of the field within the replacement code. So this means you could end up with a replacement code such as `<<Step 1.custom.Company Scheduling Contact>>`

Similarly, you will need to use another prefix (in place of "`custom.`") if you refer to a different time of property:

- `usage.` - if the property is a [Calculated Metric](https://help.planhat.com/en/articles/9587317-metrics-calculated-metrics)
  - E.g. `<<object.usage.62c6503049d2ba734284d12b>>`
  - See screenshot below
- `sunits.` - if the property is a [Success Unit](https://help.planhat.com/en/articles/9587132-success-units)
  - E.g. `<<object.sunits.62cddefc1831523d6e7cfcac>>`
  - See screenshot below
- `lastTouchByType.` - if the property is a "last touch" date relating to different [Conversation Type](https://help.planhat.com/en/articles/9587095-conversation-types)
  - E.g. `<<object.lastTouchByType.Training>>`

In upgraded Planhat (ws.planhat.com), you manage Calculated Metrics in the [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) - just ensure you have "Metrics" selected in the model dropdown. Then, click into your choice of Calculated Metric to open up its details including its ID:

Click the image to view it enlarged

In upgraded Planhat (ws.planhat.com), you [access Success Units in the "Data" ("Data Model") Global Tool](https://help.planhat.com/en/articles/10045917-configuring-health-scores-and-success-units-in-upgraded-planhat#h_60e96c4419). Once you've opened up the Success Unit model, you can find the ID for each Success Unit - which you would reference in a replacement code - on the left-hand side like so:

Click the image to view it enlarged

### Step references

When you have a multi-step Automation, you'll often want to refer back to data in a previous step. For example, this can be found in ["Get" steps](https://help.planhat.com/en/articles/11162604-get-steps-in-automations), where you can have setups such as:

- Trigger: End User is updated with specific properties
- Step 1 - Get step that retrieves the Company that the End User belongs to
- Step 2 - Get step that retrieves the User that's referenced as the Owner of the Company in Step 1
- Step 3 - Slack message using the data retrieved in the previous two steps

To refer to data from previous steps, you state the names of those steps - so instead of using "`object`" to refer to the trigger, instead you can use "`Step 1`" to refer to Step 1, and so on. For example, you could have replacement codes such as `<<Step 1.coOwner>>` or `<<Step 2.firstName>>`, etc.

A couple of key points to note when constructing these codes:

- For the second part of the code, it's exactly as we described above in the ["property names"](#property-names) section - you use the API name for system fields, add `.custom` for custom fields, and so on - so it's the same as you've seen for replacement codes starting with `object`
- It's vital to reference the step name exactly as it's shown in your Automation. While in an earlier version of Planhat, steps were automatically named Step 1, Step 2 and so on, now that you can have [branches](https://help.planhat.com/en/articles/10939918-branching-and-wait-in-custom-automations) in your Automations, steps are assigned a name such as "`s-uSi`" in the example below (highlighted below in the top left of the configuration panel, and in the step of the flow chart)

Click the image to view it enlarged

For each Automation step, either you can keep the randomly generated step name and refer to that in your replacement codes, or you can rename it to whatever you like (such as "`Step 1`") and then use that in your replacement code.

Like with other codes (when referring to field names, for example), you need to refer to the step name exactly - so if you rename your step to `Step 1` (with a space), then you should include the space in the replacement code, whereas if you rename it to `Step1` (with no space), then you should call it `Step1` (with no space) in the replacement code.

### Time references

All the references we have discussed so far correspond to data on models/records, but there are also replacement codes that refer to time:

- `<<time.now>>`
- `<<time.today>>`
- `<<time.next working day>>`
- `<<time.tomorrow>>`
- `<<time.yesterday>>`
- `<<time.next Monday>>`
- `<<time.in a week>>`
- `<<time.in a month>>`
- `<<time.next month>>`

These time replacement codes are useful to add date data to a record via an Automation. As they are dynamic, they can apply different dates to different records as appropriate (e.g. if you select `<<time.now>>`, this could be May 5th in one Automation run, and August 23rd on another Automation run).

The main use cases for these time replacement codes are:

- Date stamping when an event occurs - e.g. when Company [Phase](https://help.planhat.com/en/articles/9587109-lifecycle-phases) changes to "Success", save today's date in a custom field
- Setting due dates for tasks - e.g. when x happens, create a task with a start date of tomorrow

Most of these time replacement codes are self explanatory, but what's the difference between `<<time.now>>` and `<<time.today>>`?

- `<<time.now>>` saves today's date and current time. (Whether the time is displayed in the field or not depends on whether it's a "date" field or a "date time" field, as discussed [here](https://help.planhat.com/en/articles/9587266-date-and-time-in-planhat))
- `<<time.today>>` is a really similar replacement code, which also stamps today's date. However, the time saved will be 00:00:00 UTC. Often, this won't make any difference, but if you have teammates in different time zones, the time conversions may affect the dates shown in the UI

🚀 **Tip**

When you select a date or date-time field when building a Custom Automation, such as "Onboarding Start Date" in the example screenshot below, the default for the cell on the right is a date picker, where you would pick a specific date.

In order to type in a dynamic replacement code instead, click on the symbol of two arrows in a circle (shown below) to switch to text. You can then start typing `<<` to see the replacement codes as usual.

### "actor"

In place of "`object`", "[step name]" or "`time`", another option for the first part of a replacement code is "`actor`". You can choose from the following replacement codes:

- `<<actor._id>>`
- `<<actor.type>>`
- `<<actor.name>>`

What is this referring to? The "`actor`" is the User or service that triggered the Automation.

To give you a practical example of "`actor`", when you create a [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_4c19106820) record (part of Service Delivery functionality), you will typically do this via a "create form" such as this:

At the bottom of the screenshot above, you can see a field called "Submitted By". You can use an Automation to automatically populate this field, so that when a Time Entry record is created, the Planhat User who created it is saved in the "Submitted By" field. You specify the User who created the Time Entry by using the replacement code `<<actor._id>>`.

Click the images below to view them enlarged

🚀 **Tip**

When you select a User field such as "Submitted By" on the left, the default for the cell on the right is a Planhat User (team member) picker, as shown below:

In order to type in a dynamic replacement code instead, click on the symbol of two arrows in a circle (shown below) to switch to text. You can then start typing `<<` to see the replacement codes as usual.

## Additional replacement codes

While we have talked through the most common Automation replacement codes in the article section above, there are a few more possible replacement codes to be aware of:

| Replacement code | Description | Examples |
|------------------|-------------|----------|
| `<<automation.*>>` | Properties of the Automation | `<<automation.id>>`<br>`<<automation.title>>`<br>`<<automation.createdBy>>` |
| `<<oldDoc.*>>` | Previous state of trigger record | `<<oldDoc.name>>`<br>`<<oldDoc.dueDate>>`<br>`<<oldDoc.custom.fieldName>>`<br>`<<oldDoc.sunits.metricId>>`<br>`<<oldDoc.usage.metricId>>`<br>`<<oldDoc.lastTouchByType.touchName>>` |
| `<<update.*>>` | Updated fields of the trigger record | `<<update.name>>`<br>`<<update.dueDate>>`<br>`<<update.custom.fieldName>>` |