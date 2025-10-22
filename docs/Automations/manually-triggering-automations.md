# Manually triggering Automations

## Summary

- "Manual action" is a type of trigger you can choose when configuring a Custom Automation
- Each "manual action" trigger is associated with a specific data model, such as Company, End User, Conversation or License etc.
- Once the Automation is set up, to manually trigger it, you go to a Preview or Full-Page Profile of the relevant model (e.g. the Company Preview for "Nissan"), select the Automation from the menu and click to run it
- Although in many other Automation use cases you'll want the Automation to be triggered automatically in response to a change in data, the "manual action" trigger option enables you to run Automations on demand. An example use case is an AI Automation to enrich your customer data

## Who is this article for?

Planhat Users who will either be building Custom Automations for their organization, or simply running Automations manually

## Article contents

## Introduction

### Automating actions

Whichever job role you're in (Customer Success, Sales, Professional Services and so on) you'll be aiming for increased efficiency - saving time, acting faster, scaling up, improving consistency, etc. In order to achieve this, you'll want to automate actions (e.g. automating data updates, task creation, email campaigns, and many more possibilities), to remove repetitive manual steps to give you and your team more time to focus on strategic work, as well as minimizing delays and human error.

One of the ways you can automate actions in Planhat is by using Automations, which work on the basic principle of "when x happens, do y" - although they can be a lot more advanced than that statement may imply. Planhat includes a library of Automation Templates that you can easily customize to suit your needs, or you can create Custom Automations from scratch.

### Triggering Automations

Automation "triggers" are what causes each Automation to run. For example, you could have Automations that automatically respond to data changes in Planhat, e.g. are triggered to run when:

- A Company's Phase is set to Success
- An End User is added to an "Advocates" filter
- An Opportunity is marked as lost
- A Workflow is archived
- ... and so on.

You can also alternatively have an Automation that is triggered by an incoming webhook (e.g. when Planhat receives a survey response from an external tool).

Another option is to trigger an Automation on a schedule - e.g. every Friday at 6 pm.

The most recently added option to trigger Automations is manually. This means you can run an Automation as and when needed, as determined by you. In this article, we talk you through the use cases where this is beneficial, and explain how to set this up (if you are a Planhat Admin building Custom Automations for your organization) and how to use it (if you are a Planhat User who may be running such an Automation).

**📚 Further reading:**
- For an overview of Automations in general, including benefits and use cases, check our our introductory article.
- To learn about how to create Custom Automations - where you can configure a manual trigger - see our separate article.

## What are "manual action" Automation triggers?

"Manual action" is a type of Automation trigger within the "object triggers" category. In simple terms, it's a way that you can run an Automation on demand, like clicking a button. Each of these Automations is associated with a particular data model - e.g. you could run an Automation manually from a Company record.

### When configuring a Custom Automation

If you're a Planhat Admin (e.g. CS Ops) building a Custom Automation for your organization, once you select a data model (from the "object triggers" list), you can find "manual action" in the "updated" etc. dropdown menu.

### When viewing a relevant Preview or Full-Page Profile

If you're viewing a record's Preview or Full-Page Profile, you can click on the ellipsis symbol in the top-right corner, and you'll see any relevant Automations to select from.

The example screenshot below shows an Opportunity Preview, and highlighted is a Custom Automation built with the Opportunity model selected in the trigger.

## Why use "manual action" Automation triggers?

In many cases, once you've configured an Automation, you'll want it to be triggered automatically in the appropriate situations, without any manual intervention from you - and this is how the majority of Automations work.

However, sometimes you might want a particular Automation to be triggered manually instead. There are a variety of use cases for this type of Automation trigger; for example:

- **Run AI analysis** - e.g. prompt OpenAI to gather information and generate a summary for a Company, enriching that record in Planhat
- **Internal handovers** - e.g. when a Salesperson is ready to hand an Opportunity/Company to CS, trigger a series of actions to occur
- **Initiate an escalation/risk flow** - e.g. when you identify that a customer is particularly unhappy or there is a risk to a deal or a renewal (perhaps because they mention this to you in a meeting), trigger specific actions to mitigate that risk, and notify the relevant Company Owner
- **Kick off a customer advocate flow** - e.g. if an End User tells you they would be happy to work with you on case studies and so on, you trigger an Automation to create tasks and send notifications as appropriate
- **Create a new Issue** (e.g. for a bug report or a feature request) or **Opportunity** (e.g. for an upgrade) from a **Conversation** (e.g. in an Inbox Page)

## How to create an "manual action" Automation trigger

**📌 Important to note:**
- This part of the article is relevant to you if you are creating/configuring Custom Automations in Planhat. If you don't build or manage Automations, you can skip to the next part of the article, which talks through running these Automations
- This article assumes you are familiar with the general overall process of creating/configuring Custom Automations - if not, make sure you read through our separate article

There are a couple of ways you can start setting up a "manual action" trigger in a Custom Automation.

### Method 1: From App Center

The first is to navigate to the App Center and start creating a Custom Automation as described here. When you're configuring your trigger:

1. Firstly select your choice of data model from the "object triggers" list
2. Then use the left-hand dropdown (that displays "updated" as default) to select "manual trigger"

### Method 2: From a record Preview/Profile

The alternative method to start creating such an Automation is, when you are looking at a record of your chosen model via a Preview or Full-Page Profile, you click on the ellipsis in the top right, and select "+ New automation".

This will open up the App Center, open up the Custom Automation creation UI, and even preselect your chosen data model and the fact that it's a "manual action" trigger. This is a fantastic way to skip some steps and make building your Automation even quicker and easier.

### Configuring the manual action trigger

Whichever of these two methods you use, once "manual action" is selected as the trigger type, you'll see a couple of boxes to fill in:

1. **"Action title"** is the title shown when you or your teammates go to manually run this Automation from a suitable record

2. **"Confirmation dialog message"** is the message shown to the Planhat User (you and your colleagues) when they click here to run this Automation - it appears as a pop-up with further details, so they can fully understand it before confirming that they want to run the Automation

Other than this, the rest of the steps to set up the Automation are the same as any other Custom Automation, as described in our separate article. You can optionally configure trigger filtration, and you specify the desired actions you'd like to take place when the Automation is triggered.

## How to manually run an Automation with this trigger type

Running an Automation with "manual action" as its trigger type is incredibly easy! We have actually already touched upon this earlier in this article, but to bring it all together here:

1. Open the Preview or Full-Page Profile of the record you'd like to run the Automation on (e.g. the Company "Microsoft", the End User "Elvis Presley" or the Opportunity "Backup Upgrade", etc.)

2. Click on the ellipsis symbol in the top right, and select the Automation

3. Read the information in the modal, and assuming you'd like to proceed, click "Run" in the bottom right

... as easy as that!

## Future developments

At time of writing, this is new functionality, and we have various potential enhancements planned, so watch this space for updates!