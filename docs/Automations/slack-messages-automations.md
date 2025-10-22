# Sending and formatting Slack messages in Automations

## Summary

- It's easy to use Automations to automatically post to Slack to inform your team of customer/prospect data updates
- There are a variety of customizable Automation Templates that send a Slack message in response to different trigger events
- You can also create Custom Automations to send Slack messages
- It's simple to format the text in these Slack posts, e.g. make particular text bold, add hyperlinks, @mention specific people, and so on

## Who is this article for?

Planhat Users who are building Automations for their organization (e.g. Tech/Ops)

## Article contents

### This is a technical deep-dive article

Read on if you'd like to learn about setting up Automations to post team notifications to Slack. Please ensure you read our articles on Templated Automations and Custom Automations before this one, so you are familiar with the context of where these codes are used.

If you would simply like a general introduction to Automations, check out our overview article.

## Introduction

Slack is central for communication within many organizations. For example, you may want to use Slack to inform your team of a new End User NPS rating, a Company completing Onboarding, or various other events.

In Planhat, you can accomplish this by using Automations to post messages to Slack channels - both via Templated Automations and Custom Automations - and we'll describe how later in this article. Note that you need to connect your Slack to your Planhat tenant via our Slack integration before you can send messages to it via Automations.

Within these Slack messages you can use dynamic replacement codes, which means the exact message can be filled in with different data each time it's posted - so e.g. it could say "Kerry Quegan from Pfizer just gave a score of 10", and then "Arnold Rayner from Spotify just gave a score of 7", both from the same Automation.

You can also use formatting within these Slack messages - so the message in Slack could have bold text, text in italics, include links, and so on. In this article, we will show you how you can achieve this.

**📌 Important to note:** If you'd like to learn about configuring your personal notifications to go to a private Slack channel, please refer to our separate article.

## What are Slack messages in the context of Automations?

If you have connected up the Slack integration, one of the ways you can use this is by posting team notifications to your choice of Slack channel via Automations.

There are two main ways you can do this:

1. **Templated Automations** - there is a wide range of customizable Automation Templates available in the Apps Library in the App Center that enable you to send a Slack message in response to a variety of trigger events. If you can achieve your goal via a Templated Automation, you should do that rather than going straight to creating a Custom Automation (point 2.)

2. **Custom Automations** - you can build a fully custom Automation from scratch, and as part of this you can select "Send Slack message" as a step type

In the screenshots above, the text inside `<< >>` brackets are replacement codes, which you can learn all about in our separate article. They will be filled in with the appropriate data each time the message is posted to Slack.

Although the example above shows a plain text Slack message (i.e. no formatting), it's easy to include formatting (bold text and links etc.) to your Slack messages, which we'll show you in this article.

## Why use and format Slack messages from Automations?

Sending these team notifications via Automations to public Slack channels is a fantastic way to automatically keep the relevant people up to date with important customer/prospect news, so key events are not missed.

There are a wide variety of possible use cases, such as:

- Send a Slack message when a Company Health Score changes in a specific way (e.g. drops below 5, or climbs above 8)
- Send a Slack message when an Invoice is created
- Send a Slack message when an NPS rating is submitted by an End User (with a different message depending on whether the rating corresponds to a promoter, passive or detractor)
- Send a Slack message when a Company completes Onboarding and moves into the Adoption Phase
- Send a Slack message when a Churn is logged
- Send a Slack message when a License is auto-renewed
- ... and many more!

Then in terms of why to format your Automation Slack messages:

- Using formatting such as bold or italics can make key words stand out, making it easier for you and your colleagues to digest the most significant details at speed
- Using hyperlinks makes the Slack messages interactive, and can save time by enabling the reader to jump to important information with one click
- Using @mentions means you can bring a notification message to the attention of the most relevant team member

## How to create an Automation that sends a Slack message

**📌 Important to note:** We won't go into detail in this article about how to set up Templated Automations or Custom Automations - for more information on this, you can refer to our separate articles.

Remember you will need to set up the Slack integration before using Slack in Automations.

To send a Slack message via a **Templated Automation**, go to the Apps Library, search for "Slack" to see the options, click on your Template of choice, and then use the boxes to configure it as desired, including choosing the Slack channel to post to, and customizing the message if required.

To send a Slack message via a **Custom Automation**, click "+ Custom Automation" within the Apps Library, configure your Automation trigger, and then select "Send Slack message" as the step type at the appropriate position within your sequence of steps. Choose the Slack channel you'd like to post the message to, and write your desired message (using replacement codes) in the box provided in the step configuration panel.

## How to format text in Automation Slack messages

It's easy to format text in these Slack messages. Here we'll show you how. The first screenshot in each case shows the text in the "Message" box in a (Custom) Automation, and the second screenshot shows the corresponding message sent to Slack (using our testing setup).

### Bold

Bold text is perfect for highlighting key parts of a Slack message.

In the Automation message, use asterisks (*) around the text you want to be bold.

**Example:**
```
*This text will be bold*
```

### Italics

Having your text in italics is another great method for highlighting your choice of text in a Slack message.

In the Automation message, use underscores (_) around the text you want to be in italics.

**Example:**
```
_This text will be italic_
```

### Inline text (code font)

Inline text (also known as code font) is another way you can highlight specific text, making it stand out within your Slack message.

In the Automation message, use backticks (`) around the text you want to be inline/code.

**Example:**
```
`This text will be in code font`
```

**📌 Important to note:** At time of writing, it's not possible underline text, highlight it (e.g. in yellow) or change the font size of these Slack messages, but you can use one of the methods we outlined above (e.g. making text bold) to make it stand out instead.

### Strikethrough text

This is less commonly used in Automation messages, but if you'd like some of your Slack message to be crossed out, you can achieve this by using the strikethrough formatting option.

In the Automation message, using tildes (~) around the text you want to strike out.

**Example:**
```
~This text will be struck through~
```

### Hyperlinked text

If you would like to include a link in your Slack message, you might want the reader to be able to click on a word or phrase of your choice rather than the whole URL being shown in the Slack message.

To do this, in your Automation, you will need to format your message with some basic HTML:

```html
<a href="YOUR URL HERE">WORD OR PHRASE TO CLICK</a>
```

**💡 Tip:** You can also find hyperlinked text already built into some Automation Templates.

## @Mentioning a team member

Sometimes you'll want to @mention a specific user in Slack, to ensure the message - although visible to other team members - is brought to the attention to the person responsible, so they definitely don't miss it among the "noise" of lots of Slack activity. For example, you might have a Slack message posting NPS survey responses to an #nps channel for all to see, but then tag in the Customer Success Manager responsible for the Company of the End User who gave that rating.

### (1) Ensure Slack IDs are populated in Planhat

You can @mention people in your Automation Slack message as long as their Slack ID is populated on their User record in Planhat.

"SlackId" is a system (default/standard) field on the User model (User representing you and your colleagues, as opposed to users of your product, which are represented by the End User model).

The quick way of populating Slack IDs for your Users in Slack is to go to the Slack integration (in the App Center) and clicking "Sync users".

You could also add the Slack IDs manually if you prefer:

- In Slack, you can get your own Slack ID by going to your profile, clicking on the ellipsis symbol, and selecting "Copy member ID"
- You can navigate to your own User Profile in Planhat by clicking on your name in the top right of your Planhat tenant, and selecting "Profile". Once there, look at the "Fields" section in the right-hand side; you may need to click on "+ Show full list" and search (e.g. Ctrl+F) to find the "SlackId" field to populate
- You can also view the SlackId field for multiple Users at once (e.g. to see who has it populated, and to fill it in for those who don't) by looking at Users in a data table (e.g. in Data Explorer or Settings) with this field showing as a column

### (2) Custom Automation

Now the required Slack IDs are populated in Planhat, you can build the Custom Automation.

In this example, we want to create an Automation where when a Company is created, we post to Slack and tag in the Owner of the Company. Our overall Automation looks like this:

Our trigger is "Company is created with anything", as shown in the configuration panel in the screenshot above, because we want this Automation to be triggered every time a Company record is created.

Our first step is then a "Get" step, which you can read all about in our separate article. It looks like this:

This step is to "Get" the full details of the User (of Planhat, i.e. you and your colleagues) that's referenced in the Owner field on the Company record that triggered the Automation. We use the replacement code `<<object.owner>>` to say we want to look at the trigger record (the "object" - the Company, e.g. Ford) and specifically the "owner" field on it. Once we have "Got" the User record of the Company Owner (e.g. Antonio Abram), we can see its SlackId field, and reference it in the Slack message.

Also note that we have renamed this step from the automatically generated random code name to "Step 1" for clarity.

Finally, we have the Slack message step:

In this example, the Slack message we type is:

```
Company "<<object.name>>" was just created. <@<<Step 1.slackId>>>, can you please contact them within the next 7 days?
```

We use a couple of replacement codes here:

- `<<object.name>>` is referring to the name of the trigger record (the Company, e.g. Ford)
- To @mention the relevant User, we use `<@<<Step 1.slackId>>>` - remembering that we renamed the previous step to Step 1, so if we had not renamed that step, we would need to replace "Step 1" in the replacement code with whatever the step name was (e.g. s-Yjk). This replacement code looks at the previous step in the Automation ("Get a single User"), and specifically the SlackId field on that User, and @mentions that User in the Slack message

The message posted to Slack looks like this:

**💡 Tip:** You can combine formatting options discussed in this article with replacement codes.

So, for example, if we take the example Slack message we have just seen above:

```
Company "<<object.name>>" was just created. <@<<Step 1.slackId>>>, can you please contact them within the next 7 days?
```

If we want to make the Company name (populated by the `<<object.name>>` replacement code) bold in the Slack message, we can add asterisks around the replacement code:

```
Company *"<<object.name>>"* was just created. <@<<Step 1.slackId>>>, can you please contact them within the next 7 days?
```