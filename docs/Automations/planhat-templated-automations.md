# Templated Automations

## Summary

- Automations enable you to automate actions in Planhat, using the general structure of "if x happens, do y"
- Within Planhat's Apps Library, you can choose from a large selection of Automation Templates, which are pre-built but still customizable, so you can tailor them to your specific needs
- When configuring Templated Automations, you use a simple "sentence structure" UI, and together with the pre-configured elements, this makes them quick and easy to set up
- If it's not possible to achieve what you want using a Templated Automation (e.g. because you have an unusual or advanced use case), you can build a Custom Automation instead

## Who is this article for?

Planhat Users who are building Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- Templated Automations ⬅️ You are here

## Article contents

**This is a technical deep-dive article**

Read on if you'd like to learn how to set up Templated Automations.

If you would simply like a general introduction to Automations, check out our overview article [here](https://help.planhat.com/en/articles/9587240-automation-overview).

## What are Templated Automations and why use them?

In our [Automations Overview article](https://help.planhat.com/en/articles/9587240-automation-overview), we explain how using Automations is one way in which actions can be automated in Planhat. Automations have the general structure of "if x happens, do y", and can either be simple or more complex if required.

Planhat includes a library of pre-built (yet customizable) Automations for you to choose from, to make your own Templated Automations. As they are partially pre-configured for you, they are the quickest and easiest type of Automations to set up.

There are a wide range of Automation Templates available for you to choose from, within the [Apps Library](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center#h_f052aa1270) in the [App Center](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center) of in upgraded Planhat (ws.planhat.com).

Click the image to view it enlarged

If you click on one of these Automation Templates to open it up, you'll see that the UI is a "sentence" structure (example shown below), which is easy to understand. You'll also see that Automation Templates have many elements that can be configured by you - so even though they are Templates, they can still be customized and personalized - they are interactive rather than being something fixed and static.

📌 **Important to note**

When you are creating an Automation for your Planhat tenant, you should always choose a Templated Automation (rather than a [Custom Automation](https://help.planhat.com/en/articles/9590728-custom-automations)) if at all possible.

This means if you want to build a new Automation, you should start by searching the Apps Library to see if there is a Template that means your needs (we explain how below), only considering a Custom Automation if there isn't a suitable Template available.

Using a Templated Automation is quicker and easier for you, whereas Custom Automations, whilst being incredibly powerful, are more complex to set up.

## How to set up a Templated Automation

1. Go the [App Center](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center), one of the [Global Tools for admins](https://help.planhat.com/en/articles/10091564-global-tools-for-planhat-builders-admins) accessible in the top gray bar of your Planhat tenant:

Click the image to view it enlarged

2. Click "+ New app" in the top right:

Click the image to view it enlarged

3. This opens up the Apps Library:

Click the image to view it enlarged

4. To help you find the Template you need, you can either browse the Automation Templates via the categories on the left-hand side, and/or use the search box in the top right:

Click the image to view it enlarged

📌 **Important to note:** at the time of writing, in upgraded Planhat (ws.planhat.com), the Automation Templates for OpenAI are positioned in the Apps Library under the "Integrations" category rather than Automations (shown in the screenshot below), and you set up the [AI Integrations](https://help.planhat.com/en/articles/10063285-setting-up-the-ai-integrations) themselves under "Connections" in the App Center rather than "Integrations".

5. Click on your choice of Automation Template to open it up - for example:

6. Go through your Automation Template and adjust all relevant parts. For instance, in the example pictured above, you can choose a different Company filter from the dropdown menu, change "equal to" to "less than" or "more than" etc., change the number in the next box, and so on. All the boxes (and the checklist shown in the screenshot above) can be edited

7. Once you've finished configuring your Automation Template, click "Save" in the top right (shown in the screenshot above)

8. Your new Templated Automation will display within your App Center, in "All apps":

🚀 **Tip:** check our our [separate article on the App Center](https://help.planhat.com/en/articles/10165410-global-tools-for-admins-app-center) for more on how to manage Apps here, such as using labels.

🚀 **Tip**

In some Automation Templates, you will see a box for a custom message, including << >> dynamic references, such as in the example shown below; you can read all about these replacement codes in custom messages in our separate article [here](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations). You can also learn about how to format Slack messages sent from Automations in our article [here](https://help.planhat.com/en/articles/9587101-sending-and-formatting-slack-messages-in-automations).