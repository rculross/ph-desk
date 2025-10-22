# Timesheet data model

## Summary

- Each Timesheet is a group of Time Entries (time logs) submitted by a User for a specific week
- Timesheets are created by Users within the "Timesheets" Home feature, by clicking "Submit Timesheet"
- Timesheets (i.e. Timesheet records) are approved by Managers by changing the Timesheet "Status" field to "Approved"

## Who is this article for?

All Planhat Users who work in Service Delivery

**Note:** This article is about Service Delivery functionality. If you don't have access to Service Delivery features and would like to add them, please speak with your CSM.

## Series

We have a series of articles on Service Delivery:

- [Service Delivery - specialist technical features](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features) - an overview
- Data models:
  - [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model)
  - [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model) ⬅️ You are here
- ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature)
- [Utilization Tables](https://help.planhat.com/en/articles/10602426-utilization-tables)
- Time tracking from the perspective of different personas:
  - [Users (Individual Contributors logging their own time)](https://help.planhat.com/en/articles/10587323-time-tracking-for-users)
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers)
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins)

## Introduction

A key part of Service Delivery is tracking time - knowing how long each User (you and your colleagues) spent on each project/customer etc. This is vital not only for billing purposes (especially if you use Time and Materials - T&M - contracts), but also for understanding team capacity (time used versus time available).

In Planhat, individual "packets" of time are logged via the [Time Entry model](https://help.planhat.com/en/articles/10559032-time-entry-data-model). Each Time Entry record corresponds to an amount of time (hours) worked on a specific date, with other fields/properties to add details as required (e.g. it can be linked to a record of another model, such as a particular Company, Task or Workflow etc.).

When a Planhat User has finished logging their Time Entries for the week, they can submit these together as a Timesheet (i.e. a Timesheet record), via the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature). Timesheets can then be reviewed and approved, typically by their Manager.

This article will focus on the Timesheet model overall; we have a separate article specifically on the "Timesheets" Home feature [here](https://help.planhat.com/en/articles/10599817-timesheets-home-feature).

### 📌 Definitions

Planhat ["data models"](https://help.planhat.com/en/articles/9587119-data-models) are equivalent to the "objects" you may be familiar with in other tools:

- Models each have standard fields and can also have custom fields, as well as [Previews/Profiles](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews) and [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules) etc.
- You can think of them as like the sheets/columns of a spreadsheet
- Examples of Planhat models are Company, End User, License and Opportunity

"Records" are data inside a model:

- They are equivalent to the rows within a spreadsheet
- For example, within the Company model, records could be "Apple", "Microsoft" and "Google"

### 📌 Permissions

Like other data models, access to the Timesheet model is controlled via [data model permissions](https://help.planhat.com/en/articles/10358702-data-model-permissions), which are part of [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles#h_5c67da6546), configured in the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings). If you don't have access and you think you should, reach out to your Planhat admin. You can read more about permissions for Service Delivery functionality [here](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features#h_a15f41b889).

## What are Timesheets?

"Timesheet" is a [data model](https://help.planhat.com/en/articles/9587119-data-models) that's been specifically designed for Service Delivery.

- Each Timesheet record is a collection of [Time Entry records](https://help.planhat.com/en/articles/10559032-time-entry-data-model), from a single User (colleague) for a specific week (Monday to Friday)
- An appropriate person (such as a Manager) can then review and approve each Timesheet
- You can easily export Timesheets, which is useful for billing purposes

One of the unique things about Timesheets is that they can be approached from two separate perspectives - typically:

- a general Planhat User (creating Timesheets) will view and interact with Timesheets via the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature)...
- ... and a Manager (approving Timesheets) will view and interact with Timesheets via a table such as a [Data Table Page](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages)

## Timesheet fields

As with other models, you can view and customize the fields for Timesheets in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data).

Let's take a look at some of the key system (default/standard) fields on the Timesheet model.

### "Date From" and "Date To"

- These fields display the first and last date of the calendar week the Timesheet has been made for
- They don't necessarily correspond to the first and last date of the Time Entry records within the Timesheet
- These date fields are automatically populated when you generate a Timesheet record (i.e. submit a Timesheet)

### "Submitted By"

- This field contains the User (of Planhat - i.e. you and your colleagues) who submitted (generated) the Timesheet
- It's auto-populated when the Timesheet record is created by the User

### "Status"

- This is a specialist list field
- Its possible values are "Submitted" (the default), "Approved", and "Returned", each of which have their own color in cells for easy reference
- When a Manager is reviewing Timesheets (e.g. in Data Table Pages or Data Explorer), they use this dropdown menu to change the status of the Timesheet (i.e. Timesheet record) in question
- The Status will then also be updated for the User's view in the Timesheets Home feature
- The value in the Status field also affects other fields - see the next point

### "Approved By" and "Date of Approval"

- These fields are automatically populated when the Status field is updated from "Submitted" to "Approved"
- It's not possible to update these fields manually
- "Approved By" records which User (of Planhat - i.e. you and your colleagues) changed the status to "Approved"
- "Date of Approval" records the date that the Status was changed to "Approved"

## How to create Timesheet records - i.e. generate/submit a Timesheet

### 📌 Summary

1. Go to the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature)
2. Click "Submit Timesheet"

The Timesheet model has some unique features. A key difference from other Planhat models is how Timesheet records (i.e. Timesheets) are created. Unlike [Time Entry records](https://help.planhat.com/en/articles/10559032-time-entry-data-model), for example, you can't click an "+ Timesheet" button in Data Explorer, a Page or a Profile/Preview. Instead, Timesheets are created in a special [Home feature](https://help.planhat.com/en/articles/10096633-home-features-for-general-planhat-users) called "Timesheets".

You'll use the "Timesheets" Home feature if you're logging your own time. Here you will see all your [Time Entries](https://help.planhat.com/en/articles/10559032-time-entry-data-model) (whichever [method](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_b0d62465e7) you used to create them), organized in weeks. (You can use the < > symbols in the top left to change weeks.)

When you have finished listing all your Time Entries for a particular week - so all your hours are recorded - you should click the orange "Submit Timesheet" button in the top right.

This creates the Timesheet record for that week.

You'll see that the "Submit" button updates, and next to it you can see that the Status is now "Pending approval".

At this stage, it's possible for you to make changes to the component Time Entries if needs be, and then you can click on "Re-submit" to update the Timesheet record - you'll see the pop-up message below if you do this.

Once your Timesheet has been approved (e.g. by a Manager), you'll see that the Status of "Approved" is displayed for that week. It's not possible to edit/resubmit the Timesheet from the Home feature at this stage.

### 📚 Further reading

For further details on the "Timesheets" Home feature, check out our separate article [here](https://help.planhat.com/en/articles/10599817-timesheets-home-feature).

## How to approve Timesheets

### 📌 Summary

Change the "Status" field of the Timesheet record to "Approved"

So you've seen how a User would create/submit a Timesheet, but how would a Manager then go about approving a Timesheet?

It's simple:

1. Review the Timesheet by opening up its [Preview](https://help.planhat.com/en/articles/10191842-previews) (by clicking on its name in the "Name" column) and viewing the component Time Entries - you can open their Previews too
2. Then to approve a Timesheet, you just need to change its ["Status" field](https://help.planhat.com/en/articles/10576193-timesheet-data-model#h_a9c6af2fb9) to "Approved"

You can choose where you review Timesheets and make this field change - e.g. you could go to the [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) and select "Timesheet" from the model dropdown menu, or you could create a [Data Table Page](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages) on the Timesheet model. You could use a [Grouped List Page](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages#h_ed3ca52006) where the groupings correspond to "Status", to easily see which Timesheets require your action. Remember that you can apply filters - e.g. so you only see the Timesheets submitted by Users within your Team.

If you've opened up a Timesheet's [Preview](https://help.planhat.com/en/articles/10191842-previews), you can change the Status from there (as an alternative to the data table).

If you review a Timesheet and think it needs editing by the submitter before you can approve it, you change its Status to "Return for editing" rather than "Approved".

### 📚 Further reading

For more details on Service Delivery from a Manager's perspective, check out our separate article [here](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers).

## Additional tips

### Timesheet Previews

We mentioned above that you can open up the [Preview](https://help.planhat.com/en/articles/10191842-previews) of a Timesheet in order to fully [review](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers#h_993f5e7783) all its details, including its component Time Entries.

As with other models, you can customize the Preview layouts for Timesheets in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data). You can read more about designing Previews [here](https://help.planhat.com/en/articles/10191842-previews).

### Restricted approval flows

You'll likely want to restrict access to the Status field on Timesheets, so only certain Users (e.g. those with Manager or Administrator [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles#h_5c67da6546)) can approve them. It's easy to set this up - you can either do this via permissions or by [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules).

In addition, you will typically want to lock Timesheet fields - and also fields on their constituent Time Entry records - when the Timesheet Status is set to Approved. This is something else you can configure via [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules). You can learn more about Field Rules for Service Delivery [here](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins#h_087d133733).

### Exporting Timesheets

If you would like to export Timesheets from Planhat, e.g. for billing purposes, it's easy to do so.

When you're viewing Timesheets in Pages or Data Explorer, simply use the checkboxes on the left to select your choice of Timesheet(s), click the ellipsis, and then click "Export to Excel".