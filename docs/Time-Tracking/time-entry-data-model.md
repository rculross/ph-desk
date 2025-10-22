# Time Entry data model

## Summary

- You log time in Planhat using the Time Entry model
- Each Time Entry record corresponds to an amount of hours worked on a specific date
- Time Entry fields enable you to record other properties - e.g. you can link a Time Entry record to a record of another model (such as a specific Task or Opportunity)
- It's easy to create Time Entry records, either individually or in bulk

## Who is this article for?

All Planhat Users who work in Service Delivery

**Note:** This article is about Service Delivery functionality. If you don't have access to Service Delivery features and would like to add them, please speak with your CSM.

## Series

We have a series of articles on Service Delivery:

- [Service Delivery - specialist technical features](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features) - an overview
- Data models:
  - [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model) ⬅️ You are here
  - [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model)
- ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature)
- [Utilization Tables](https://help.planhat.com/en/articles/10602426-utilization-tables)
- Time tracking from the perspective of different personas:
  - [Users (Individual Contributors logging their own time)](https://help.planhat.com/en/articles/10587323-time-tracking-for-users)
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers)
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins)

## Introduction

If you're in Service Delivery (such as Professional Services), it's important to track how much time you are spending on what - e.g. how much time you worked on a particular project. This is especially vital if you use Time and Materials - T&M - contracts. It's also key in understanding what your capacity is (your used time versus your available time).

In Planhat, time is logged via the Time Entry data model - see the definitions box below. Each Time Entry record corresponds to an amount of time (e.g. 2 hours) spent on a particular date (e.g. March 2nd, 2025), optionally linked to a record of another model (e.g. Task Y), and with other fields to record additional properties (e.g. whether the project is billable or not).

Time Entry records from a calendar week are then grouped together and submitted in a Timesheet, which can be approved by a manager. You can read more about Timesheets [here](https://help.planhat.com/en/articles/10576193-timesheet-data-model).

In this article, we will examine the Time Entry model in more detail, focusing particularly on its fields, and how to create Time Entry records (i.e. log time).

### 📌 Definitions

Planhat ["data models"](https://help.planhat.com/en/articles/9587119-data-models) are equivalent to the "objects" you may be familiar with in other tools:

- Models each have standard fields and can also have custom fields, as well as [Previews/Profiles](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews) and [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules) etc.
- You can think of them as like the sheets/columns of a spreadsheet
- Examples of Planhat models are Company, End User, License and Opportunity

"Records" are data inside a model:

- They are equivalent to the rows within a spreadsheet
- For example, within the Company model, records could be "Apple", "Microsoft" and "Google"

### 📌 Permissions

Like other data models, access to the Time Entry model is controlled via [data model permissions](https://help.planhat.com/en/articles/10358702-data-model-permissions), which are part of [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles#h_5c67da6546), configured in the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings). If you don't have access and you think you should, reach out to your Planhat admin. You can read more about permissions for Service Delivery functionality [here](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features#h_a15f41b889).

## Time Entry fields

As with other models, you can view and customize the fields for the Time Entry model in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data).

Time Entry has 2 main system (default/standard) fields:

- **"Date"**
- **"Hours"**

... i.e. each Time Entry record represents some time (hours) worked on a particular date. For example, on February 14th, you worked for 2 hours on a specific project.

There are a range of additional system fields, specifically designed for Service Delivery, including:

### "Track Time On" (also called "Parent")

This is where you select the model (e.g. Company) and then the record (e.g. Microsoft) that you want to associate the logged time with.

- You can theoretically track time on any model/record within Planhat. Within the "Time Tracking" part of the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings), you define which model(s) you want to be able to allocate logged time to
- When populated, this field displays a colored symbol for the model (e.g. a blue building to denote Company), followed by the name of the record, to help you quickly identify what model the Time Entry is tracked against
- This field can also be left empty. A common use case is that you have spent time on something like internal training, or planning for an appraisal, etc., which shouldn't be linked to a specific project that you're tracking time on, but should still be tracked for analysis e.g. in a [Utilization Table](https://help.planhat.com/en/articles/10601999-utilization-table)

### "Submitted By"

This field is used to record the User who performed the work (e.g. you!)

### "Time Off"

- This is a toggle switch (Boolean/checkbox field)
- You should toggle this field on when you want to track your time off (vacation/holiday/PTO or sick leave etc.)
- These logged hours feed into utilization calculations in [Utilization Tables](https://help.planhat.com/en/articles/10601999-utilization-table), as they explain how you spent some of your available time

### "Billable"

- This is a toggle switch (Boolean/checkbox field)
- Use this field to specify whether the hours logged should be billed to the customer in a "time and materials" (T&M) type of project (i.e. they are billable), or whether they are part of a fixed-fee project
- This field also feeds into [Utilization Tables](https://help.planhat.com/en/articles/10601999-utilization-table), if you select to analyze/visualize "billed utilization"

### "Billing Code"

- If your organization tracks work for each project via specific billing codes (rather than simply which records they are associated with), then you can record that here
- For example, all pre-sales, ongoing project work and post-project work can be tracked with one billing code to see the total time spent on a Company end-to-end
- This field can also be useful for tracking non-project work (such as internal training) that isn't associated with a specific record - e.g. you could have some kind of "admin" code

### "Billable Rate" / "Cost Rate" / "Currency"

These are all revenue fields, used for profitability analysis (e.g. on the Company model, using cross-model [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview))

### "Timesheet Status"

- This field reflects the status of the [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model) that the Time Entry record is part of, if any
- This can be useful for [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules) - e.g. you (your admin) could set up a Field Rule that locks the fields of a Time Entry record if its Timesheet Status field is set to Approved - so they can no longer be edited

## How to log time by creating Time Entry records

Planhat is very flexible, and you can log time in Time Entries (i.e. create Time Entry records) in a variety of different parts of the platform, meaning you can choose what suits you best in each moment.

For simplicity, we're going to divide this into two main categories: creating individual Time Entry records (for one date at a time), and creating Time Entries in bulk (for multiple dates at a time).

### A. Creating individual Time Entries

#### Where?

There are a few places where you can do this:

1. **In [Profiles/Previews](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews)** - i.e. on other records (e.g. on a Task, or a Workflow, or a Company, etc.)

   **📌 Important to note**
   - You can only do this for records of models where you have specified that model as one you can associate Time Entries with, which you set in the "Time Tracking" part of the "Settings" Global Tool
   - You also need to ensure that "Time Entries" is included in the respective Template (layout) of the Preview or the Full-Page Profile

2. **In [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer)** - remember to select the "Time Entry" data model from the dropdown menu

3. **In [Data Table etc. Pages](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages) created on the Time Entry model**

#### Why?

Using one of these methods is perfect for when you log data as you go - e.g. you do some work on a project, and then you record it right away.

When you use the first method of recording the time directly on the related record, this has the advantage that the related record ("Track Time On" - "Parent") is automatically populated in the Time Entry for you.

#### How?

When you click "+ Time Entry" (using one of the first three methods shown above), it'll open up a modal (form) similar to this:

You should fill in all the relevant fields, and then click the "Create Time Entry" button in the bottom right of the modal.

**🚀 Tip:** You can configure which fields on the Time Entry model are shown here, via "Create form", which you can access within the Profile tab of the Time Entry section within the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data).

The fields shown in the Time Entry "Create form" are not affected by the fields you select to be columns for Timesheets in the "Time tracking" section of the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings).

**"Parent" is the equivalent of "Track Time On".** Here you choose which record of another model to associate the Time Entry record with; you do this in two parts:

1. Firstly, choose a model, e.g. Company, Task, Workflow or Project etc.
   - Remember, you specify which models you can select here via the the "Time Tracking" section of the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings)
2. Secondly, choose a record on that model - so, for example, if you have selected the Company model, then a record could be "Ford" or "GSK"

**🚀 Tip:** You don't actually have to state a "Parent" (model/record). You may want to leave the Parent blank if you want to create a Time Entry record that is not associated with another record in Planhat - e.g. if you spent time training a colleague, or preparing for your appraisal. This field is not required to be populated in order to create a Time Entry record.

**🚀 Tip:** If you click "+ Time Entry" from another record, you will see that this record will be automatically filled in for you as the "Parent", saving you time. You click into this to change the Parent if you need to.

**🚀 Tip:** It's possible to set up an [Automation](https://help.planhat.com/en/articles/9587240-automation-overview) to automatically fill in "Submitted By" for you. Speak with your Planhat TAM if you would like help setting this up.

### B. Creating Time Entries in bulk

#### Where?

You can create multiple Time Entry records at once in the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature).

#### Why?

Using this method can save you time. It's suitable if you want to log time for different dates in a week where the other Time Entry properties are the same - e.g. you spent 2 hours each day on the same project. You fill in the details in a single row, and then when you press "Save", Planhat will automatically create all the individual Time Entries for you - i.e. split it out into multiple rows (as it's one Time Entry record, corresponding to one table row, per date).

This method is great if you record time at a later date (e.g. at the end of a week) rather than recording it as you go.

#### How?

To add Time Entries in the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature), follow the steps below.

**🚀 Tip:** If you want to log time for a different week than the current one, firstly use the < > symbols in the top left to shift the timeframe (week) displayed.

1. Click "+ Add Time Entries" to add a new row to the table
2. It will open on the "Track Time On" column
   - Remember this is the same as the "Parent" field described above
   - Select a model (from the list configured for "Time Tracking" in the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings)), e.g. Company, then select a record of that model (e.g. Microsoft)
   - (Or don't select a model/record if that's not applicable, e.g. you're recording vacation time)
3. Complete any other columns shown - e.g. ["Billing Code"](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_f1c690092d)
   - **🚀 Tip:** You can configure which columns show in the "Timesheets" Home feature (for your tenant) via the "Time Tracking" part of the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings)
4. Fill in the hours worked on the different days - e.g. 1 hour towards this project on Monday, and 5 hours on Wednesday, and 2 hours on Thursday
   - **🚀 Tip:** You can tab across to the next date
5. Click the orange "Save" button
   - It's really important you do this to create the Time Entry record(s)
   - If you've recorded hours for different dates, at this point Planhat will automatically split the single row into multiple rows (i.e. multiple Time Entry records), each corresponding to a single date
6. Repeat the above steps if you'd like to add Time Entries with different properties (e.g. associated with another project)

## Additional tips and next steps

### Time Entry Previews

Once you've created Time Entry records, as well as viewing multiple Time Entries in tables (e.g. the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature), [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) or a [Data Table Page](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages)), you can click into an individual Time Entry record to view/edit more details via its [Preview](https://help.planhat.com/en/articles/10191842-previews).

To do this, click on the name of your choice of Time Entry.

Here you can add in further information, including a Description and Comments.

As with Previews for other models, the layout can be customized via the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data).

### Timesheets

Once you've finished logging all your time for a week, the typical next step is to submit your Timesheet, which groups together all the Time Entries for the week, for approval by a manager.

You can read all about Timesheets [here](https://help.planhat.com/en/articles/10576193-timesheet-data-model).

### Field Rules

Optionally, you (your admin) may set up [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules) on the Time Entry model - e.g. when the Timesheet they are part of is set to Approved, the Time Entries can no longer be edited.

You can read more about Service Delivery Field Rules [here](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins#h_087d133733).

### Dashboards

As with other models, you can visualize Time Entry data in [Dashboard and Presentation Pages](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages).

You can create custom Pages, or use one of the Planhat Page Templates.