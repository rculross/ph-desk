# "Wait" steps in Automations

## Summary

- "Wait" is a type of step you can use when configuring Custom Automations
- It is a pause for a time period (or until a date) that you specify
- It gives you even more control and flexibility over your Automations
- For example, you could use a Wait step to allow time for something to happen (e.g. an Invoice to be paid or a Task to be completed) before continuing with the next steps

## Who is this article for?

Planhat Users who are building Custom Automations for their organization (e.g. Tech/Ops)

## Article contents

### This is a technical deep-dive article

Read on if you'd like to learn about Wait steps - a type of step you can use when configuring Custom Automations. Ensure you read our article on Custom Automations before this one, so you are familiar with the context of where these Wait steps can be used.

If you would simply like a general introduction to Automations, check out our overview article.

## What are Wait steps?

"Wait" is a type of step you can use when configuring Custom Automations. Wait steps enable you to pause the process at your chosen stage, for a length of time defined by you.

You can:
- either define a time period to wait - a specific number of minutes, hours or days (up to 30 days)
- or set the Automation to recommence on a specific future date (within 30 days)

In an Automation run, when the defined "Wait" period has elapsed, it will move on to the next step of the Automation.

## Why use Wait steps?

Wait steps are one of the ways you can control when actions happen via Automations.

You can time your processes perfectly using these pauses in Automations. Like Branch steps, they enable you to accomplish in a single Automation what you might have previously needed to build multiple Automations for.

Let's look at a typical example use case:

When an Invoice is created ...
- ... send a notification ...
- ... wait for 4 weeks ...
- ... branch: if unpaid, send a particular notification message; if paid, send a different notification message

In this scenario, the Wait step is useful because it gives the recipient of the Invoice the time to pay it, and you don't need separate Automations for (1) notifying about the creation of the Invoice and (2) the check/notification about whether it's paid or not paid.

## How to set up Wait steps

When you are configuring (creating or editing) a Custom Automation (see here for general information on how to do this), you can select "Wait" in any step after the trigger:

Use the left-hand box to choose between "For" or "Until":

- **"For"** enables you to specify an amount of time - type a number in the middle box, and use the right-hand box to choose between "Minutes", "Days" or "Weeks" - this is a dynamic reference (i.e. the Wait end date/time will vary depending on when each Automation run happens)

- If you select **"Until"**, you have a date picker to select a date from - this is a fixed reference (i.e. the Wait of each Automation run will have the same end date) so it's more suitable for one-off situations, e.g. perhaps you are waiting until a product launch on a specific date

... and that's it! Super simple!

## Technical details - logs and scenarios

As with any other Custom Automations, the runs of those with Wait steps are detailed in the Automation logs, which we describe in detail in a separate article. Wait steps will show in the logs as "[DELAY.delay]".

This can be really useful - for example if you haven't yet seen the Automation outcome you were expecting (e.g. a notification), the logs can show you whether (1) the Automation wasn't triggered, or (2) the Automation failed with an error at some point, or (3) the Automation is simply in the middle of a Wait step.

You may be wondering what happens if an Automation run has started, and it's currently in the middle of a Wait step, and then either:
- The Automation is disabled
- The Automation is updated
- The Automation is deleted

Let's take a look at each of these examples in turn.

### During a Wait step, the Automation is disabled

Automations can be disabled manually, or automatically e.g. after you update and save the Automation.

So what happens if an Automation has started running, gets to a Wait step, and then is disabled? The result in this case depends on if/when you re-enable the Automation (via the toggle switch in the App Center).

If you re-enable the Automation during the waiting period (the delay you set in the Wait step), then the Automation run will continue on as normal, successfully completing any subsequent steps after the Wait step (assuming they themselves are set up correctly and don't error).

However, if the waiting period (the delay you set in the Wait step) has passed before you re-enable the Automation, or indeed if you never re-enable the Automation, the Wait step will complete but then the next step will fail with the following error message - any steps after the Wait will not execute.

```
"name": "Failed to continue",
"message": "Automation doesn't exist or is not longer enable."
```

### During a Wait step, the Automation is updated

This comes back to the previous discussion about the possible effects of the Automation being disabled, because if you update/save an Automation, it's automatically disabled.

If you quickly re-enable the Automation after saving, then any Automation run in a Wait step at that time will continue on successfully as planned; but if the Wait step finishes and the Automation is still disabled, it will give an error when it attempts the next step, as we discussed above.

### During a Wait step, the Automation is deleted

If an Automation run is currently in a Wait step, and then you delete (rather than disable) the Automation, the whole Automation will be deleted, and any remaining steps of that Automation run will be cancelled and won't complete.