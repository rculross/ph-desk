# How to choose between Automations and other Planhat features

## Summary

- If you want to move data between models, save a snapshot of data, or calculate data, you are typically choosing between Automations and Formula Fields. Formula Fields calculate regularly and lots of calculations are available, but cross-model formulas can only roll up to the Company model; Automations act in response to a trigger and can move data between any models
- The Planhat API can be used for syncing data into or out of Planhat. You can use webhooks in Automation steps to connect to your choice of URL
- You can easily configure your own personal notifications in Planhat; Automations enable custom messages and apply across your tenant
- Workflows are perfect for if you want a series of tasks or emails; Automations are great if you only want to create a single task or email

## Who is this article for?

Planhat Users who are building Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- How to choose between Automations and other Planhat features ⬅️ You are here

## Article contents

## Introduction

📌 **Important to note**

You should read our general [Automations Overview](https://help.planhat.com/en/articles/9587240-automation-overview) article before reading this one.

An "Automation" (with a capital A) is specific type of functionality in Planhat - one of the ways you can automatically act upon data. Automations follow the basic structure of "if/when x happens, do y" - although they can be more advanced (complex) than that implies. Your Planhat tenant includes a library of pre-built - yet customizable - [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations), and you have the ability to configure fully [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) if desired.

**Automation Templates in the Apps Library**

Click the image to view it enlarged

**An example of a Templated Automation**

**An example of a Custom Automation (with the trigger showing in the configuration panel on the left)**

Click the image to view it enlarged

Automations are not the only way that data can be acted on automatically in Planhat - there are many other features that automatically move data, transform data, notify people about data, and so on. For example, some other related functionality includes:

- [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview) - comprising Projects (designed for project management - tables of tasks) and Sequences (designed for automatically sending a series of emails to customers)
- [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview) - automatically perform data calculations
- [Health Scores](https://help.planhat.com/en/articles/10045917-configuring-health-scores-and-success-units-in-upgraded-planhat) - calculate the "health" of Companies based on rules you configure
- [NPS campaigns](https://help.planhat.com/en/articles/9587055-nps-module-overview) - automatically send your NPS surveys using Planhat
- [Notifications](https://help.planhat.com/en/articles/10131521-notifications) you configure in your User Profile
- The [Planhat API](https://docs.planhat.com/#introduction) - which you can use to send data to/from Planhat

... and more

The aim of this article is to provide some guidance to help you decide when to use Automations and when to use one of these other features. If you are still unsure which feature you should use in a particular use case, reach out to your CSM/TAM or our [Support team](https://help.planhat.com/en/articles/10184789-help#h_0f6d81d743).

🚀 **Tip**

One of the advantages of Automations is their extensive logs, in which you can see each run/execution, with details of their triggers and their steps - great for troubleshooting any issues. You can read more about Automation logs [here](https://help.planhat.com/en/articles/9587341-simple-automation-troubleshooting-with-execution-logs).

## Data changes

### Transforming/saving data

When it comes to automating data changes (e.g. let's say you want to populate a field with the date of the last QBR), you are generally choosing between Automations and [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview).

Some key differentiators between Automations and Formula Fields are:

- Formula Fields can roll data from other [models](https://help.planhat.com/en/articles/9587119-data-models) up to the Company model (e.g. display the value of Licences on the Company level), but this referencing is not possible in the opposite direction (down from Company to another model such as Licence). Automations, however, can post data from any model to any model, so they can take Company data and move it "down" the data hierarchy - e.g. see the example [here](https://help.planhat.com/en/articles/11100354-automations-worked-examples#h_eb273069e5)
- Only certain field types are supported by Formula Fields. Fields of the following types can't be Formula Fields: rating, day, list, multipicklist, team member, team members, URL, phone, email, End User, and End Users
- Each Formula Field is for one piece of data - one calculation displaying one result (per applicable record). For example, a Formula Field could be: display the License value for the most recent License that has the status "ongoing". In contrast, Automations can update multiple pieces of data at a time - e.g. they can update multiple fields on a record at once, and carry out multiple action steps, (e.g. see [this example](https://help.planhat.com/en/articles/11100354-automations-worked-examples#h_ba28b6c1c1)) as part of the same Automation run. For example, you could have an Automation: when a Company enters the "Success" Phase, update the following fields: "Owner", "Co-Owner" and "Success Date"
- Automations can be used to send a notification or public Slack message, whereas Formula Fields can't - but if you need to use a Formula Field to carry out a calculation, this could potentially feed into a Automation for a notification/message
- Formula Fields make it easy to run a wide range of advanced data calculations, whereas Automations are less designed for calculations. (It is possible to transform data using Automation [JavaScript "Execute Function" steps](https://help.planhat.com/en/articles/11170360-execute-function-steps-in-automations) - but these are relatively advanced rather than something to use as standard)
- Formula Fields keep being recalculated regularly. Automations only run when triggered. Typically Automation triggers are looking at specific data changes such as "when a Company changes [Phase](https://help.planhat.com/en/articles/9587109-lifecycle-phases) to Onboarding, run the Automation"; it is possible - although less common - to run an Automation on a specific schedule, or trigger an Automation manually

In some cases, an Automation OR a Formula Field could be used - for example, if you want a Company custom field called "Date of last ticket" to display the date of the most recent Conversation of type "ticket":

**Automation (shown below)**

Click the images to view them enlarged

**Formula Field (shown below)**

Click the image to view it enlarged

**Formula Fields are best suited to ...** (noting that all the examples below could also be achieved using Automations)

Transforming data on a single model, particularly involving any mathematical operations applying to numeric or date fields, or logical operations involving IF. For example:

- Calculating the difference in days between two dates on the same model. E.g.:

```
DAYS_DIFF(@today, <<lastActive>>)
```

- Applying an IF statement to populate a field based on the value of other fields, such as displaying a specific Company tier based on the ARR value:

```
IF(<<arr>> > 10000 && <<arr>> < 30000, Mid Market, IF(<<arr>> > 29999, Enterprise,SMB))
```

Bringing data from other models up to the Company level, for example:

- Displaying the sum of all License records on the associated Company record:

```
SUM(License.value)
```

- Counting the number of records of a model (e.g. the number of End Users) linked to a Company. For example, displaying the total count of Issues associated with a Company:

```
COUNT(Issue)
```

📚 **Further reading**

For additional Formula Field examples, check out our separate article [here](https://help.planhat.com/en/articles/9586965-formula-field-examples).

**Automations are great for ...**

Bulk data moving or transformation operations, such as:

- Updating a series of fields when a record enter a given filter, such as updating the Owner, Status and Priority etc. when a Company enters the "Onboarding" filter
- Copying a snapshot of field values, e.g. on a Company to custom fields on a Churn record at the point the Company churns
- Creating dynamic URLs - for example, creating a link to a Planhat Company to be synced to an external application such as Salesforce or HubSpot (not possible with Formula Fields)

Types of sophisticated data transformations, such as:

- Mapping parent-child Company associations from external applications, such as mirroring the group structure in HubSpot
- Adding individual products from Licenses as an array in a multipicklist field on the Company

📚 **Further reading**

For additional Automation examples, you can read our separate article [here](https://help.planhat.com/en/articles/11100354-automations-worked-examples) - and remember to check out the library of [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations).

### Moving data to/from Planhat

So far we have talked about Automations v. Formula Fields, but when it comes to sending data to or from Planhat, the [Planhat API](https://docs.planhat.com/#introduction) is important functionality to be aware of.

However, with Automation webhook steps, you can push data to and delete data from any webhook URL, based on any condition:

- POST (create) data to the URL
- PUT (update) the entire data on the URL
- PATCH (update) targeted pieces of data on the URL
- DELETE (erase) data on the URL

🚀 **Tip**

Using Automations, you can send data to Planhat's API endpoints, which (for example) allows you to create time-series Custom Metrics from static CRM values. Speak to your Technical Account Manager (TAM) or Customer Success Manager (CSM) if you're interested in this approach.

## Automating processes and communication - tasks, notifications and emails etc.

When you want to automate processes in Planhat, there are multiple alternatives to using Automations, each designed for different, targeted use cases.

Here's a summary of how they differ:

- **Automations**: can be used to generate tasks and/or notifications, and for sending single emails / chat messages to customers. Generally these are individual actions, based on a single trigger (e.g. when an End User enters a filter, send an email, or create a task) - in contrast to Workflows (next bullet point)
- **[Workflows (Projects and Sequences)](https://help.planhat.com/en/articles/9587102-workflows-overview)**: a series of tasks and/or emails - generally you have lots of different tasks and emails, and they can be activated at different points based on different conditions, and the whole process can be ended early if an outcome is met (e.g. a Sequence sends a series of emails to encourage a new End User to set up an account in your product and carry out some initial onboarding steps, and the Sequence ends once they have completed the desired actions)
- **[NPS surveys](https://help.planhat.com/en/articles/9587055-nps-module-overview)**: NPS is Net Promoter Score - these are campaigns designed to request/receive feedback from your customers
- **[Personal notifications](https://help.planhat.com/en/articles/10131521-notifications)**: configured via your User Profile, these are very similar to the Automation Templates in the App Center, but are less customizable and are specific to your User

Let's take a look at some specific use case examples.

### Scheduling tasks

**Project [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview)**: optimal if you're looking to schedule a series of tasks when a certain initial condition is met. Different tasks happen over time, with advanced [scheduling options](https://help.planhat.com/en/articles/9587112-scheduling-your-workflows) available, and steps can even be enabled/disabled based on [conditions](https://help.planhat.com/en/articles/9587040-workflow-conditions). These tasks can either be for your internal team or to share with your customer via their [Portal](https://help.planhat.com/en/articles/9587324-customer-portals-overview). For example:

120 days before renewal, for Enterprise Companies:

- Review the Company and key adoption metrics
- End Users at the Company to complete a structured list of needs in the Portal
- Schedule a 90-day alignment meeting to discuss upcoming objectives
- Prepare a [Dashboard](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages) to present operational metrics and goals achieved
- Confirm new terms with "Decision Maker" End Users at the Company
- Sign the renewal and upload the contract
- Move the Company to the Success [Phase](https://help.planhat.com/en/articles/9587109-lifecycle-phases)
- Exit the Workflow once the Company is in the Success Phase

**Automations**: best if you want one or a small number of internally-facing tasks to happen at once in response to a certain event or change in state. For example:

- 120 days before renewal, for Enterprise Companies: create a task to review the Company details and schedule an alignment meeting

### Contacting customers

This has some similar considerations to those you've just seen for scheduling tasks.

**Sequence [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview)**: Sequences are designed for sending End Users a series of multiple emails working towards a goal, and you can use various advanced [scheduling methods](https://help.planhat.com/en/articles/9587112-scheduling-your-workflows), enabling different emails to be sent or cancelled in reaction to changing End User behaviour while the Sequence is running. For example:

For End Users at Companies in the Adoption [Phase](https://help.planhat.com/en/articles/9587109-lifecycle-phases) who haven't logged in in the past 7 days:

- Send an email reminder to log in, referencing a useful feature of your product
- Send a follow-up email 2 days later to End Users who still haven't logged in
- Repeat step 2
- Exit the Workflow automatically once End Users have logged in

**Automations**: in the Apps Library, you'll find a selection of [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations) in the "Contact Customers" category. Here you can send either an email campaign or a chat (Intercom) campaign in response to a trigger. Note that "campaign" in this sense refers to sending a single email or chat message to each relevant End User, rather than a series of emails as you would have in a Sequence Workflow. For example:

- Send a welcome email to any new End User
- Send End Users labelled "Decision Makers" a reminder email 90 days before their renewal

**NPS surveys**: this is a specific type of customer communication, where you are asking for a particular kind of feedback (NPS survey responses), rather than informing your customers about something or aiming to get them to accomplish a particular action in your application

### Sending notifications

In upgraded Planhat (ws.planhat.com), you can configure your [notifications](https://help.planhat.com/en/articles/10131521-notifications) in the "Notifications" tab of your User Profile, accessed by clicking on your name in the top right of your Planhat tenant (shown in the screenshot below). Here you can choose whether you'd like to receive your own notifications via desktop, email or Slack, in addition to within the ["Notifications" Home feature](https://help.planhat.com/en/articles/10131521-notifications).

Click the image to view it enlarged

If you click "+ Add notification" (shown in the screenshot above), this opens up the "Notifications Library" (shown below), which is similar to the Apps Library and its Automation Templates. These contain a wide range of standard/simple notifications that you can easily set up for yourself - simply choose which ones you would like to activate.

Click the image to view it enlarged

The notifications in the Notifications Library are pre-configured to an extent, although some of them do have dropdowns to enable you to customize them - for example:

When it comes to the App Center's Apps Library, there are also a wide variety of [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations) for notifications - check out the (overlapping) categories of "Stay Alert" and "Send A Notification":

Click the image to view it enlarged

A difference between these [Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations) compared to the standard personal notifications are that these have more flexibility for additional customization (example screenshots below - you can see you can customize the message, for instance), and also they are set for the whole tenant (i.e. different Users can be notified, and you can post to a public Slack channel) rather than being your own personal notification preferences. Automations also enable you to connect to external applications via a webhook.

In addition to Templated Automations, you can of course also configure [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) if you need something even more customized - example below.

Click the image to view it enlarged