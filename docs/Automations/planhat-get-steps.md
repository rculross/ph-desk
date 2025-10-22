# "Get" steps in Automations

## Summary

- "Get" is a type of step you can use when configuring Custom Automations
- You use Get steps to retrieve data from a record related to the record in the Automation trigger or another step - so, for example, an End User could trigger an Automation, and then a Get step could retrieve its related Company
- You use replacement codes to specify the mapping reference (e.g. the "companyId" field on the trigger record)
- It's possible for a Get step to retrieve multiple records rather than a single record
- You can use the data gathered from Get steps in subsequent Automation steps

## Who is this article for?

Planhat Users who are building Custom Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- "Get" steps in Automations ⬅️ You are here

## Article contents

**This is a technical deep-dive article**

Read on if you'd like to learn about Get steps - a type of step you can use when configuring Custom Automations. Ensure you [read our article on Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) before this one, so you are familiar with the context of where these Get steps can be used.

If you would simply like a general introduction to Automations, check out our overview article [here](https://help.planhat.com/en/articles/9587240-automation-overview).

## What are Get steps?

A "Get" step is a type of action step that you can include when configuring a [Custom Automation](https://help.planhat.com/en/articles/9590728-custom-automations). (Get steps may be running "behind the scenes" in [Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations) too, but they wouldn't be visible in the UI or configurable by you in that case.)

Click the image to view it enlarged

In a Get step you can retrieve either a single record (the most common setup you'll use) or multiple records:

Using Get steps, you have the option to retrieve records from whichever [model](https://help.planhat.com/en/articles/9587119-data-models) you like (see the model dropdown in the screenshot below) - as long as it's referenced in the trigger or a previous step. So, for instance, in the example Automation screenshot at the top of this article, the trigger involves the Opportunity model, which has the system (default/custom) field "companyId", so when a specific Opportunity triggers the Automation, we can look at this field on this Opportunity record to identify the Company it's connected to, and use retrieve the data of that Company. We discuss this topic in further detail in the ["How" section below](#how-to-set-up-get-steps).

📌 **Definitions**

- **Model** - Planhat [data models](https://help.planhat.com/en/articles/9587119-data-models) are Company, End User, License, Opportunity, and so on. You can think of them as like containers for data
- **Record** - data within those models - e.g. if Company is the model, then BMW, Microsoft and Nike could be records; and if End User is the model, then Katie Chambers, Jason Bendefy and Sally Peters could be records

## Why use Get steps?

Get steps are used to retrieve related records (from related models) - they are how you can gather extra data to use in subsequent steps.

This is a bit easier to understand when we go through practical examples, so let's use the one in the example Automaton we saw earlier - here it is again (with the Get step showing in the configuration panel on the left-hand side):

Click the image to view it enlarged

What this Automation is configured to do is:

1. When an Opportunity record is updated with specific properties (e.g. the Opportunity to sell Module A to Company "Radleys" is marked as "lost")
2. Get the Company referenced in that Opportunity (in this case: Radleys)
3. And create a specific Task for that Company (i.e. an "Opportunity Review" Task associated with Radleys), and make the Owner of the Task the Owner of that Company (using data you retrieved from the Get step)

As you can see from the example, Get steps follow references between models/records - so in this case, because the Opportunity model/record contains a reference to the Company model/record, we can get the data for the linked Company record, and then use the data from that Company in subsequent steps.

Let's look at another example - this one has multiple Get steps that each retrieve a single record:

Click the image to view it enlarged

In this example, what's happening in the Automation is:

1. When an End User record is added to a filter (e.g. the End User "Carolyn Booth" is assigned the Role "Champion" and so moves into the "Champions" folder)
2. Get the Company record referenced in that End User record (e.g. the Company "Zoom")
3. Get the User record (user of Planhat - i.e. you and your teammates) that's referenced in the Owner field on that Company record (e.g. Louis Monet)
4. Get the User record (of Planhat - i.e. you and your teammates) that's referenced in the Co-Owner field on that Company record (e.g. Antonio Califano)
5. Post a message in a Slack channel, using all the information you have gathered (e.g. "Carolyn Booth from Zoom is now a Champion. The Company Owner is Louis Monet and the Co-Owner is Antonio Califano.")

[Later in this article](#getting-multiple-records) we also go through an example of an Automation where a single Get step retrieves multiple records:

1. When the Co-Owner field on a Company record is populated or updated
2. Get all the Workflow records associated with that Company
3. Update all of these Workflows with the Co-Owner

Click the image to view it enlarged

📌 **Important to note**

In September 2025, the UI for "Get multiple" steps was enhanced to make it even easier to use. The screenshot above shows the current UI. If you have an Automation with a "Get multiple" step created before this change, it will have the previous UI, including a "query" section.

## How to set up Get steps

When you are configuring (creating or editing) a Custom Automation (see [here](https://help.planhat.com/en/articles/9590728-custom-automations) for general information on how to do this), you can select "Get" in any step after the trigger:

Click the image to view it enlarged

Once you've selected "Get", you choose whether you want the step to retrieve a single record or multiple records, and select which model you'd like to retrieve records from.

📌 **Important to note**

Remember that you should select a model that's referenced in your trigger or a previous step. For example, in the screenshot above, the model in the trigger - End User - has a field "companyId" that references the Company record that the End User record is linked to, so you can use this to "Get" the Company, as we describe below.

### Getting a single record

📌 **Important to note**

"Get" steps work by:

1. Looking at a record that's been retrieved (in the trigger or a previous step, e.g. an End User)
2. Looking at a field on that record that refers to a different record (e.g. a field on the End User referring to its Company)
3. Retrieving that referenced record (getting the Company referenced by the End User)

As the Company model is central/top of the hierarchy in Planhat, with most other models relating to Company, you will most commonly find Get steps that reference Companies like this.

If you want to follow a link between models that don't have a built-in reference like this (e.g. if an Asset triggers the Automation and you want to "Get" its related Project), you will need to use a custom field (e.g. in this example, you'll need a custom field on the Asset model/record containing the associated Project ID).

📌 **Important to note**

You use a [replacement code (dynamic reference)](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) to specify which record you want to "Get" - how that record is identified. The code specifies whether your starting point is the model/record in the trigger or one retrieved in another step, and then which field on that model/record contains the reference to the other model/record you're getting.

For example, `<<object.companyId>>` is a very common replacement code used when getting a single Company - it says to look at the "companyId" field on the trigger model/record (which could be e.g. the End User that triggered the Automation) to identify which Company record is connected to that trigger record (e.g. that End User).

If you "Get" a record referenced in an action step (rather than a trigger), your replacement code will reference the specific step name (instead of "`object`"), e.g. `<<Step 1.owner>>`.

Firstly, we're going to take the example of retrieving a single record (e.g. a single Company in the screenshot example above).

In the configuration panel, next to "id" (grayed out because it's mandatory - see the screenshot below), you should specify the ID of the record you want to retrieve, which is referenced on the trigger record, using the relevant replacement code.

In the example shown below, we use the replacement code `<<object.companyId>>`, which means the Automation will look at the record in the trigger (in this case, the End User that was added to the specified filter, e.g. Kerry Smith), and look specifically at the "companyId" system (default/standard) field on that record (which will contain a Planhat ID for a Company), and then "Get" the data for that Company record (e.g. Mars), including all its fields.

As this Automation's trigger is "added to a filter", you can actually see the whole trigger record in the "event details" in the [Logs tab](https://help.planhat.com/en/articles/9587341-simple-automation-troubleshooting-with-execution-logs), including the field we are referring to in this replacement code:

As with other dynamic replacement codes, you need to refer to the field exactly (i.e. with correct spelling, capitalization and spacing), using the API name rather than the label name if it's a system (default/standard) field. As well as the logs event details shown above, you can check the field names in our [API documentation](https://docs.planhat.com/#planhat_models) and (in some cases) in the "Fields" tab of the ["Data Model" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data).

In the step example above, the replacement code starts with "`object`" because it's referring to the record in the trigger, but you can also refer to other steps in Get steps, meaning you can even get from a Get step! We can see this in the next step example:

Click the image to view it enlarged

In this Automation, we want the last step to be a Slack message that includes the name of the Owner of the Company. The Company retrieved in Step 1 (a Get step) has an "owner" field, but instead the the name, this field contains the Planhat ID of the User record ("User" being the model that represents users of Planhat - i.e. you and your colleagues), as shown in the screenshot below of Step 1 in the [Automation logs](https://help.planhat.com/en/articles/9587341-simple-automation-troubleshooting-with-execution-logs) - so that's not suitable for including in our Slack message. However, we can use the Company "owner" field to retrieve the User record in another Get step, including its system (default/standard) fields "firstName" and "lastName".

Because we are referring to the record retrieved in Step 1 (the Company) rather than the trigger record (the End User), we include "`Step 1`" in the replacement code rather than "`object`". We want to retrieve the User record whose ID is in the "`owner`" field of the Company record in Step 1, so our full replacement code that we use for the ID, as shown in the screenshot below, is `<<Step 1.owner>>`. Note that you have to state the name of your step exactly - so if your step is called s-Ujk, for instance, your replacement code would be `<<s-Ujk.owner>>`.

Looking at the [logs](https://help.planhat.com/en/articles/9587341-simple-automation-troubleshooting-with-execution-logs) for Step 2 - our User Get step - we can see that the system (default/standard) fields "firstName" and "lastName" have been retrieved for that User, as shown below.

You can view the rest of this Automation in our worked examples article - next, we do another very similar User Get step to retrieve the name of the Company Co-Owner, and then include all the gathered information in our Slack message that's the final step.

### Getting multiple records

The examples above covered getting a single record per step, which is the simplest and most common type of Get step.

It is also possible to Get multiple records per step, like so:

Although slightly more complex, these "Get multiple" steps are actually still relatively straightforward, and next in this article we'll explain how to set them up.

📌 **Important to note**

A significant update to "Get multiple" steps was released in September 2025. Previously, Automations with "Get multiple" steps were more complex, involving queries, and typically [JavaScript functions](https://help.planhat.com/en/articles/11170360-execute-function-steps-in-automations) and [webhooks](https://help.planhat.com/en/articles/11432236-webhooks-in-automations) (see example below).

Click the image to view it enlarged

If you created Automations with "Get multiple" steps before this update, they will remain in this format.

However, new "Get multiple" steps/Automations will use the new, easier format, which we will now describe in this article.

### Main structure of "Get multiple" steps

Firstly, let's go through how to configure a step to "Get" multiple records.

- Under "Object", select "Multiple" from the first dropdown menu, and then your choice of [model](https://help.planhat.com/en/articles/9587119-data-models) (such as Company, End User or Workflow)
- For "Filtering":
  - Typically, you will apply a filter to specify which records of that model you would like to "Get". For example, here you can enter a [replacement code (dynamic reference)](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations), similar to how you would in the "id" field for "Get single" steps, or you did in "query" in the older design of "Get multiple" steps. In the example screenshot above, we specify that we want to retrieve Workflows belonging to the Company that triggered the Automation; we'll go through this in more detail in the [worked example next in this article](#worked-example)
  - This filter is technically optional - you don't need to configure one to run the step
- Under "Parameters", you can add more criteria to determine which records are retrieved. You can click "+ Add param" at the bottom to add another parameter, and use the trash can (rubbish bin) icon on the right to delete a parameter
  - "Limit" is the only mandatory parameter. This defines the maximum number of records that would be retrieved when the step runs. The default is 10; the maximum is 1000. For example, if this is set to 50 for a "Get multiple End Users" step, the most End Users that will be retrieved in a run is 50
  - "Offset" allows you to "skip" records - e.g. if you run "Get multiple Companies", with a limit of 10, and offset of 2, then the result will be Companies 2 to 12. (This makes most sense in the context of the "Sort" parameter below)
  - You can use "Sort" to sort the list of records, based on a property. A common use case is to get the most recent Conversations by using "-date" - sorting Conversations in descending order ("largest" - i.e. most recent - at the top)
  - "Select" - here you can select specific fields to be retrieved by the Get step, returning less data and making the call more efficient. For example, perhaps you only want to "Get" Company IDs

### Worked example

Let's say you [create a custom field](https://help.planhat.com/en/articles/9587045-how-to-create-custom-fields) on the [Workflow](https://help.planhat.com/en/articles/9587102-workflows-overview) model: "Co-Owner". You want an Automation:

- that is triggered by the system (standard/default) Co-Owner field on a Company record being populated or updated,
- and the desired outcome is that this new Company Co-Owner value is applied to all Workflows associated with that Company

For example, if my Company "Innova Biosciences" is assigned the Co-Owner "Bob" (a Planhat User), and this Company has the Workflows "Expansion" and "Customer Reference" in progress, then those two Workflows for Innova Biosciences will also be assigned the Co-Owner Bob.

So if we make this happen using a Workflow with a "Get multiple" step, what does it look like?

This is the overall Automation structure:

Let's go through the steps one by one.

#### Trigger - "Company updated"

Click the image to view it enlarged

We set the trigger to be "when a Company is updated with specific properties", with the conditions "Match all" --> "Co-Owner has value".

This means that the Automation will be triggered when the Co-Owner field on a Company record is either populated for the first time or updated to a new value.

#### "Get multiple" step

Click the image to view it enlarged

For "Object", we have selected that we want to "Get multiple Workflows".

Under "Filtering", we have specified "Company Id is equal to `<<object._id>>`"

`<<object._id>>` is a [dynamic replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) that refers to the ID of the record in the trigger, i.e. the Company that triggered the Automation run.

This filter is saying that we only want to retrieve the Workflows associated with the Company that triggered the Automation.

In the "Parameters" section, the "Limit" is set to 1000 as that's the maximum (to say we don't want to limit the number), and "Offset" has simply been left as the default of no offset.

#### "Update Workflow" step

Click the image to view it enlarged

We select the "Object" for this update step to be "Workflow", as we want to update each of the retrieved Workflow records.

Now let's look at the "Fields".

For "id", we specify that we want to update the Workflows that were retrieved in the previous step, by using the [replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) `<<s-2IE[0]._id>>`.

Steps are randomly assigned code names, such as "s-2IE" for the "Get Workflow" step in the example above. Because we want to refer to the Workflows retrieved in that step, we use that step name in the replacement code. If you recreate this Automation, you will need to use your own step name, whether it's another random code, or "Step 1" or similar if you have renamed the step.

If we were just "Getting" a single Workflow, our replacement code would be `<<s-2IE._id>>`, but because we are "Getting" an array of Workflows, we need to include the "`[0]`" in the code to make it `<<s-2IE[0]._id>>`. (You will see this in the dropdown menu when you are writing the replacement code, as shown below.)

The "`_id`" part is simply referring to the (Planhat) ID of the record in the referenced step - i.e. we are saying we want to update the Workflows we retrieved in the previous ("Get") step.

Finally, we specify that the "Co-Owner" field on the Workflow records should be updated with the value of the "Co-Owner" field on the Company that triggered the Automation run. We do this by using the [replacement code](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) `<<object.coOwner>>`, as "object" in the replacement code refers to the record that triggered the Automation.

... and that's it - simple!

If you do need any further help setting up your "Get multiple" Automations, you can reach out to your Technical Deployment Specialist (formerly called your TAM).