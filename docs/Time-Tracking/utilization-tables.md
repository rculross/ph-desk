# Utilization Tables

## Summary

- **Widget group:** Table Widgets
- **Source data:** Field
- **Description:** Displays, in percentages, how much time your Users (Team Members) have logged compared to their available hours, so you can identify under- and over-utilization
- **Use case examples:** Utilization analysis - e.g. identify who within your Team has capacity to take on a new project; identify whether you need an additional Team Member

## Who is this article for?

All Planhat Users who work in Service Delivery

It's particularly relevant for:
- Planhat Users who are designing Dashboard and Presentation Pages (e.g. CS Ops)
- Planhat Users who manage Teams within Service Delivery

**Note:** This article is about Service Delivery functionality. If you don't have access to Service Delivery features and would like to add them, please speak with your CSM.

## Series

We have a series of articles on Service Delivery:

- [Service Delivery - specialist technical features](https://help.planhat.com/en/articles/10550959-service-delivery-specialist-technical-features) - an overview
- Data models:
  - [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model)
  - [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model)
- ["Timesheets" Home feature](https://help.planhat.com/en/articles/10599817-timesheets-home-feature)
- [Utilization Tables](https://help.planhat.com/en/articles/10602426-utilization-tables) ⬅️ You are here
- Time tracking from the perspective of different personas:
  - [Users (Individual Contributors logging their own time)](https://help.planhat.com/en/articles/10587323-time-tracking-for-users)
  - [Team Managers](https://help.planhat.com/en/articles/10592702-time-tracking-for-managers)
  - [Admins (tenant setup)](https://help.planhat.com/en/articles/10593864-time-tracking-for-admins)

## Introduction

Central to Service Delivery (such as Professional Services) is an understanding of how much time has been spent on which project/customer etc. As well as being important for billing if you're working on a "time and materials" ("T&M") basis, you'll want to understand the capacity of your Team, especially if you are a Manager - this means knowing the difference between the amount of time your Users have logged (via the [Time Entry](https://help.planhat.com/en/articles/10559032-time-entry-data-model) and [Timesheet](https://help.planhat.com/en/articles/10576193-timesheet-data-model) models) and the amount of working hours they had available.

For example, you'll need to answer questions such as:

- Are any particular Users (Team Members) consistently under- or over-utilized?
- Who should the next big project be assigned to?
- What's the capacity of your Team like overall?
- If the Team is over-utilized, is this just a short-term peak in work, or should you recruit an additional Team Member?
- Are there differences in capacity between different Teams, and if so, why?

Planhat's Utilization Tables, which you can include in custom and templated [Dashboards and Presentations](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages), make it easy for you to answer these sorts of questions. They calculate the percentage capacity of Users for you, based on the time logged in Planhat, and even automatically color-code data to flag any possible issues. As with other Page Widgets, they are easy to customize to suit your particular needs.

In this article, we'll take you through Utilization Tables (also called Utilization Charts / Utilization Widgets) in further detail - what they are, why they are useful, and how to set them up.

### 📌 Reminder

The User model represents users of Planhat (i.e. you and your colleagues), while the End User model represents your contacts/customers. You can read more about Planhat models [here](https://help.planhat.com/en/articles/9587119-data-models).

### 🚀 Tip

Utilization Tables are not the only way to analyze capacity in Planhat - e.g. you could also create a series of Widgets to vizualize the number of open Tasks per User, or the number of active [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview) per User, etc. You can take a look at the Planhat Template Pages (described at the end of this article) for inspiration.

## What are Utilization Tables?

"Utilization" is a type of chart in the "Table Widgets" group, which you can use within [Dashboard and Presentation Pages](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages).

They display the utilization of Planhat Users (Team Members) - that is, how much of their available (working) time is being used (or at least logged). Utilization is displayed as percentages, and potential issues are flagged via automatic color coding (with green meaning good, red indicating a possible problem, and orange/amber somewhere in between).

With Utilization Tables, you can quickly identify which Users are under-utilized or over-utilized (or perhaps aren't [completing their Timesheets](https://help.planhat.com/en/articles/10599817-timesheets-home-feature) correctly). They are also useful to review the capacity of Teams as a whole - e.g. if everyone is logging a very high number of hours, perhaps you should recruit a new staff member.

## Technical details

### Component field data

Utilization is based on Time Entries - that is, records of the Time Entry model, which you can read all about [here](https://help.planhat.com/en/articles/10559032-time-entry-data-model). There are two particularly significant Time Entry system (default/standard) fields when it comes to Utilization Tables, which are both toggle switches (i.e. Boolean/checkbox fields).

- **"Time Off"** - you should toggle this field on when you want to track your time off (vacation/holiday/PTO or sick leave etc.)
- **"Billable"** - you use this to specify whether the hours logged should be billed to the customer in a "time and materials" (T&M) type of project (i.e. they are billable), or not (because they are part of a fixed-fee project)

Utilization Tables also use a system (default/standard) field on the User model called **"Weekly Capacity"**, where you can define the number of weekly working hours of each User. If this is not filled in, 40 hours is assumed (i.e. that's the default value).

### Utilization calculations

In the Utilization Table, you can either display/analyze "total utilization" or "billed utilization". "Billed utilization" only includes [Time Entries](https://help.planhat.com/en/articles/10559032-time-entry-data-model) where the ["Billable"](https://help.planhat.com/en/articles/10559032-time-entry-data-model#:~:text=your%20available%20time-,%22Billable%22,-This%20is%20a) system (standard/default) field is toggled on.

**"Total utilization"** is calculated by:
- total hours of Time Entries for the time period (e.g. 30 hours)
- divided by: (the weekly capacity of the User (e.g. 40 hours), minus their Time Entries with the "Time Off" field toggled on (e.g. 8 hours))
- multiplied by 100 to make a percentage
- So in this example, it would be (30 / (40-8) ) x 100 = 93.75% of available hours were utilized

**"Billed utilization"** is calculated by:
- total hours of Time Entries where the "Billable" field is toggled on for the time period (e.g. 20 hours)
- divided by: (the weekly capacity of the User (e.g. 40 hours), minus their Time Entries with the "Time Off" field toggled on (e.g. 8 hours))
- multiplied by 100 to make a percentage
- So in this example, it would be (20 / (40-8) ) x 100 = 62.5% of available hours were billable

## Why use Utilization Tables?

Utilization Tables are especially useful for Managers who are reviewing the performance of their Team(s).

The Utilization percentage is calculated for you, and it's automatically color-coded for you to make it even easier to identify where there are potential issues - they'll be flagged for you in orange or red. You can then take action in response to that data.

Here are some typical use cases for Utilization Tables:

- If a particular User keeps having a very low percentage, should they be given more projects? Or perhaps are they forgetting to record some of their time as [Time Entries](https://help.planhat.com/en/articles/10559032-time-entry-data-model) - check in with them
- If a particular User keeps recording over 100% utilization, are they overworking (potentially at risk of burnout) and you should help them reduce this, e.g. by assigning any new projects to other Users? Or is their some inaccuracy in their Time Entries?
- If you have consistently low percentages across your team, are you overstaffed, or is there a Team-wide issue with colleagues not recording time spent?
- If there's a pattern of over-utilization across the Team, do you need an additional staff member so that you can bring that utilization down to a more manageable level?
- With Utilization Tables, it's easy for you to compare different teams (which could correspond to different geographical regions, or different customer tiers, for example), so you can identify if there is a particular issue (or success) in a specific Team

## How to set up a Utilization Table

The main steps are:

1. Choose between "Total utilization" and "Billed utilization"
2. Make any changes, if required, to "Period", "Timespan" and "Offset" - the default is to plot the last 8 weeks, including the current one
3. Optionally, apply a filter, e.g. if you would only like to view Utilization of Users within a specific Team

Within a [Dashboard or Presentation Page](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages), click on "Table Widgets" and then "Utilization"

You'll see a form that looks like this:

### In the "Setup" tab

- In **"Value"**, choose whether you'd like your Utilization Table to calculate and display "Total utilization" or "Billed utilization"
  - "Billed utilization" only looks at Time Entries where the "Billable" field is toggled on
  - You can view the full definitions (calculations) for both earlier in this article

- In **"Status"**, you can filter which Time Entries are included, based on the "Status" of their Timesheet (if they are associated with one)
  - You can read more about Timesheets in general [here](https://help.planhat.com/en/articles/10576193-timesheet-data-model)
  - The default is "Any" (i.e. nothing selected)
  - You can select one or multiple of "Submitted", "Approved" and "Returned"
  - You can easily deselect a Status by clicking the "x" next to its name in the box, or by clicking on its name in the dropdown menu
  - An example use case is that you may only want to display/analyze Time Entry records that are part of Timesheets that have been Approved by managers

- In **"Period"**, choose which time period you'd like the columns of the table to correspond to
  - The default is "week", and typically you'll leave it as this (so each column shows percentage utilization for a specific week)
  - You can change "week" to your choice of "month", "quarter", "fiscal quarter", "year" and "fiscal year"
  - The heading of each column in the table will always display the first date of that time period

- The number you specify for **"Timespan"** determines the number of columns shown - e.g. the number of weeks, if you have "week" selected in "Period"
  - In addition to this, you will always have a column displaying the "User" (or "Team" etc. if you add a grouping, described/shown later in this article), and a column displaying the "Average" utilization across all the time periods

- You can use **"Offset"** to move forward/backward in time, to change which weeks etc. are included in the table
  - In this type of chart it doesn't usually make sense to look into the future via negative numbers (because you log time when it's passed, rather than before it happens)
  - ... but you can enter a positive number here to move the date range backwards by removing the most recent column(s) from the Utilization Table

- In **"Columns Preferences"**, you can either leave this set to show the "Default" columns, or click to open up the "Manage Table" modal and add more columns (User fields/properties) for additional context. (You can read more about choosing columns in our general article [here](https://help.planhat.com/en/articles/10057893-table-preferences-in-upgraded-planhat))
  - Note that that these additional User field columns are not applicable if you group the table (see next bullet point)

- The typical use case for **"Table Group by"** (which is blank by default) is to select "Teams", and then the rows of the Utilization Table will change from Users to Teams (e.g. the EMEA Team, the APAC team, and so on)
  - Note that this makes each row a group - so it's not like a [Grouped List](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages#h_ed3ca52006)

- If you've chosen to "Group by" in this way, you'll see a dropdown menu underneath called **"Table Group by options"**, where you can choose between "Ascending" (the default) or "Descending"
  - You configure Teams (their names and which Users are in them) within the ["Settings" Global Tool](https://help.planhat.com/en/articles/10183936-global-tools-for-admins-settings)

- If you don't have anything selected for "Table Group By", you will see two additional dropdown menus underneath:
  - In **"Table Sort By"**, you choose how you want to sort (order) the rows - "First Name" of the User is the default
  - In **"Table Sort By"**, you can switch between "Ascending" (the default) or "Descending"

- In **"Name"**, you can optionally enter a title for your Utilization Table, which will display within the Widget
  - An alternative, particularly relevant for [Presentation Pages](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages#h_0d928a1b04), is to use a separate simple Text Widget if you would like different formatting options

- In **"Description"**, you can optionally add a description for your Utilization Table
  - This will show in the Widget as a tooltip on an "i" icon
  - An alternative could be to use a simple Text Widget for this

### In the "Customization" tab

In Utilization Tables, there's a single option here: a checkbox for **"Hide items without utilization"**
- This removes rows corresponding to Users or Teams (depending on how your Utilization Table is configured) that don't have any time tracked
- This is a quick and easy way to "clean up" your Utilization Table by removing unnecessary rows

### Applying filters

If you would like to apply a filter, click the "Add filter" button in the top right of the Utilization Table preview, opening up this modal:

- A typical filter you might apply in a Utilization Table is "Teams is equal to Team X"
- This can be useful if you manage that Team and so would like to review its utilization
- You could also potentially build multiple Utilization Tables in a Page with different Team filters applied, so you can easily compare the utilization of different Teams (e.g. corresponding to different regions)
- Click the orange "Save" button to apply your filter

When you've finished configuring your Utilization Table, click the orange **"Save Widget"** button in the bottom right

## Pro tips

### Viewing Time Entry records

When you're viewing a Utilization Table, you can click on any of the cells to view the component [Time Entries](https://help.planhat.com/en/articles/10559032-time-entry-data-model) that have contributed to that percentage.

So, for example, if you are looking at the Utilization Table and see that a user has 103.7% utilization for a specific week (shown in a red cell), you can click on that cell to open up the list of Time Entry records, so you can see the details, and check if anything looks obviously "wrong" (e.g. potentially entered incorrectly).

### Including Utilization Tables in Pages

If you'd like to include Utilization Tables in [Dashboard or Presentation Pages](https://help.planhat.com/en/articles/10067346-graphically-displaying-data-presentation-and-dashboard-pages), you could either:

- create a Page from scratch,
- or use one of our "Planhat Global Templates" (in the "Pages Library"), also known as "Community Templates" --> "Page Templates"

We have a Page Template called **"Utilization and Staffing"** that you're sure to find very useful!

Once you have applied a Page Template, you can then customize it if required

The screenshots below show the two alternative methods to access the Service Delivery Page Templates.

- In [Content Explorer](https://help.planhat.com/en/articles/10155043-content-explorer)
- When adding a Page to a [Section](https://help.planhat.com/en/articles/10102778-organizing-content-pages-sections-and-libraries#h_bfd6ec57ce) and selecting ["Browse Planhat Global Templates"](https://help.planhat.com/en/articles/10102923-page-types-in-upgraded-planhat?q=section#h_f70e515fc1)