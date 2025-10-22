# Automations overview

## Summary

- Automations are one of the features in Planhat that you can use for automating actions - for increased productivity, efficiency and scalability etc.
- Automations follow the general structure of "when x happens, do y" - but can be more advanced than that phrase may suggest, with branching/conditions, wait steps, webhooks and function executions
- Planhat includes an extensive library of Automation Templates, which are simple to use and pre-configured to save you time, yet can be tailored to your specific needs
- You can also build Custom Automations, using a flowchart UI, with almost infinite possibilities

## Who is this article for?

Everyone!

Specifically, anyone who would like an introduction to Automations

## Series

This article is part of a series on Automations:

- Automations overview ⬅️ You are here

## Article contents

## Introduction

Whether your role is to retain and expand existing accounts, or acquire new customers, or any other business function, you'll likely be driving to increase productivity and efficiency. As your organization grows, you'll want to scale up your processes so you get more done, while simultaneously enhancing consistency/accuracy. How can this be done?

A key element here is automating actions - rather than a person having to do everything manually (e.g. notice a positive/negative sign in your customer data, gather additional data, post to Slack and schedule a task), this can all be done for you automatically in Planhat.

Planhat includes a wide variety of different functionality to automate steps for you, including [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview), [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview), [NPS campaigns](https://help.planhat.com/en/articles/9587055-nps-module-overview) and more, but in this article series we will focus on Automations.

Upgraded Planhat (ws.planhat.com) has been [designed to be incredibly powerful yet also very easy to use, and to be very customizable](https://help.planhat.com/en/articles/10265106-an-introduction-to-upgraded-planhat), and Automations follow these principles. Planhat has a whole library of [Automation Templates](https://help.planhat.com/en/articles/9587153-templated-automations), which use a simple "sentence structure" UI and are pre-configured for ease - yet you can still customize them for your specific use cases. You can even create completely [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) - using our flowchart UI - if you'd like to build something more specialist.

## What are Automations?

Automations are just one of the ways that actions (e.g. record creation/update, notifications, data transformation, data transfer, customer communication, etc.) can be automated within Planhat. They can involve a wide range of data across Planhat, with almost unlimited possibilities.

Automations follow the general structure of "when x happens, do y" - but they can potentially be more complicated/advanced than that phrase may imply, with multiple steps and branching etc.

For example: when the Company [Health Score](https://help.planhat.com/en/articles/10045917-configuring-health-scores-and-success-units-in-upgraded-planhat) climbs above 8, then create an Opportunity (with field values you configure)

We list more use case examples [here](#h_6f554ba555)

There are two main types of Automations:

**Templated Automations**

- A wide range of Automation Templates are available for you to choose from, covering the most common use cases
- Even though they are pre-configured, you can still customize them to suit your business needs
- Their UI has a "sentence" structure

**Custom Automations**

- Here you can build Automations that are completely custom, to suit more specialist use cases
- Their UI has a flowchart structure

Both types of Automations work in the same way "behind the scenes".

Here are a couple of examples of what these types of Automations may look like:

**Templated Automation**

**Custom Automation**

In upgraded Planhat (ws.planhat.com), Automations are configured in the [App Center](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center).

Click the image to view it enlarged

## Why use Automations?

There are actually several elements to this:

We will consider each of these in turn below.

### Benefits of automating actions in general

Whether you work in Customer Success, Sales, or any other business function, you're probably very busy! Pretty much all organizations are driving towards increased productivity and efficiency. For example, if you're a CSM, you may be asked to manage a larger portfolio of customers, yet still improve Net Revenue Retention (NRR). By automating tedious manual tasks, you can save time, meaning you can spend more of your day carrying out impactful strategic work.

Breaking this down a little, automation (the general concept) has the following benefits:

- **Efficiency**: automation can significantly reduce the time and effort required to complete repetitive tasks, leading to increased productivity and cost savings
- **Speed**: rather than relying on a person to notice an event or to carry out an action, steps can happen immediately if automated
- **Consistency**: automated processes follow predefined rules and instructions consistently, helping to minimize/eliminate the differences you may see if different people carry out the same steps, or even if the same person carries out the same steps at different times
- **Accuracy**: by eliminating manual intervention, automation cuts out human error, resulting in more reliable and precise outcomes
- **Scalability**: automated processes can easily handle large volumes of work without the need for additional resources, making them suitable for scaling operations as organizations grow
- **Focus on value-adding tasks**: by freeing up human resources from mundane and repetitive tasks, automation allows you to focus on more strategic and impactful activities that require creativity and critical thinking

### Why use Automations rather than other Planhat methods of automation?

📚 **Further reading**

We have a separate article on choosing between Automations and other Planhat features [here](https://help.planhat.com/en/articles/9587307-how-to-choose-between-automations-and-other-planhat-features), so you can consult that for further details on this topic, but we will summarize some key advantages of Automations below.

Planhat includes a wide variety of features that involve automatic data changes, such as [Health Scores](https://help.planhat.com/en/articles/10045917-configuring-health-scores-and-success-units-in-upgraded-planhat), [Workflows](https://help.planhat.com/en/articles/9587102-workflows-overview), [Formula Fields](https://help.planhat.com/en/articles/9586968-formula-fields-overview) and [NPS campaigns](https://help.planhat.com/en/articles/9587055-nps-module-overview).

While some of these have fairly obvious specific use cases (e.g. Health Scores), in some cases you may be considering whether you want an Automation v. a Formula Field, or an Automation v. a Workflow, and so on. While we discuss this in more detail in a separate article [here](https://help.planhat.com/en/articles/9587307-how-to-choose-between-automations-and-other-planhat-features), a key reason for choosing Automations is flexibility:

- Automations can be triggered by records of any Planhat [data model](https://help.planhat.com/en/articles/9587119-data-models), or by an incoming webhook, or run on a schedule, or be triggered manually
- Automations can carry out a wide range of actions - e.g. creating/updating records of any model, sending notifications, calling webhooks, and so on
- Automations can be used for simple processes - you can set them up with Templates very quickly and easily - or alternatively Automations can be more complex and custom (including branching, wait steps, or JavaScript function executions, for example)

In addition to this flexibility:

- Automations have extensive [logs](https://help.planhat.com/en/articles/9587341-automation-logs-and-troubleshooting), making it easy for you to troubleshoot any issues or misunderstandings. For example, was the Automation actually triggered? Did it run but encounter an error because you hadn't configured the Automation correctly? Logs also provide useful information (e.g. API field names) for when you are building Automations

## Example use cases for Automations

Because Automations are so flexible, the possibilities are almost endless!

There is a huge library of [Templated Automations](https://help.planhat.com/en/articles/9587153-templated-automations) that you can select from and customize to suit your needs, including:

- When a Company enters a specific filter, assign it to a Planhat User based on a range of criteria (dynamic assignment)
- When a Company is a certain number of days before renewal, create an Opportunity
- When Churn is logged, send an email notification
- When the Health Score drops below 5, post to Slack
- When an End User enters a particular filter, schedule a task
- When an End User's NPS changes, send them an email
- When a Company enters a particular filter, use OpenAI to run a SWOT analysis

Note that these descriptions are all simplifications - you are actually able to customize various elements of these triggers and actions.

Considering [Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations), there are obviously even more potential use cases! Here are some examples to give you some inspiration:

- When an Opportunity is created, update the Opportunity with a specific Owner depending on the ARR of the associated Company
- When an Opportunity is created and the Company is marked as a Prospect, update the Opportunity to assign the Pipeline (custom field) as "New Business"
- When Time Entry is created, populate its "Submitted By" field with the User who created it
- When a Customer Success Qualified Lead (CSQL) is logged on a Conversation, create an Opportunity on the associated Company
- When a Task is added to a specific filter, calculate the total time taken, and update the associated Workflow with this data

📚 **Further reading**

You can also check out our article on Custom Automation worked examples [here](https://help.planhat.com/en/articles/11100354-custom-automations-worked-examples) for further use case inspiration, although note that that is a technical article focused on the practical details of building Custom Automations.