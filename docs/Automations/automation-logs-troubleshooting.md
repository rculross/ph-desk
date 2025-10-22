# Automation logs and troubleshooting

## Summary

If you think an Automation should have run, but you don't see the expected results, you can use Automation logs to check:
- Whether the Automation was actually triggered
- Whether the Automation encountered any errors

In this article, we list the steps to follow to troubleshoot any issues

## Who is this article for?

Planhat Users who are building/managing Automations for their organization (e.g. Tech/Ops)

## Article contents

## Introduction

If you're building new Automations or managing existing Automations, then it's important that you know how to troubleshoot them.

If you think an Automation should have been triggered, but you don't see the result (e.g. data change) you were expecting, there are two main possibilities:

1. The Automation has not run - it was never triggered (e.g. because the trigger has been set up incorrectly, or you made a mistake and did not correctly carry out the action set to trigger the Automation)

2. The Automation did run, but something went wrong in the process (e.g. because a mistake was made in a replacement code in a step, or the desired action wasn't correctly configured in the step)

In this article, we'll teach you all about Automation logs, and then detail the process of troubleshooting Automations to help you swiftly get them operational!

**💡 Tip:** In the App Center, you can see Automations with failed runs in the last 7 days - this will be denoted by a red bar.

You can also configure notifications so that you are alerted about Automation failures. To learn all about enabling these notifications, see our separate article.

**💡 Tip:** In addition to troubleshooting, Automation logs can also be really helpful to give you information when you're building Automations - you can read an example use case here.

## Automation logs

### Where to find Automation logs

The execution logs for both Templated Automations and Custom Automations are accessible via the "Logs" tab - simply click on your Automation within the App Center to open it up, then select "Logs":

### Runs (executions) within the logs

The logs are arranged with the most recent run at the top, and the run furthest in the past at the bottom. Each run (execution) is shown on its own line, with a timestamp of when the Automation was triggered.

If the Automation run failed, it will show in red.

You can click on each line (i.e. each run/execution) to open it up and see its details. When you first click, you'll see a line for the "event details" (i.e. the trigger event), and then separate lines for each step of the Automation.

If a step has run successfully, it will show in green. If, however, the step encountered an error (e.g. because you made a typo in a replacement code), it will show in red. This enables you to identify which step of the Automation the error occurred in.

You can then click on any of these lines (i.e. "Event details" and then the line per step) to open up further details for additional investigation - we'll go through this next.

**💡 Tip:** Step names will show in the logs - e.g. "Step 1" and "Step 2" in the green-text example above, and "s-Ujk" in the red-text example above. When you are building an Automation, step names are automatically generated to be random codes (such as "s-Ujk"), but you can easily rename them (e.g. to "Step 1") when you are configuring the Automation.

**💡 Tip:** Templated Automations are pre-configured, but actually function like Custom Automations "under the hood" - they just have a simplified UI on top, which is what you interact with. This means that the actual Automation may involve multiple action steps (e.g. "Get" steps) even if that's not immediately obvious from the Template; each of these steps will show in the logs.

### Event details

Clicking on "Event details" will provide full context on the exact event that resulted in the Automation being triggered. The details are structured as a JSON, and are searchable using the usual "find" keyboard shortcut (Ctrl+F / Cmd+F).

- `"companyId"` is (as you may expect from the name) the ID of the related Company
- `"update"` is a nested expression that either shows you the data change that triggered the Automation (if the trigger was set to created/updated); or, if the Automation was triggered by a filter, the logs will provide you with a full list of the trigger record properties, rather than just the specific data change that triggered the Automation - this is where the Ctrl+F etc. really comes in useful

**💡 Tip:** The "event details" is a great place to find out how to refer to your desired fields (properties) in replacement codes when configuring Automations. For example, you can see API names for standard fields, such as "customerFrom" in the example screenshot above. And you can see if properties are nested, like the "Company Scheduling Contact" field also in the example screenshot above - to get the name, you'd need to refer to "custom.Company Scheduling Contact.name", as we describe in our worked examples article.

### Steps

Clicking on a line in the logs corresponding to an Automation step (which will show in either red or green, as mentioned above) will provide information on what happened when that step tried to run. Like the event details, this will be structured as a searchable JSON.

- `"success"` will take a value either of "true" (if the Automation step was executed successfully) or "false" (if the Automation step was unsuccessful)
- `"executionResult"` provides a summary of what the execution was (if successful) and a summary of why the execution was unsuccessful (if it failed)
- Within "data", you can see any error message, to help you identify the cause of any issue

Here are couple of examples, showing a successful step and a failed one.

The error example above was caused by a typo in a replacement code. Looking in the main "Editor" tab of the Automation, opening up that step in the configuration panel, I can see that this ID dynamic reference is wrong - it should be `<<object._id>>`.

**💡 Tip:** To help avoid typos in replacement codes like in the example above, start typing `<<` into the box, and then select from the dropdown list, rather than typing it out. If there are a lot of options in the dropdown, you can type some more of your desired code (e.g. `<<object`) before selecting your choice of code from the list.

## Troubleshooting Automations

If you've set up an Automation but don't see your expected results, then follow this quick and simple process to troubleshoot what happened.

### 1. Check whether the Automation was actually triggered (i.e. whether it has run)

Look in the "Logs" tab of the Automation (as discussed earlier in this article) - can you see a line corresponding to the date/time you expected the Automation to run? If the Automation has never been triggered, you won't see any logs at all, but if it's run previously (just not this time) you will see lines for older runs but not for your expected run.

**📌 Important to note:** You should wait a while to give your Automation the chance to run after the trigger event - although Automations typically run near-instantly, sometimes there may be a slight delay

**💡 Tip:** You should refresh your browser window to ensure that your Planhat tenant is displaying the most updated data (e.g. showing the Automation run, in this case)

### 2. If your Automation was not triggered (it hasn't run), look into the data in your Planhat tenant to see whether the trigger conditions were actually met

For example, if your trigger criteria has the format "when x is added to a filter" (e.g. "when a Company is added to the Enterprise filter"), check whether the record in question (e.g. the Company) actually entered the filter. Firstly, has it met the conditions of the filter, and secondly, has the filter updated to include that record? In the "Global Filters" tab of the "Data" Global Tool, you can see how many records are in each filter (in the "Count" column), and you can see when the filter was last processed (updated).

**💡 Tip:** You can prompt a Global Filter to process early by editing it and saving it. Remember to refresh your browser window to ensure you see the updated processing information.

As well as checking whether the main trigger conditions themselves were met (which may or may not have involved a filter, like in the example above), if you included "Trigger filtration", ensure that the filter criteria have been met too. E.g. if your trigger is "when Onboarding Workflow is archived" but with trigger filtration of "Company is in the Enterprise filter", then in addition to checking that the Workflow has the Onboarding Template and has been archived, check that the associated Company is indeed in the Enterprise filter.

### 3. If the Automation has run, check whether any errors have occurred

- Open up the steps in red - you will see `"success": false`
- Look at the `"message"` and `"data"` for error details

### 4. Review your Automation setup to see if a mistake was made when configuring it, and adjust your Automation as required

If, from the troubleshooting steps above, you have identified that the Automation was likely not set up correctly, review the configuration to see if any adjustments need to be made.

This is particularly the case for Custom Automations, where you enter trigger/step details in the "Editor" tab:

- Watch out for any typos in replacement codes (dynamic references), like in the example shown above
- Also ensure you have configured the rest of your action steps and trigger correctly, based on what you want to achieve - e.g. did you select the wrong filter in the trigger, or accidentally miss out some of the fields you want to be populated on a record the Automation creates in an action step?

### 5. Trigger your Automation again (ensuring you definitely meet the trigger criteria), and check the result

- You could deliberately carry out the required data change to trigger the Automation, or wait until it is "naturally" triggered
- Remember the info/tips in point 1 about waiting a short while, ensuring your filter has processed (if applicable), and refreshing your browser window

### 6. If you still need help, reach out to our Support team via live chat, or speak to your Technical Account Manager (TAM)

- Share all the information from your investigation steps - this is very useful context to help us diagnose and resolve the issue

**💡 Tip:** One of the step types you can include in a Custom Automation is a "Wait" step. If your Automation has been triggered but not all of the steps have completed, yet there is no error, check whether it's not in the middle of "waiting".

**📚 Further reading:** If you would like to receive notifications when an Automation fails, check out this article.