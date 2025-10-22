# Time tracking for Admins

## Summary

- Planhat's Service Delivery package includes a range of specialist features for time tracking
- There are a number of setup steps, which may be carried out by you as an Admin and/or Planhat staff
- As with other Planhat functionality, Service Delivery features can be customized to best suit your organization
- This article takes you through permissions, settings, fields, Field Rules, Previews and more

## Who is this article for?

Admins/builders who configure their Planhat tenant for their organization, with the Service Delivery package

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
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers)
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins) ⬅️ You are here

## Introduction

While Planhat's "core" customer platform is perfect for Service Delivery / Professional Services, there are a range of specialist additional features designed for tracking time.

In this article, we'll give you an overview of the tenant setup steps to enable and personalize this time-tracking functionality - a checklist to follow - including permissions, settings and more.

You'll typically set things up with the help of your Planhat CSM/TAM - so configuration may be done for you by Planhat. However, we will list everything here, for completeness.

### 📌 Important to note

This article focuses on features specific to Service Delivery that are used for time tracking. There are, additionally, many other elements within the "core" Planhat feature set that are great for Service Delivery, such as [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview), which we will not cover here.

### 📌 Important to note

This article looks at time tracking from the perspective of Admins who are involved in configuring their Planhat tenant. If you're an Individual Contributor working in Service Delivery, check out our article for Users [here](https://help.planhat.com/en/articles/10587323-time-tracking-for-users). If you're a Manager working in Service Delivery (reviewing your Team's work), our article for Managers is [here](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers).

### 📌 Definitions

Planhat ["models"](https://help.planhat.com/en/articles/9587119-data-models) are similar to the "objects" you may be familiar with from other tools. Examples of models are Company, Opportunity, Task, Workflow and Project. Models have fields, [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules), [Profiles](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews), and so on. You can think of them as like containers for data.

"Records" are specific instances of those models - the data inside the models. For example, records of the Company model could be Microsoft, Apple, Ford and BMW.

Service Delivery uses 2 specialist data models:

- **Time Entry** - each Time Entry record is an individual time log, representing time worked by a specific User on a specific date, optionally associated with a specific record of another model (e.g. a particular Project)
- **Timesheet** - each Timesheet record is a collection of Time Entry records submitted by a specific User for a specific week

## Permissions

We describe all the Service Delivery permissions in our article on technical features [here](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features#h_a15f41b889), so check out that article for details.

You should ensure all the relevant permissions are enabled for the relevant [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles) (including your own!). This includes both [data model permissions](https://help.planhat.com/en/articles/10358702-data-model-permissions) ("Time Entry" and "Timesheet") and [feature Module permissions](https://help.planhat.com/en/articles/10450207-workflow-module-permissions) ("Time Tracking") - see screenshots below.

It may be that initially you don't turn on all permissions for every Role while you are setting things up - you can potentially enable them later on, when you're ready.

Remember, there are some tenant-level permissions that can only be enabled/disabled by Planhat staff, so if you feel like you are missing something, please discuss with your CSM.

### 🚀 Tip

You can get really granular with the permissions, to enable different [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles) to do different things when it comes to Service Delivery.

For example, to set up a restricted approval flow, you could configure the Timesheet data model permissions so that only certain Roles (e.g. Administrator and Manager) can update the "Status" field, which is how [Timesheets are approved](https://help.planhat.com/en/articles/10576193-timesheet-data-model#h_23b48fffc4) - see screenshot below. You could also remove Update access for the "Timesheet Status" field on the Time Entry model.

An alternative would be to lock this field for certain Roles via a Field Rule, as described [later in this article](#h_087d133733).

## Settings

The settings related to Service Delivery are configured in the "Time Tracking" part of the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings) (pictured in the screenshot below).

There are 2 elements to configure here:

1. At the top, you choose which [model(s)](https://help.planhat.com/en/articles/9587119-data-models) you would like to track time against (i.e. link Time Entry records to) - e.g. Task, Workflow or Opportunity etc.

2. At the bottom, you choose which Time Entry fields you would like to display as columns in the ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature), which is where your Users can record Time Entries and submit Timesheets

### 📌 Important to note

Be aware that there are two different things called "Projects" in Planhat:

- "Project" is a [data model](https://help.planhat.com/en/articles/9587119-data-models)
- "Project" is a type of [Workflow](https://help.planhat.com/en/articles/9587102-workflows-overview) (the other type being "Sequence")

When you specify which models to track time on in the settings shown above, make sure you select either "Project" (for the model) and/or "Workflow" in the Settings, depending on which you want to track time on.

## Fields

In the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data), select the "Time Entry" model on the left, and review the fields in the "Fields" tab. A selection of system (standard/default) fields are automatically provided for you and cover all the main requirements for a Service Delivery process, but you can create custom fields if you wish, e.g. if you have any information specific to your organization that you would like to be included.

Then, repeat this for the "Timesheet" model.

### 📚 Further reading

## Field Rules

In the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data), create [Field Rules](https://help.planhat.com/en/articles/10261133-field-rules) if desired, as part of your approval process. It's recommended that you create "locked" Field Rules to avoid unintentional editing.

### For the Timesheet model:

1. You could create a Field Rule so that the "Status" field (which is how Timesheets are approved - read more about this [here](https://help.planhat.com/en/articles/10576193-timesheet-data-model#h_23b48fffc4)) is locked for certain Users, so only e.g. those with Administrator or Manager [Roles](https://help.planhat.com/en/articles/10118439-home-templates-and-roles#h_5c67da6546) can update this (i.e. approve the Timesheets)
   - **Alternative:** Control access to this field using permissions - see [here](#:~:text=%F0%9F%9A%80-,Tip,-You%20can%20get)

2. We suggest you also create a Field Rule that locks all the fields on Timesheets when the Timesheet "Status" field is updated to Approved, as you don't want any changes after that point

### For the Time Entry model:

Following on from this, for the Time Entry model, we recommend that you create a Field Rule that locks all fields when the field "Timesheet Status" is set to "Approved" - like the Field Rule we just mentioned, this is because Timesheets generally shouldn't be edited after they have been set to Approved, and this Field Rule would lock an approved Timesheet's component Time Entries.

## Profiles/Previews

There are two elements to configuring [Profiles/Previews](https://help.planhat.com/en/articles/10191241-an-introduction-to-profiles-previews) for Service Delivery, in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data).

### 1. Time Entry and Timesheet Previews

For the Time Entry and Timesheet models, click into the "Profile" tab, and make any changes you'd like to their [Previews](https://help.planhat.com/en/articles/10191842-previews) - this determines the data/layout shown when viewing the records of those models. You may choose to just leave the defaults as-is.

### 2. Adding Time Entries to other model Previews/Profiles

Secondly, and most importantly, for the models you would like to associate Time Entries with (as you just configured in the "Settings" Global Tool, as mentioned [earlier in this article](#h_4e25c5b3d9)), you should ensure that "Time Entries" is included as a Section/Tab in the [Preview](https://help.planhat.com/en/articles/10191842-previews) and [Full-Page Profile](https://help.planhat.com/en/articles/10201905-custom-company-full-page-profile-templates) if appropriate.

This is so Users can add Time Entries directly from records of these models - e.g. while they are looking at a Company or a Task, they can log time directly there, as described [here](https://help.planhat.com/en/articles/10587323-time-tracking-for-users#h_5ed9d7e8e4).

### 📌 Important to note

## Additional tips

While we've covered the key setup steps in this article, there are additional elements you could set up in your tenant, with the help of the Planhat team (e.g. your TAM). For example:

- Financial and operational KPIs (e.g. number of hours tracked, total billable, and total cost) from Tasks and Workflows can be aggregated to the Company level using [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview)

- [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model) records have a "Submitted By" field to record whose time is being logged (as shown in the example screenshot below). While this is automatically populated if you [create Time Entries via the "Timesheets" Home feature](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_c5769334cc), if you use [another method](https://help.planhat.com/en/articles/10559032-time-entry-data-model#h_4c19106820), the standard behavior is that it needs to be added manually. Alternatively, to save time, you can set up an [Automation](https://help.planhat.com/en/articles/9587240-automation-overview) to fill in this field for you

- You can also use [Automations](https://help.planhat.com/en/articles/9587240-automation-overview) to set up notifications so that when a [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model) changes the value of its "Status" field (to either Returned or Approved - which happens as part of the management approval process) the User who submitted it (as recorded in the "Submitted By" field) is notified

- Like other data in Planhat, data related to Service Delivery can be visualized and analyzed in a range of [Pages](https://help.planhat.com/en/articles/10102923-page-types-in-upgraded-planhat), such as [Data Tables](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages); when it comes to charts, you'll use [Dashboard and Presentation Pages](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages). As part of the setup process, you may create Pages for your colleagues to use, potentially as part of [Sections and Libraries](https://help.planhat.com/en/articles/10102778-organizing-content-pages-sections-and-libraries)