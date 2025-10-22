# Time tracking for Users

## Summary

- If you're working in Service Delivery and tracking how you are spending your time - e.g. 2 hours on Project X, and 4 hours on Task 5, and 3 hours for Company Z - Planhat's specialist time tracking functionality makes it easy for you
- You track time using the Time Entry model. You can do this in a variety of ways, including directly logging it on another record (e.g. a Task or Workflow) or using the "Timesheets" Home feature
- Once you've finished logging your Time Entries for a week, they are grouped together and submitted as a Timesheet

## Who is this article for?

General Planhat Users (Individual Contributors, rather than Managers or Admins) who are working in Service Delivery

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
  - [Users (Individual Contributors logging their own time)](https://help.planhat.com/en/articles/10587323-time-tracking-for-users) ⬅️ You are here
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers)
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins)

## Introduction

In Service Delivery (such as Professional Services), a key component is tracking time:

- How much time you have worked on each project (especially if you are billing customers based on the amount of time spent ("Time and Materials" - T&M) rather than a fixed-fee project),
- and how much time you have spent on other tasks (such as internal training), enabling analysis of available v. used time

With Planhat's Service Delivery functionality, it's really easy for you to:

- Log how you have spent your time (in [Time Entries](https://help.planhat.com/en/articles/10559032-time-entry-data-model)) which can be associated with specific records (e.g. a particular Workflow, Task, Project, Company or Opportunity etc.) or not (e.g. internal training or vacation/holiday)
- Submit your Time Entries for the week in [Timesheets](https://help.planhat.com/en/articles/10576193-timesheet-data-model)

In this article, we show you how.

### 📌 Important to note

There are also various "core" parts of Planhat that are useful for all Users in Service Delivery. We won't cover these in this article, which is focused specifically on a couple of key features for time tracking that are part of the Service Delivery package.

### 📌 Important to note

This article looks at time tracking from the perspective of Individual Contributors who are carrying out projects and tracking their own time. If you're a Manager working in Service Delivery (reviewing your Team's work), check out our article for Managers [here](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers). If you're an Admin (e.g. working in Operations) setting up your tenant for your organization, then the article for you is [here](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins).

### 📌 Definitions

Planhat ["models"](https://help.planhat.com/en/articles/9587119-data-models) are similar to the "objects" you may be familiar with from other tools. Examples of models are Company, Opportunity, Task, Workflow and Project. Models have fields, [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules), [Profiles](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews), and so on. You can think of them as like containers for data.

"Records" are specific instances of those models - the data inside the models. For example, records of the Company model could be Microsoft, Apple, Ford and BMW.

Service Delivery uses 2 specialist data models:

- [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model) - each Time Entry record is an individual time log, representing time worked by a specific User on a specific date, optionally associated with a specific record of another model (e.g. a particular Project)
- [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model) - each Timesheet record is a collection of Time Entry records submitted by a specific User for a specific week

## Logging your time

### What are Time Entries?

You record your time in Planhat using Time Entries.

Each Time Entry record:

- Corresponds to an amount of hours worked on a specific date
- Is linked (optionally) to a record of another model - e.g. a Company, or a Task, etc. - whatever you want to link the time worked with

... i.e. you could have a Time Entry that states that you worked for 2 hours on Project X on February 14th, 2025.

You can fill in a variety of other information on each Time Entry record, such as a billing code (if you use them), other billing information, whether the Time Entry record is actually for your time off (e.g. vacation/holiday), and so on. For more information - on Time Entry fields etc. - you can check out our Time Entries article [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model).

In the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature) (example screenshot below), each row corresponds to a Time Entry record.

Here's an example of viewing a Time Entry record via its [Preview](https://help.planhat.com/en/articles/10191842-previews).

### How to record your time as Time Entries

As Planhat is very flexible, there are actually a number of different places that you can create Time Entry records in Planhat - for full details, you can refer to the Time Entries article [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_b0d62465e7) - but in this article, we'll summarize the main methods and their use cases.

#### Main method 1: recording time on a specific record

This method is perfect for when you record your time as you go.

1. When viewing the [Profile/Preview](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews) of a record (e.g. a Company or a Workflow) you'd like to track time on, click "+ Time Entry"
2. Complete the form
   - The mandatory fields are "Date" (which is prefilled as today's date) and "Hours"
   - "Parent" is the record (e.g. the Company) you're tracking time on, and is automatically filled in for you
3. Click "Create Time Entry" when you've finished entering all the details
4. The [Preview](https://help.planhat.com/en/articles/10191842-previews) of the new Time Entry will automatically open
5. Add any extra information as required (e.g. Description or Comments)

... and that's it! Super easy!

### 📌 Important to note

To see the Time Entries section in [Previews/Profiles](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews), it needs to be included in the applied Preview/Profile Template (layout) for that model. Reach out to your Planhat Admin if you need help with this.

### 📚 Further reading

To learn more about creating Time Entries, including further details and additional methods, see [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_b0d62465e7).

#### Main method 2: bulk recording your Time Entries in the "Timesheets" Home feature

This method is great for recording all your time at the end of the week or day.

You can create multiple Time Entry records at once using this method, as long as all their properties are the same other than the date/hours.

1. In the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature), click "+ Add Time Entries" at the bottom
   - Make sure you're in the right week first - it opens on the current week, which is usually what you want. You can use the < > buttons at the top if you need to change week
   - You won't see "+ Add Time Entries" if you already have an Approved Timesheet for that week
2. In "Track Time On" (equivalent to "Parent"), choose a model (e.g. Company) and then a record (e.g. Coca-Cola) - or click out of the menu if you don't want to associate your Time Entries with another record (e.g. if it's internal work or vacation)
3. Fill in the other columns of the table
   - The most important thing is that you enter the number of hours in each date column. For ease, you can tab across to the next date
   - The other columns showing in your "Timesheets" Home feature table will depend on [how your Admin has configured it](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins#h_4e25c5b3d9)
4. Click "Save" when you've finished entering all the details

... and you're done! You'll notice that if you've recorded time on multiple dates, these are split into individual Time Entries (one for each date), represented as different rows in the table.

Simply repeat this process for each new set of Time Entries you'd like to log.

### 📚 Further reading

## Submitting Timesheets

Once you've recorded all your time for the week (i.e. created all the required Time Entries), it's time to submit (i.e. create/generate) a Timesheet.

### What are Timesheets?

Each Timesheet (i.e. Timesheet record) is a collection of all your Time Entries for that week.

You submit (create) Timesheets in the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature).

Once you submit (create) a Timesheet, it can be approved (or returned), typically by a Manager.

### How to submit a Timesheet

This is really easy!

1. Navigate to the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature), if you're not already there
   - If you don't have "Timesheets" pinned as one of your favorite features in Home, you'll find it under "... More"
2. Ensure you're looking at the right week
   - It opens on "this week", and that will be what you want in the majority of cases
   - You can use the < > buttons at the top if you need to change week
3. Make sure you have recorded all your time for the week
   - Remember, if it's your company policy, to record time that was not spent on customer projects, e.g. internal training or vacation / sick leave
   - Look at the hours totals at the top of each date column to check whether it adds up to the expected number of hours (e.g. 8 hours)
4. Click the orange "Submit timesheet" button in the top right
   - You'll see the status change to "Pending approval"
   - If you need to make any changes to the Time Entries, you can do so, and then click "Re-submit"
   - One scenario where this might happen is if your manager returns - rather than approves - a Timesheet. In this case, you'll see the status of your Timesheet update to "Returned for edits"

### 📚 Further reading

To learn more about Timesheets, see [here](https://help.planhat.com/en/articles/10576193-timesheet-data-model).