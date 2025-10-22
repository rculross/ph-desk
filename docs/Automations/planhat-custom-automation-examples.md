# Custom Automations worked examples

## Summary

- In Planhat, you can build Automations to automate actions - move/send data, create tasks, send notifications and more
- Planhat provides a library of Templated Automations, but you can also create Custom Automations
- This article talks you through a variety of Custom Automations, so you can see various components in practice

## Who is this article for?

Planhat Users who are building Custom Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- Custom Automations worked examples ⬅️ You are here

## Article contents

- (A) When a Workflow is created, "Get" data from the related Company, and save it on the Workflow - Example of cross-model data transfer; Example of a "Get" step
- (B) When a specific Workflow is archived and the associated Company is in a specific segment, change the Company Owner to a named User - Example of "trigger filtration"
- (C) When Company changes Phase, save today's date in a custom field - Example of date/time replacement code; Example of "trigger filtration"
- (D) When a Company is added to a filter (date deadline approaches), create a task and send a notification - Examples of task and notification steps; Example of date/time replacement code; Example of custom message
- (E) When End User is added to a filter, "Get" data from its related Company, then "Get" data from the Company's related Users, then send a public Slack message - Example of multiple "Get a single record" steps; Example of sending a custom Slack message
- (F) When an Opportunity is marked as "lost", create a review task - Example of a different model triggering an Automation; Example of a "Get" step; Example of a task step

## Introduction

[Automations](https://help.planhat.com/en/articles/9587240-automation-overview) are a fantastic way that you can automatically respond to changes in data, taking action without delay.

Planhat provides a library of configurable [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations), covering a variety of use cases, but you can also build completely [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations).

In this article, we take you through some examples of Custom Automations, explaining the different components in detail. These examples will help you better understand how Custom Automations work, and give you some inspiration for when you build your own.

🚀 **Tip**

As well as the worked examples in this article, you can also find worked examples ...

📌 **Important to note**

If you can create a [Templated Automation](https://help.planhat.com/en/articles/9587153-templated-automations) rather than a Custom Automation for your use case, that's preferable, as it would be even quicker and easier.

📌 **Important to note**

This worked examples article assumes you have already read the [Custom Automations article](https://help.planhat.com/en/articles/9590728-custom-automations) and are familiar with its contents. Note the [practical tips](https://help.planhat.com/en/articles/9590728-custom-automations#h_2727578ea3) at the bottom of that article. There are also additional technical articles if you would like further details, such as one on ["Get" steps](https://help.planhat.com/en/articles/11162604-get-steps-in-automations) and one on [replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations).

🚀 **Tip**

You can click on the images in this article to view them enlarged.

## (A) When a Workflow is created, "Get" data from the related Company, and save it on the Workflow

**Example of cross-model data transfer from the Company model "down" to a record of another model; example of a "Get" step**

In the hierarchy of Planhat [data models](https://help.planhat.com/en/articles/9587119-data-models), the Company model is at the top, with other models (e.g. End Users, Licenses, Opportunities and Workflows etc.) linking to the Company. You might initially think you can move data from a Company to an associated Workflow (for example) using a cross-model [Formula Field](https://help.planhat.com/en/articles/9586968-formula-fields-overview). However, while you could use a Formula Field to roll data from a model "up" to the Company, this isn't possible in the other direction.

Automations come to your rescue in this case, as you can use them to transfer data between any models. So what could this sort of Automation look like?

In this example, let's say we have an custom field (of type End User or Text - we discuss the implications of this later on in this example) on the Company [model](https://help.planhat.com/en/articles/9587119-data-models) for the "Scheduling Contact", and when a [Workflow](https://help.planhat.com/en/articles/9587102-workflows-overview) is created, we want to save this to a custom field on that specific Workflow.

🚀 **Tip**

In upgraded Planhat (ws.planhat.com), you create and manage fields in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data). You can also learn more about creating custom fields [here](https://help.planhat.com/en/articles/9587045-how-to-create-custom-fields).

### Trigger

The trigger in this case is "Workflow created". We'll select "created with anything", as we want this to apply to all Workflow records. We don't need to define trigger filtration in this case.

### "Get Company" step

In order to get the "Scheduling Contact" from the Company record associated with the Workflow record, we need to identify and retrieve that Company record, so we have access to all its fields. We do this using a ["Get" step](https://help.planhat.com/en/articles/11162604-get-steps-in-automations).

Where does `<<object.companyId>>` come from? This is an example of a [replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations). These are dynamic references. What do we mean by that? Let's break it down.

- `object` refers to the record in the Automation trigger. So in this case, as the trigger is "Workflow created", it will refer to the specific Workflow that was created and set off the Automation
- `companyId` is a property on this Workflow, which was retrieved when the Automation was triggered. We need to state this property exactly as-is - i.e. with this capitalization

Bringing this together, `<<object.companyId>>` in this step tells the Automation to find the `companyId` of the Workflow that was just created, and then fetch all the details of that Company - including the values of all the properties/fields on it. We can then reference these in the next step.

The great thing about dynamic references is that the actual values of these references can be different each time the Automation is run, depending on the Workflow, the Company, and the field values at that time.

You'll also see in the screenshot above that we have renamed this step from the automatically assigned random name to "Step 1".

### "Update Workflow" step

Now we've got the details of the associated Company record, we have the value of its custom Company Scheduling Contact field, and we can copy that into a custom field that we've already created on the Workflow model. We update the newly created Workflow with this value we've just got from its Company.

You can't see it fully in the screenshot above as the names are truncated in the boxes, but in the second line in the "Fields" section above:

- The left-hand box is "Workflow Scheduling Contact", a custom text field on the Workflow model

📌 **Note:** At time of writing, it's not possible to select a field of type End User here, which is why we are using a text field

The dynamic reference in the right-hand box varies slightly depending on the type of field on the Company model/record we're extracting data from:

- `<<Step 1.custom.Company Scheduling Contact>>` if "Company Scheduling Contact" is a text-type field
- `<<Step 1.custom.Company Scheduling Contact.name>>` if "Company Scheduling Contact" is an End User-type field

Let's go through this step in more detail:

- `object` refers to the record in the Automation trigger. So in this case, as the trigger is "Workflow created", it will refer to the specific Workflow that was created and set off the Automation (like you saw in the previous step)
- `_id` is the Planhat ID of the record, so in this case it's the Workflow that triggered the Automation. All we're really saying in `<<object._id>>` is that the Workflow we want to update (the action of this step) is the Workflow that triggered the Automation
- `Step 1.custom.Company Scheduling Contact` is referring to the value of the custom field "Company Scheduling Contact" that we retrieved in Step 1, when we got the Company record. To refer to a custom field in the replacement code, we start with `custom.` and then state the name of the field exactly as we see it, including spaces and capitalization

OR,

- `Step 1.custom.Company Scheduling Contact.name` (note the "name") should be used instead, if the "Company Scheduling Contact" field is of type End User rather than type text. This is because of how the data contained in that field is retrieved in Step 1 (the [Get step](https://help.planhat.com/en/articles/11162604-get-steps-in-automations)), can be viewed in the [logs](https://help.planhat.com/en/articles/9587341-automation-logs-and-troubleshooting). For the End User field we need to effectively go down another level to select the sub-property within the field, which is why we add another "." and then state the name of the sub-property we want to retrieve
- Remember that we renamed the previous step to "Step 1", which is how we can refer to it as "Step 1" in these replacement codes

Overall, what this step is saying is we want to update the Workflow that was just created, and specifically we want to populate the custom field on it called "Workflow Scheduling Contact", with the value from the custom field "Company Scheduling Contact" that's on the associated Company record.

🚀 **Tip**

This Automation populates a custom field on Workflows. To see the field on Workflow records, either ensure it's shown as standard via [Field Groups](https://help.planhat.com/en/articles/10206501-field-groups), or click "+ Show Full List".

## (B) When a specific Workflow is archived and the associated Company is in a specific segment, change the Company Owner to a named User

**Example of "trigger filtration"**

Now let's see an example of trigger filtration in action.

In this case, when our "Onboarding" Workflow is completed (archived), and the Company completing it is in a specific segment (Enterprise), we want to automatically change the Company Owner to Bob, who is responsible for Enterprise Companies once onboarded. How can we do this?

### Trigger

We want the Automation trigger to be when a Workflow record with the [Template](https://help.planhat.com/en/articles/9587339-creating-workflow-templates) "Onboarding" is archived. We start by selecting that we want the Automation to be triggered when a Workflow is "updated with specific properties".

Then, we can either build the specific trigger criteria directly in the Automation (the preferred option if we won't need to apply these criteria elsewhere), or we can create a [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) (in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data)) with these criteria if we'll want to apply the filter elsewhere. In this case, we'll create them directly in the Automation. With these criteria, we specify that the Automation will be triggered when a Workflow of the "Onboarding" Template is archived.

In this example, we also want to apply trigger filtration, so that only Workflows associated with Companies in the Enterprise tier/segment (a custom field) trigger the Automation. In this case, we have already created a [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) on the Company model in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data), so here we can simply select that, after specifying it's a Company filter.

So putting it all together, our trigger looks like this:

### "Update Company" step

Once triggered, the action we want to happen is that the "Owner" field on the Company is changed to Bob, who's a User (team member) in Planhat. We build the step as follows:

With `<<object.companyId>>` we specify that we want the Company that's associated with the Workflow that triggered the Automation. "`object`" is the Workflow record that's triggered the Automation, and "`companyId`" is a field on it that identifies the Company.

For the Owner field on the Company model, we can select "Owner" from the dropdown on the left, and "Bob" from the dropdown on the right.

That's it - that's the only actual step that we need.

(You may notice that in this example, we haven't changed the step name, so it's showing the random step name of "s-8pc".)

## (C) When Company changes Phase, save today's date in a custom field

**Example of date/time replacement code; example of "trigger filtration"**

We've seen replacement codes for properties (fields) on Planhat models, but we can also [reference dates dynamically](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations#h_d78dc426d9) in Automations too. One of the key use cases for this is date stamping when something happens.

For example, let's say we have five Company [Phases](https://help.planhat.com/en/articles/9587109-lifecycle-phases): (1) Pre-onboarding, (2) Onboarding, (3) Ready to Launch, (4) Launched, and (5) Established. We want to measure the time it takes to progress between different Phases, most importantly from (2) Onboarding to (4) Launched, which we are considering our Time To Value (TTV). How can we do this?

We can set up Automations, one for each Phase, that date stamps in a custom field when the specified Phase is entered.

We could then combine this with [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview) to look at the difference (in number of days) between pairs of custom date fields. This is very flexible as we can compare any two Phases.

### Trigger

We'll set up an Automation for each Phase we want to date stamp. We want the Automation to be triggered when a Company enters a specified Phase.

As an optional failsafe, we can add trigger filtration that means the Automation will only run if the specified custom field has not yet been populated. This means that this particular Automation will only run once per Company, so if you went back a Phase (maybe accidentally) it wouldn't overwrite the original date stamp for this Phase.

### "Update Company" step

Finally, let's build the action step.

In this case, `<<object._id>>` is referring to the Company that triggered the Automation. We're saying that we want to update that Company.

"Onboarding Start Date" is a custom field on the Company model, with a type of either "date" or "date time". You can read more about the difference between these field types [here](https://help.planhat.com/en/articles/9587266-date-and-time-in-planhat).

📌 **Important to note**

When you select a "date" or "date time" field on the left, such as "Onboarding Start Date" in the example above, the default for the cell on the right is a date picker, where you would pick a specific date.

In order to type in a dynamic replacement code instead, click on the symbol of two arrows in a circle (shown below) to switch to text. You can then start typing `<<` to see the replacement codes as usual.

`<<time.now>>` is a [dynamic replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) that saves today's date and current time. (Whether the time is displayed in the field or not depends on whether it's a "date" field or a "date time" field, as discussed [here](https://help.planhat.com/en/articles/9587266-date-and-time-in-planhat).)

🚀 **Tip**

`<<time.today>>` is a really similar replacement code, which also stamps today's date. However, the time saved will be 00:00:00 UTC. Often, this won't make any difference, but if you have teammates in different time zones, the time conversions may affect the dates shown in the UI.

You can see more date replacement codes [here](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations#h_d78dc426d9).

We can then repeat the steps above to create an Automation for each Phase we want to date stamp.

Once we have that data, we can use [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview) to count the number of days between any two.

## (D) When a Company is added to a filter (date deadline approaches), create a task and send a notification

**Examples of task and notification steps; example of date/time replacement code; example of custom message**

📌 **Important to note**

While this worked example illustrates a number of points, and it is not possible to create this exact Automation via a [Templated Automation](https://help.planhat.com/en/articles/9587153-templated-automations), you could make something similar by using a Templated Automation for "Schedule a Task when a Company enters a filter" (Template in the "Schedule An Activity" section") and a Templated Automation for "Send a notification when a Company enters a filter" (Template in the "Send a Notification" section). Remember to use an Automation Template if you can achieve your goal that way, rather than always building a [Custom Automation](https://help.planhat.com/en/articles/9590728-custom-automations) like we describe in this article.

You'll often have dates that you'll want to act in response to, such as the date a contract expires, the last date a subscription can be cancelled, the date of the next QBR, and so on. If all your Companies have these associated dates, it would be a lot of work to manually check all the dates and decide when you should take which action.

Maybe you're already a step ahead, and have at least created a [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) or a [filtered Page](https://help.planhat.com/en/articles/10063611-displaying-text-data-in-tables-data-table-grouped-list-and-board-pages) that looks at this date field - for example, a filter for Companies with a renewal date in less than 90 days. If so, great job!

But what comes next? What do you want to happen with these customers? And how should you automate those actions? Here we'll take the common scenarios of creating a task and sending a notification - both actions that can be carried out automatically via Automations.

Let's say for this specific example, our customers are based all around the world, and so different Companies have different fiscal (financial) year end dates. The end of the fiscal year is often when budgets are set, so it's important that our team is in touch with the Company around this time (regardless of when their contract expires), and gives them an indication of what the pricing for the upcoming year is going to look like, making sure the customer budgets correctly for our tool. When the end of the fiscal year is 60 days away, we want to notify the Company Owner (CSM), and also schedule a task for them to get in touch with the customer.

### Trigger

We want the Automation to be triggered when the fiscal year end date is 60 days away. In this example, we already have a custom field that stores the fiscal year end date on each Company.

Creating a [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) (in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data)) could be useful here - we could use it within the Automation but also in various other places in Planhat.

One way to set up this filter would be to first create a [Formula Field](https://help.planhat.com/en/articles/9586968-formula-fields-overview) to calculate the number of days until the fiscal year end date: `DAYS_DIFF(<<custom.Fiscal year end date>>, @today)`. Our filter on the Company model could then refer to this Formula Field.

Once we've set up this filter, we can also use it as our Automation trigger.

Now, when Companies enter the filter (as their fiscal year end date reaches 60 days), this Automation will be triggered.

In this specific example, we don't need to apply trigger filtration, but one example use case could be if we wanted to only apply this particular process to a specific group of Companies - for instance, because we wanted the Automation to trigger for one customer segment, but a [Workflow](https://help.planhat.com/en/articles/9587102-workflows-overview) to be applied instead for a different segment.

### "Create Task" step

When the Automation is triggered, one of the actions we want to take place is that a Task is scheduled for the Company Owner to call the Company.

We set up a "Create Task" step like so. The first couple of fields (grayed out) are default and need to be completed; to add the others, keep clicking on "+ Add field".

You may be thinking that there are quite a few fields here, so let's go through each one in turn:

- In the first line, we've specified that this is a task. (An "event" - the other option - is more commonly associated with a calendar integration)
- For "Company Id", we use the [replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) `<<object._id>>`. The "object" in this case is the Company record that's in the trigger. The "`_id`" is the Planhat ID of the Company. In this line, we're just saying we want to create a task associated with the Company record that triggered the Automation (i.e. that came into the filter because their fiscal year end is 60 days away)
- The "Owner" of the task is `<<object.owner>>`. This is referring to the "Owner" system (default) field on the trigger model/record, which is the Company, as we've just seen. (Remember that you can check the names of fields such as this in the [Automation logs](https://help.planhat.com/en/articles/9587341-automation-logs-and-troubleshooting) "Event details", the ["Fields" tab](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_1be637430f) of the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data), or our [API documentation](https://docs.planhat.com/))

📌 **Important to note**

When you select Owner on the left, the default for the cell on the right is a Planhat User (team member) picker.

In order to type in a dynamic replacement code instead, click on the symbol of two arrows in a circle to switch to text. You can then start typing `<<` to see the replacement codes as usual.

- "Action" is the title of the task. Here, we free type what we want the task title to be, such as "Call Company before end of fiscal year" in this example. We'll see this task title when viewing tasks in the ["Calendar" Home feature](https://help.planhat.com/en/articles/10126664-calendar) or a Company [Full-Page Profile](https://help.planhat.com/en/articles/10199767-an-introduction-to-full-page-profiles)
- "Type" is the default [Conversation Type](https://help.planhat.com/en/articles/9587095-conversation-types) of the task. The right-hand box for this line is a dropdown menu of Conversation Types to select from. We select a custom Conversation Type that best matches the task - in this example, we had previously created a custom Conversation Type called "Fiscal year end review", and select that. An advantage of using a specific Conversation Type is that this categorization can help us more easily track both planned and logged activities, if we want to analyse how the team is actioning these specific types of tasks
- If we didn't specify a due date for the task, it would appear in Planhat with the due date of "Someday", rather than informing the CSM when this needs to be done. In this example, we want to make sure the task happens soon, and so we want it to have today's date - we do this by specifying "Start Date" to be `<<time.today>>`. (Recall that there are a range of [dynamic date replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations#h_d78dc426d9) we could use. Other options include `<<time.tomorrow>>`, `<<time.next working day>>` and `<<time.in a week>>` - start typing `<<time.` to see further possibilities)

📌 **Important to note**

When you select a "date" or "date time" field on the left, such as "Start Date" in this example, the default for the cell on the right is a date picker, where you would pick a specific date.

In order to type in a dynamic replacement code instead, click on the symbol of two arrows in a circle to switch to text. You can then start typing `<<` to see the replacement codes as usual.

📌 **Important to note**

At time of writing, in upgraded Planhat (ws.planhat.com), for the Task [model](https://help.planhat.com/en/articles/9587119-data-models) you can choose from "Start Date" and "End Date" default (system) fields; there is no "Due Date" system field. You can think of "Start Date" as equivalent to "Due Date", like we have done in this example, or you could potentially create your own custom "Due Date" field if you prefer.

### "Send Notification" step

In this example, we also want the Automation to send a notification, to alert the Company Owner. The type/format of this notification can vary - it could be a notification in Planhat itself (showing in the ["Notifications" Home feature](https://help.planhat.com/en/articles/10131521-notifications)), an email notification, a Slack notification and/or a desktop notification. The format will depend on how each individual user has set up their notification preferences. Remember that you (and each of your teammates) can configure these for yourselves via the "Notifications" tab of your User Profile, which you can navigate to by clicking on your name in the top right of your Planhat tenant and selecting "Profile".

In this Automation, we create a "Notify User" / "Send Notification" step like so:

The first thing to note is that the "User" in this case is a user of Planhat, i.e. you and your team members. This is different than the "End User" [model](https://help.planhat.com/en/articles/9587119-data-models) in Planhat, representing people who are your customers/prospects.

In the "From" part of this step, we specify that the User we want to notify is the one in the Owner field on the Company model. (Other default and custom options are available to choose from via dropdown if required.)

Next, we have the "Message" box, where we can write a custom message for the notification. In this case, we choose "End of fiscal year for Company `<<object.name>>` is coming up soon!"

Note that there's a [replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) in the message, demonstrating that the notification text can include dynamic data. `<<object.name>>` is referring to the Company name - remember that the record triggering this Automation is a Company, and "name" is a system field on the Company. Therefore, if the Company triggering the Automation is Intercom, the notification will read "End of fiscal year for Company Intercom is coming up soon!"

## (E) When End User is added to a filter, "Get" data from its related Company, then "Get" data from the Company's related Users, then send a public Slack message

**Example of multiple "Get a single record" steps in an Automation; example of sending a custom Slack message**

📌 **Important to note**

While this worked example illustrates a number of points, and it is not possible to create this exact Automation via a [Templated Automation](https://help.planhat.com/en/articles/9587153-templated-automations), you could make something similar by using the Automation Template "Send a notification when an End User enters a filter" (in the "Send A Notification" category). Remember to use an Automation Template if you can achieve your goal that way, rather than always building a [Custom Automation](https://help.planhat.com/en/articles/9590728-custom-automations) like we describe in this article.

In the previous example, the data change that triggered the Automation was on a record of the Company model, and the data on that Company was enough to create the task and notification. But sometimes, you'll need to gather information from other models. What could this look like in practice?

In this example, End Users are classified into types, such as "Champion". We want to post to a public Slack channel when an End User is assigned this label. It could be that the Slack message notifies Marketing that this End User could be a good person to request a review or case study from, for example; or maybe we just want to let the Customer Success team know. Either way, we would like to include the names of the Company Owner and Co-Owner in the message.

📌 **Important to note**

You will need the [Slack integration](https://help.planhat.com/en/articles/9587085-setting-up-the-slack-integration) to be connected/enabled in your tenant to be able to add a "Send a Slack message" step in your Automations.

📌 **Important to note**

In this example, we have renamed each of the steps from the randomly generated names ("s-OFn" etc.) to "Step 1" and "Step 2" etc. for clarity. Remember that [replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) referring to steps should always use the specific step names in your own Automation.

### Trigger

We want the Automation to be triggered when the End User has been labelled as a specific type. Let's say we have a custom multipicklist field called "Contact Type" on the End User model. We use this to assign personas to End Users, such as "Technical Contact" or "Standard User". One of the possible options is "Champion", and that's the one we want to focus on here - we want the Automation to be triggered when an End User becomes a Champion. A great way to achieve this is by creating a [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) on the End User model (in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data)), where "Contact Type is any of Champion".

We use this filter as the trigger of our Automation.

### "Get" steps

As a reminder, [Get steps](https://help.planhat.com/en/articles/11162604-get-steps-in-automations) are steps where you want information for an action that's not in the trigger model/record, and so you need to retrieve it separately. This is possible by following relationships between models/records. It's easier to understand when seeing practical examples, and fortunately this Automation contains a few!

We want to retrieve the Owner and Co-Owner of the Company of the End User. Owner and Co-Owner are system (default) fields on the Company.

Our first Get step therefore retrieves the Company of the End User that triggered the Automation.

Because it's a record of the End User model that triggers the Automation, "`object`" in the replacement codes in this Automation refers to this End User.

We use the replacement code `<<object.companyId>>` in Step 1 to refer to the system field "`companyId`" on the End User. In Step 1, we retrieve the Company associated with the End User, including all the fields on that Company - including the system fields "`owner`" and "`coOwner`".

Our next Get steps refer to this Company record from Step 1, and retrieve the details of the Owner and Co-Owner, as User records. The reason we need to do this is that the system fields "`owner`" and "`coOwner`" on the Company record just contain the Planhat IDs of the Users (you can view this in the [Automation logs](https://help.planhat.com/en/articles/9587341-automation-logs-and-troubleshooting)), and so for our Slack message (in the next step) we need to extract the system fields "`firstName`" and "`lastName`" from the User records. (Remember that User is a Planhat model that refers to users of Planhat - i.e. you and your teammates.)

In the replacement codes, we use "`Step 1`" to refer to the record we retrieved in Step 1, i.e. the Company. Remember that in this example, we renamed the step. You need to use the step name exactly, so if you create another Automation like this and the step name is different, ensure you use that step name in the replacement code (or, of course, rename it to Step 1).

We have now gathered all the data we need for our Slack message.

### "Send Slack message" step

For the final step, we select "Send Slack message". As we already have [our Slack connected to Planhat](https://help.planhat.com/en/articles/9587085-setting-up-the-slack-integration), we have a dropdown list of Slack channels to choose from.

We can now fill in the "Message" box, similar to the previous example. As before, we can custom-write the text to be included in the message. We use more [replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations):

`<<object.name>> at <<Step 1.name>> is now a Champion. The Company Owner is <<Step 2.firstName>> <<Step 2.lastName>> and the Co-Owner is <<Step 3.firstName>> <<Step 3.lastName>>.`

- `<<object.name>>` is referring to the "name" system field/property on the End User record that triggered the Automation
- `<<Step 1.name>>` is referring to the "name" system field/property on the Company record in Step 1
- `<<Step 2.firstName>>` and `<<Step 2.lastName>>` are together referring to the name of the Company Owner (from the User in Step 2)
- `<<Step 3.firstName>>` and `<<Step 3.lastName>>` are together referring to the name of the Company Co-Owner (from the User in Step 3)

Remember that these replacement codes are dynamic, so they get populated with the relevant data whenever the Automation is triggered. In this case, when we fill in example names, the Slack message posted comes out as:

Adam Smith at Barnett Biosciences is now a Champion. The Company Owner is Ravi Kumar and the co-owner is Katie Cheung.

The text in the "Message" box is completely custom, so if you would like slightly different phrasing than this example, it's easy to change it.

🚀 **Tip**

You can start typing `<<` in the "Message" box to see the list of available [replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations).

The completed Automation looks like this:

🚀 **Tip**

In this example, the custom message posted to a public Slack channel was plain text, but it is also possible to format your Slack message in a variety of ways. Check out [this separate article](https://help.planhat.com/en/articles/9587101-slack-text-formats-in-automation-messages-bold-italic-strikethrough-mention-users) for details of formatting your Slack messages.

## (F) When an Opportunity is marked as "lost", create a review task

**Example of a different model (not Company or End User) triggering an Automation; example of a "Get" step; example of a task step**

Sometimes, you'll want to take action involving other Planhat [models](https://help.planhat.com/en/articles/9587119-data-models); a typical example is the Opportunity model. Automations are flexible in that they can be used with a wide variety of models (whereas, at time of writing, [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview) - another way you can automate actions in Planhat - are triggered by and apply to the Company or End User model).

### Creating an Opportunity via an Automation

There could be various positive signs within your data - for instance, on a Company level, it could be a high [Health Score](https://help.planhat.com/en/articles/10045917-configuring-health-scores-and-success-units-in-upgraded-planhat) or CSM score, high or increasing usage, having End Users labelled as Champions or Advocates, great average CSAT survey responses, and so on. Using Planhat, you can automatically detect and respond to these, so you don't miss an opportunity for upsell/expansion (or a case study etc.).

For example, you could:

- Create a [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) that matches Companies that have any of these positive indicators, which is your group of happy customers. You could then set up an Automation that creates an Opportunity when a Company enters this filter - this is something you could build via a [Templated Automation](https://help.planhat.com/en/articles/9587153-templated-automations)
- There are also [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations) that are more direct/specific in their trigger, e.g. creating an Opportunity when the Health Score climbs above 8
- If you want additional customization (e.g. you want to populate custom fields on the Opportunity), or you want additional actions in the Automation (e.g. to send a Slack message at the same time), then you could create a [Custom Automation](https://help.planhat.com/en/articles/9590728-custom-automations) instead of using a Template

### Triggering an Automation by a change in an Opportunity

Another way Automations can involve the Opportunity model is if they trigger the Automation rather than being in the action/result. For example, when an Opportunity is saved with the status of "lost", you might want a task to be created, for the Company Owner or Co-Owner to review what went wrong and record the details, so you can learn from it and work to prevent that happening again in future. This could be accomplished with a Custom Automation - this is what we'll show in this Automation example.

Here, we will combine some elements from previous Automation examples: gathering information using a Get step, and creating a task. We'll also discuss some of the choices/options in the different steps.

### Trigger

In this case, we want the Automation to be triggered when an Opportunity Status (system field) is set to "lost". As usual, there are different ways we could accomplish this. If we want a Global Filter on the Opportunity model to group these lost Opportunities, we could easily set this up - "Status is equal to lost". We could then use this filter as our Automation trigger.

Alternatively, we could build this rule directly into the Automation trigger - that's what we'll do here.

Here, we've chosen "created or updated" to ensure we include all lost Opportunities.

### "Get" step

In this Automation, the record triggering the Automation is an Opportunity. In response, we want to create a task. Who do we want the task Owner to be?

- If it's the Owner of the Opportunity, we can use `<<object.ownerId>>`, without requiring a Get step.
  - Remember that "`owner`" is a field on the model/record that triggered the Automation, so in this case it's the specific Opportunity that was lost
- However, if the responsibility to carry out the lost Opportunity review task is the Company Owner or Co-Owner, we'll need a Get step to retrieve the Company associated with the Opportunity, before we can feed that retrieved Company info into the task. We'd also need this Get step if we wanted to gather any other information from the associated Company to add to the task
- In this example, we use a Get step with `<<object.companyId>>` to retrieve the Company that's referenced on the Opportunity that triggered the Automation

### "Create Task" step

Once we've got the Company information if we need it, we can now create the task step. This will be very similar to what we saw in worked example (D). As before, the first couple of lines (where it's grayed out) are automatically created for us to fill in, and for any others we want, we keep clicking "+ Add field". The completed task step would look something like this:

- Its main type is "task" (rather than "event")
- For the "Company Id", we can use `<<object.companyId>>`, which is a default property on the Opportunity that triggered the Automation. Here we're saying that the task should be associated with the Company linked to the Opportunity that triggered the Automation
- For "Owner", this could potentially vary depending on who we want the task owner to be (as discussed above). In this case, we want it to be the Co-Owner from the Company we retrieved in the Get step. In this example, the Get step has been assigned the random name "s-OFn", and we haven't renamed it, and so we use `<<s-OFn.coOwner>>` as the replacement code, "`coOwner`" being a system field on the Company retrieved in that step. Alternatively, if we had skipped the Get step because we just want to use the Opportunity Owner, this could be `<<object.ownerId>>`
  - Recall that the default for fields like this is actually a User (team member) picker, so to be able to type in the `<<` code, click on the symbol of two arrows in a circle to change the cell to text
- Remember that the task "Action" is the title of the task, so we enter a name here that will make it clear in the task list (in the ["Calendar" Home feature](https://help.planhat.com/en/articles/10126664-calendar) and the Company [Full-Page Profile](https://help.planhat.com/en/articles/10199767-an-introduction-to-full-page-profiles)) what the task is
- For "Type", we've again created and selected a custom [Conversation Type](https://help.planhat.com/en/articles/9587095-conversation-types) for this specific task, which makes it easier to view and analyze - e.g. if we wanted to filter logged activities (Conversations) in a Company Full-Page Profile to see all of the Lost Opportunity Reviews
- For the task "Start Date", we've used the replacement code `<<time.next working day>>`
  - Remember there are a range of ["time" replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations#h_d78dc426d9) we could use here
  - Recall that the default for fields like this is actually a date picker, so to be able to type in the `<<` code, click on the symbol of two arrows in a circle to change the cell to text