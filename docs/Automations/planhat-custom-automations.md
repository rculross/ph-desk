# Custom Automations

## Summary

- Automations enable you to automate actions in Planhat, using the general structure of "if x happens, do y"
- As well as being able to choose from a library of customizable Automation Templates that cover some common use cases, you can also build Automations that are completely custom
- Custom Automations enable you to design a wide variety of processes, to meet your organization's needs - you choose what should cause the Automation to run (e.g. a change in data, a manual action or a schedule), and then which steps should be carried out
- You have a lot of choice when configuring Custom Automations, including branching, wait steps, function executions, webhooks, and so on
- Custom Automations are charged through step execution

## Who is this article for?

Planhat Users who are building Custom Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- Custom Automations ⬅️ You are here

## Article contents

**This is a technical deep-dive article**

Read on if you'd like to learn how to build Custom Automations.

If you would simply like a general introduction to Automations, check out our overview article [here](https://help.planhat.com/en/articles/9587240-automation-overview).

## What are Custom Automations and why use them?

In our [Automations Overview article](https://help.planhat.com/en/articles/9587240-automation-overview), we explain how using Automations is one way in which actions can be automated in Planhat. Automations have the general structure of "if x happens, do y", and can either be simple or more complex if required.

Planhat includes a library of pre-built - yet customizable - [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations) that cover a wide variety of common use cases. But if you need an Automation to carry out a process that's not covered by an Automation Template, then you can create a fully custom Automation instead.

Custom Automations in upgraded Planhat (ws.planhat.com) have a flowchart UI, making it easy to visualize and understand the whole process - this can be particularly helpful if you have a multi-step, potentially branching, Automation.

Click the image to view it enlarged

Even Custom Automations can be relatively simple - perhaps your process is straightforward but it simply isn't common enough to be included in the library of Automation Templates - but they can also be more advanced. It's possible to have [branching](https://help.planhat.com/en/articles/11411711-branching-in-automations), [run JavaScript functions](https://help.planhat.com/en/articles/11170360-execute-function-steps-in-automations), be scheduled, [be triggered by an incoming webhook, call a webhook as a step](https://help.planhat.com/en/articles/11432236-webhooks-in-automations), and so on. In this article, we will give you an overview of the steps to create a Custom Automation.

📌 **Important to note**

You should always start by checking whether there is an Automation Template [(Templated Automation](https://help.planhat.com/en/articles/9587153-templated-automations)) in the [Apps Library](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center#h_f052aa1270) for your use case before you begin creating a Custom Automation - it's quicker and easier to use a Template if possible.

📌 **Important to note**

If you want to create a Custom Automation, please consult your Technical Account Manager (TAM) for technical assistance. Our [Support team](https://help.planhat.com/en/articles/10184789-help#h_0f6d81d743) are also available to help with troubleshooting.

## How to set up a Custom Automation

📌 **Definitions**

- **Model** - Planhat [data models](https://help.planhat.com/en/articles/9587119-data-models) are Company, End User, License, Opportunity, and so on. You can think of them as like containers for data
- **Record** - data within those models - e.g. if Company is the model, then BMW, Microsoft and Nike could be records; and if End User is the model, then Katie Chambers, Jason Bendefy and Sally Peters could be records

1. Go the [App Center](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center), one of the [Global Tools for admins](https://help.planhat.com/en/articles/10091564-global-tools-for-planhat-builders-admins) accessible in the top gray bar of your Planhat tenant

Click the image to view it enlarged

2. Click "+ New app" in the top right

Click the image to view it enlarged

3. This opens up the Apps Library:

Click the image to view it enlarged

4. Click "+ Custom automation" in the top-left corner

5. That will open up a window like this:

6. In the top left, click where it says "Untitled", and give your Automation a descriptive name

7. Specify your Automation trigger in the left-hand panel

You can choose from:

**"Object triggers"** - these correspond to Planhat [data models](https://help.planhat.com/en/articles/9587119-data-models)

- You begin by selecting your choice of model from the list, e.g. Company
- Then you can choose whether you want your Automation to be triggered when a record of this model is:
  - created
  - updated
  - deleted
  - created or updated
  - added to filter
  - removed from filter
  - or whether you want the Automation to be triggered by an associated "manual action"
- ... and then depending on which of these you choose, there may be additional elements to configure. For example, if you select "updated", you will choose whether the Automation should be triggered on any updates, or only on specific updates that you define. Or if you've chosen "added to filter", you need to choose which filter

**"Connected Apps" --> ["Incoming webhook"](https://help.planhat.com/en/articles/11432236-webhooks-in-automations#h_f946155487)**

- Here you can specify if you would like the Automation to be triggered by an incoming webhook
- For example, it could be that you want the Automation to run when it receives details of a CSAT survey response from an external provider, and the rest of the Automation saves that data in Planhat

**"Other" --> "Scheduled"**

- Here you can choose to run your Automation on a regular interval, rather than when a specific event occurs
- For example, this could run every Monday at 9:00 am
- You can put your mouse over the clock symbol to see the next date/time that the Automation will run with these scheduling settings

If you've selected an "object trigger", for most options (e.g. for "updated"), you can optionally set up "trigger filtration"

- Here, you can apply a filter on the records that the Automation applies to. Think of this like a funnel. (This is not to be confused with a filter that you may have used as part of the Automation trigger itself)
- This filter looks at the state of the record in the trigger before the update that triggered the Automation
- For example:
  - If the Automation is set to date-stamp today's date in a "Go Live" custom field if a Calculated Metric for product usage goes above a certain level (the trigger), the trigger filter could be: only if the field is empty when the Automation is triggered, ensuring the Automation only runs once per Company
  - If the Automation is set to change the Owner of a Company when a specific Workflow is archived (the trigger), the trigger filter could be: only if the Company has the list value Tier 1 in the "Service Tier" custom field, ensuring the Automation only runs for selected Companies
- You can select an existing [Global Filter](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data#h_b2223b5b7b) (managed in the ["Data" Global Tool](https://help.planhat.com/en/articles/10147373-global-tools-for-admins-data)), or create a new filter here

8. Once you've finished configuring your trigger, click "+ Add action" under "Next step" at the bottom

You will see this opens up the configuration menu for the step on the left, and the new step will show in the flow chart on the right

Click the image to view it enlarged

9. Choose and configure your desired action. Select from the list (shown in the screenshot above); this will then open up a form as appropriate with more details to complete:

**"Planhat Actions"**

- "Create" - create a record of your choice of "object" i.e. [model](https://help.planhat.com/en/articles/9587119-data-models) (e.g. create a Company, or create an Opportunity), adding data to fields as you specify
- "Update" - update a record of your choice of "object" i.e. [model](https://help.planhat.com/en/articles/9587119-data-models) (e.g. update a Company, or update an Opportunity), adding data to fields as you specify
- ["Wait"](https://help.planhat.com/en/articles/11425373-wait-steps-in-automations) - pause the Automation for a specific amount of time before the next step runs

**"Communication"**

- ["Notify User"](https://help.planhat.com/en/articles/10131521-notifications) - choose who to notify (e.g. the Company Owner), and define what the message should be
- ["Send a Slack message"](https://help.planhat.com/en/articles/9587101-sending-and-formatting-slack-messages-in-automations) - here you can choose a Slack channel and configure the message to be sent; you can include [replacement codes for dynamic references](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations). Note that you need the [Slack integration](https://help.planhat.com/en/articles/9587085-setting-up-the-slack-integration) to be connected/enabled in your tenant to see this option

**"Logic and Flow Control"**

- ["Execute function"](https://help.planhat.com/en/articles/11170360-execute-function-steps-in-automations) - write your expression within our JavaScript editor. Please liaise with your TAM if you would like to use an "execute function" step
- ["Branch"](https://help.planhat.com/en/articles/11411711-branching-in-automations) - here you can split the path of your Automation so that action 1 happens if condition A is met, or action 2 happens if condition B is met

**"Connected Apps"**

- ["Call a webhook"](https://help.planhat.com/en/articles/11432236-webhooks-in-automations#h_82aaf816f0) - select the webhook URL to interact with, specify the type of action (create/update/delete etc.), and specify what data format to use
- "Use an integration" - here you can select from one of the Connections you have set up in the bottom left of the [App Center](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center). This is typically one of the [AI Integrations](https://help.planhat.com/en/articles/10063285-setting-up-the-ai-integrations)/Connections, such as OpenAI

10. Repeat steps 7 and 8 to add additional steps if desired

11. When you have finished configuring your Automation, press the orange "Save" button in the top-right corner

## Practical tips for building Custom Automations

- You can click on any step (including the trigger) in the flow chart to open up the "configuration panel" for that step on the left-hand side, to view/edit it. You can identify the selected step in the flow chart by the orange ring around it (e.g. shown in the "Update Time Entry" step below)

Click the image to view it enlarged

- Ensure the hand is selected at the bottom of the flow chart, and then you can move it around by dragging and dropping - useful for positioning it as needed
- If you end up building a large flow chart (and/or have a small screen) and would like to zoom out, you can use the percentage slider at the bottom of the flow chart
- Once you've selected the type of trigger or step (e.g. "Create"), if you then want to change it to something different, you can do this by clicking back into the trigger/step type to open up the options as a dropdown menu. (Clicking the "x" in the top right does not go back a step, it just closes the configuration panel)
- Steps (so here we are talking specifically about action steps, rather than including the trigger too) are automatically assigned a random name, such as "s-YjM" in the screenshot example below. This is because, with the option to branch your process, there isn't an obvious "Step 1" and "Step 2" like you may have been familiar with from the previous Planhat Automation UI. This means that in any replacement codes (see more [here](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations)), you will need to refer to this specific name. Or if you would like to use your own choice of name for a step, you can click into the name in the top left of the configuration panel, and type in your preferred name

Click the image to view it enlarged

Click the image to view it enlarged

- If you want to add a new step ...
  - ...as well as clicking "+ Add action" under the "Next step" at the bottom of a configuration panel, as described in the instructions earlier in this article, and shown in the screenshot immediately above ...
  - ... you can also click on the "+" symbols in the flow chart - just click on the "+" in the position you'd like to add the step. This is a particularly useful method if you want to add a step in the middle of two existing "blocks" in the flow chart
- If you would like to delete a step, simply ensure the step is selected (i.e. it's showing in the configuration panel on the left) and then click "Delete step" at the bottom, or the trash can (rubbish bin) icon to the bottom left of the flow chart, both highlighted below

Click the image to view it enlarged

## Commercial considerations for Custom Automations

Custom Automations are charged based on step execution (i.e. a step action is carried out when its parent Automation is run).

Your organization's Planhat tenant (instance) will have a particular monthly quota of step executions (step runs), depending on which Planhat plan (subscription) your organization is on.

Most step types count towards this allowance when they are run - e.g. a [Get step](https://help.planhat.com/en/articles/11162604-get-steps-in-automations) counts, and an [Execute Function step](https://help.planhat.com/en/articles/11170360-execute-function-steps-in-automations) counts. However, the following steps do not count towards your Automation step allowance:

- Triggers (what initiates the Automation)
- Branches
- Waits

In addition to counting as step executions, [AI steps](https://help.planhat.com/en/articles/11812698-use-ai-steps-in-automations) consume [AI credits](https://help.planhat.com/en/articles/11813533-planhat-ai-credits-and-permissions), unless you're using your own [AI connections](https://help.planhat.com/en/articles/10063285-planhat-ai-connections).