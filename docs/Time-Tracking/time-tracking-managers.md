# Time tracking for Managers

## Summary

- If you're managing a Team who's tracking their time (e.g. Professional Services), Planhat's Service Delivery functionality makes it easy for you to review your Team's work and capacity
- Your Team Members produce Timesheets, which you can review and approve
- The Utilization Table makes it easy for you to view the utilization of individual Team Members, as well as comparing Teams. Plus, you can use a range of other Page Templates or custom Pages to visualize and analyze your Team's performance

## Who is this article for?

Managers who work in Service Delivery

**Note:** This article is about Service Delivery functionality. If you don't have access to Service Delivery features and would like to add them, please speak with your CSM.

## Series

We have a series of articles on Service Delivery:

- [Service Delivery - specialist technical features](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features) - an overview
- Data models:
  - [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model)
  - [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model)
- ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature)
- [Utilization Tables](https://help.planhat.com/en/articles/10602426-utilization-tables)
- Time tracking from the perspective of different personas:
  - [Users (Individual Contributors logging their own time)](https://help.planhat.com/en/articles/10587323-time-tracking-for-users)
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers) ⬅️ You are here
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins)

## Introduction

Time tracking is an important part of Service Delivery (such as Professional Services). In this article, we'll focus on the time tracking functionality in Planhat that's designed for Managers.

As a Manager:

- It's vital to know how much time your Team Members (Planhat Users) are spending on each Project/Task etc., e.g. for billing (especially if you're using "Time and Materials" - T&M - contracts)
- You'll be reviewing and approving your Team Members' logged time
- You'll need to know whether a particular Team Member (User) has availability for additional Projects etc.
- You'll want to have an understanding of your Team's capacity/utilization as a whole, over a period of time, so you can make decisions about staffing levels, such as whether you need an additional Team Member

In this article, we'll focus on:

- How to review and approve [Timesheets](https://help.planhat.com/en/articles/10576193-timesheet-data-model)
- How to analyze utilization via the [Utilization Table](https://help.planhat.com/en/articles/10601999-utilization-tables)

### 📌 Important to note

There are also various "core" parts of Planhat that are useful for Managers in Service Delivery, such as [Dashboards](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages) more generally, and other [Page types](https://help.planhat.com/en/articles/10102923-page-types-in-upgraded-planhat), etc. We won't cover these in this article, which is focused specifically on a couple of key features for time tracking that are part of the Service Delivery package.

### 📌 Important to note

This article looks at time tracking from the perspective of Managers. If you're an Individual Contributor working in Service Delivery, check out our article for Users [here](https://help.planhat.com/en/articles/10587323-time-tracking-for-users). If you're an Admin (e.g. working in Operations) setting up your tenant for your organization, then the article for you is [here](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins).

### 📌 Definitions

Planhat ["models"](https://help.planhat.com/en/articles/9587119-data-models) are similar to the "objects" you may be familiar with from other tools. Examples of models are Company, Opportunity, Task, Workflow and Project. Models have fields, [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules), [Profiles](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews), and so on. You can think of them as like containers for data.

"Records" are specific instances of those models - the data inside the models. For example, records of the Company model could be Microsoft, Apple, Ford and BMW.

Service Delivery uses 2 specialist data models:

- [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model) - each Time Entry record is an individual time log, representing time worked by a specific User on a specific date, optionally associated with a specific record of another model (e.g. a particular Project)
- [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model) - each Timesheet record is a collection of Time Entry records submitted by a specific User for a specific week

## How to review and approve Timesheets

As a Manager in Service Delivery, a key task for you is to review and approve the [Timesheets](https://help.planhat.com/en/articles/10576193-timesheet-data-model) of your Team Members.

### Viewing Timesheets

We recommend that you review and update Timesheets via a [Data Table or Grouped List Page](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages) created for the Timesheet model. (You could alternatively do this via the [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer).)

Here's an example Page built for the Timesheet model - it's a Data Table where each row is a Timesheet, displaying some key properties.

As you can see in the screenshot, filters have been applied (the orange text near the top):

- "Submitted By" has been set to "any of" the Users (Team Members) that I am managing - so I only see the Timesheets that I have responsibility to approve
- "Status" is set to "Submitted" - so I only see the Timesheets that need to be approved

In a Grouped List Page, it works well to group by "Status", again so it's clear which Timesheets need your attention.

You can configure which columns (fields/properties) are shown in any of these tables if desired - see [here](https://help.planhat.com/en/articles/10057893-table-preferences-in-upgraded-planhat) for further details.

### Reviewing Timesheets

To open up a specific Timesheet to look at its component Time Entries, you click on its Name within the "Name" column to show its [Preview](https://help.planhat.com/en/articles/10191842-previews) on the right of your window.

In the screenshot above, you can see the constituent Time Entries at the bottom of the Timesheet Preview. Like you just saw with the Timesheets, you can then click on the name of one of the Time Entries to open up its Preview.

Once you've finished reviewing a Time Entry, and you'd like to return to the Timesheet itself, simply click the back arrow in the top left of the Time Entry Preview (as shown in the top right of the screenshot below).

### 🚀 Tip

The layout of the Previews for Timesheets and Time Entries can be customized in your tenant (typically by your Planhat admin) - you can read more about this [here](https://help.planhat.com/en/articles/10191842-previews).

### Approving Timesheets

Approval is a very quick and easy process: you simply need to change the "Status" field on that Timesheet record to "Approved". Simply click on the cell (e.g. in a Timesheet Data Table Page, as shown in the screenshot below) to change it.

### 🚀 Tip

Your tenant can be configured so that not all Users (not all [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles)) can update the Timesheet Status field, ensuring this action can only be performed by Managers. This can be accomplished via [data model permissions](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins#:~:text=%F0%9F%9A%80-,Tip,-You%20can%20get), or alternatively [Field Rules](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins#h_087d133733).

## How to review utilization (capacity) across your Team

As well as reviewing/approving Timesheets, another key aspect of management within Service Delivery is having a good understanding of utilization (capacity) within your team, both on an individual User basis, and considering your Team overall (and when compared with other Teams).

It's really easy to do this in Planhat, using a [Utilization Table](https://help.planhat.com/en/articles/10601999-utilization-tables) (Widget/chart) in a [Dashboard or Presentation Page](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages).

Utilization Tables display, in percentages, how much time your Users have logged compared to their available hours, so you can identify under- and over-utilization.

They can either be plotted by User, as in the example above, or you can group the User data e.g. by Teams.

This means you can identify trends, such as:

**For an individual User:**
- Are they completing their Timesheets correctly?
- Should they be given more or less work?

**Overall, considering Teams:**
- Is your Team being under- or over-utilized? E.g. if they are consistently over 100%, that suggests you may need an additional staff member
- Was there a particularly busy time period (e.g. week) for everyone (such as a big deadline), but things have calmed down since?
- If you compare different Teams, are there differences in utilization/capacity, and if so, why?

You can either create your own custom Page with a Utilization Table(s), or you can apply a "Planhat Global Template" (also called a "Community Template" or a "Page Template") - we recommend "Utilization and Staffing" as shown below. See [here](https://help.planhat.com/en/articles/10601999-utilization-tables#h_4ce136e50a) for details on how to select/apply a Template.

### 📚 Further reading

To learn more about Utilization Tables - including use cases and detailed set-up instructions - check out our separate article [here](https://help.planhat.com/en/articles/10601999-utilization-tables).

### 🚀 Tip

"Teams" (with a capital T) are a specific feature within Planhat. You can group Users into Teams, such as the EMEA Team, or the Sales team. You can read more about Teams in the "Settings" Global Tool article [here](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings#h_42ef8574ec).

### 🚀 Tip

As well as Utilization Tables, Planhat has a variety of other Widgets (chart types) that are incredibly useful for Service Delivery.

Take a look at our "Planhat Global Templates" (in the "Pages Library"), also known as "Community Templates" --> "Page Templates" - there is a whole group of Templates especially for Service Delivery, using a range of different Widget types. For instructions on how to navigate to these, see [here](https://help.planhat.com/en/articles/10601999-utilization-tables#h_4ce136e50a). You can either use these Templates as-is, edit them, or simply use them for inspiration when building your own custom Pages.