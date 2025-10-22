# "Timesheets" Home feature

## Summary

- The "Timesheets" Home feature is a vital tool if you need to track how much time you are spending on different projects/customers
- Here you can view how much time you have logged (via Time Entries) for each day in each week
- The "Timesheets" Home feature has a shortcut method to add multiple Time Entries (that share properties but differ in date - e.g. work on the same project on different days)
- The "Timesheets" Home feature is where you submit (create) Timesheets. Here you can also see the status of each Timesheet, such as whether it's been approved

## Who is this article for?

All Planhat Users who work in Service Delivery

**Note:** This article is about Service Delivery functionality. If you don't have access to Service Delivery features and would like to add them, please speak with your CSM.

## Series

We have a series of articles on Service Delivery:

- [Service Delivery - specialist technical features](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features) - an overview
- Data models:
  - [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model)
  - [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model)
- ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature) ⬅️ You are here
- [Utilization Tables](https://help.planhat.com/en/articles/10602426-utilization-tables)
- Time tracking from the perspective of different personas:
  - [Users (Individual Contributors logging their own time)](https://help.planhat.com/en/articles/10587323-time-tracking-for-users)
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers)
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins)

## Introduction - what is the "Timesheets" Home feature?

"Timesheets" is a key feature within your "Home" in upgraded Planhat - if you have the Service Delivery package and associated [permissions](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features#h_a15f41b889) enabled.

This is a really important feature if your job involves tracking time, e.g. Professional Services. It's vital that you record how much time is spent on each project/customer, for billing based on time (T&M contracts), and for capacity planning.

Part of the suite of functionality for Service Delivery, the "Timesheets" Home feature is where you can:

- View all of your [Time Entries](https://help.planhat.com/en/articles/10559032-time-entry-data-model), organized by week
- Bulk-create Time Entries
- Create/submit [Timesheets](https://help.planhat.com/en/articles/10576193-timesheet-data-model)

### 🚀 Tip

Here's an example of what the "Timesheets" Home feature can look like:

## Where to find the "Timesheets" Home feature

To navigate to the "Timesheets" Home feature, click on "Home" in the top left of your tenant. If you have Timesheets pinned, you'll see it listed like so:

If you can't see it listed in your pinned Home features like shown above, you'll find it under "... More".

### 📌 Important to note

If you can't see the "Timesheets" Home feature, either on your main Home screen or under "... More" (both shown above), and you think you should have access via your specific Planhat subscription (for Service Delivery), make sure you have the relevant permissions enabled. You can read about Service Delivery permissions [here](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features#h_a15f41b889).

## Which Time Entries are shown in the "Timesheets" Home feature?

Within the "Timesheets" Home feature, you'll see all the Time Entries (i.e. Time Entry records) where you are (i.e. your User is) the value in the "Submitted By" field.

This includes Time Entries that have been created by other methods other than within the "Timesheets" Home feature (which you can read more about [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_4c19106820)) - just make sure your User is entered in the "Submitted By" field.

### 🚀 Tip

It's possible for the "Submitted By" field to be automatically populated via an [Automation](https://help.planhat.com/en/articles/9587240-automation-overview). If you would like help getting this set up, speak with your TAM or CSM.

### 🚀 Tip

If you're looking for a specific Time Entry in the "Timesheets" Home feature but can't find it:

1. Check whether the Time Entry has you in the "Submitted By" field, as described above
   - The [Data Explorer](https://help.planhat.com/en/articles/10037966-data-explorer) is a good place for you to do this
2. Check whether you are viewing the correct date range (week)
   - You can use the arrow buttons in the top left if you would like to change which week you're looking at

## Which columns (properties) are shown in the "Timesheets" Home feature?

The columns in the "Timesheets" Global Tool correspond to fields on the Time Entry model.

You will always see the "Name" of each Time Entry record (click on that to open up its [Preview](https://help.planhat.com/en/articles/10191842-previews), with further details), and the columns for dates where you record the number of hours you worked each day.

Other columns can be added/moved/removed. For example, you'll most likely want to include "Track Time On" (called "Parent" in some circumstances), which shows the record from another model (e.g. the Company or the Task) that a Time Entry record is associated with.

There are a variety of other fields on the Time Entry model that can be included as columns here, such as "Time Off", "Billable", and "Billing Code". You can read more about Time Entry fields [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_f1c690092d).

Which Time Entry fields are included as columns is set on a per-tenant (rather than per-User) level, in the "Time Tracking" section of the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings). This is typically carried out by a Planhat Admin within your organization - so speak to them if you think different columns should be displayed.

You can read more about this [here](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features#h_7e70f24764).

## How to bulk create Time Entries in the "Timesheets" Home feature

There are various alternative ways that you can create Time Entry records (i.e. log time), which you can read about [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_4c19106820).

In this article, we will focus specifically on how to log your Time Entries within the "Timesheets" Home feature.

This is a time-saving method to quickly create multiple Time Entries (corresponding to different hours worked on different dates) where the other properties (e.g. the associated record - "Track Time On") are the same.

To add Time Entries within the "Timesheets" Home feature:

1. Click "+ Add Time Entries" (at the bottom) to add a new row to the table
2. It will open on the "Track Time On" column
   - Select a model (from the list you configured for "Time Tracking" in the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings)), e.g. Company, then select a record of that model (e.g. Microsoft)
3. Complete any other columns shown (from the list you configured for "Time Tracking" in the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings)) - e.g. ["Billing Code"](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_f1c690092d)
4. Fill in the hours worked on the different days - e.g. 1 hour towards this project on Monday, and 5 hours on Wednesday, and 2 hours on Thursday
   - You can use the tab button on your keyboard to quickly jump across to the next date
   - Check out the tip below if you first need to shift the week displayed - e.g. you want to record time you worked last week
5. Click the orange "Save" button that will be shown above
   - It's really important you do this to create the Time Entry record(s)
   - If you've recorded hours for different dates, at this point this will automatically split the single row into multiple rows (i.e. multiple Time Entry records), each corresponding to a single date

### 🚀 Tip

To shift the timeframe (week) displayed within the "Timesheets" Home feature, use the < > symbols in the top left.

## How to submit Timesheets in the "Timesheets" Home feature

Once you've recorded all your time for a week (i.e. created all the required Time Entries), then it's time to submit (create) your Timesheet. The only way to do this is in the "Timesheets" Home feature. To do this, follow the method described below.

1. Ensure you're looking at the right week
   - The "Timesheets" Home feature opens on "this week", and that will be what you want in the majority of cases
   - Remember, you can use the < > buttons at the top if you need to change week
2. Make sure you have recorded all your time for the week
   - Look at the hours totals at the top of each date column to check whether it adds up to the expected number of hours per day (e.g. 8 hours)
   - It's recommended to record time that was not spent on customer projects, e.g. internal training or vacation / sick leave, because this feeds into the calculations in Utilization Tables
3. Click the orange "Submit timesheet" button in the top right
   - You'll see the status change to "Pending approval"
   - If you need to make any changes to the Time Entries, you can do so, and then click "Re-submit"
   - One scenario where this might happen is if your manager returns - rather than approves - a Timesheet. In this case, you'll see the status of your Timesheet update to "Returned for edits"

When your Timesheet has been approved, you'll see this reflected in the "Timesheets" Home feature