# Get notified about Automation failures

## Summary

- In the App Center, you can view if each Automation has run recently, and whether the runs were successful or failed, and you can also see if an Automation is disabled
- To ensure you know about any issues right away, you can enable notifications for each Automation, to alert you if Automation runs fail and/or Automations are automatically disabled due to repeated failures
- As with other notifications, you can view them in Planhat (in the "Notifications" Home feature), and choose whether you would also like to receive them externally (e.g. via email)
- Once you're aware of any failures, you can resolve any Automation setup issues, and enable the Automation again if required

## Who is this article for?

Planhat Users who are building/managing Automations for their organization (e.g. Tech/Ops)

## Article contents

## Introduction

Automations rarely encounter issues. When they do, it's typically because the Automation was incorrectly configured. If any of your Automation runs do fail, it's important that you're aware, so you can address any setup issues.

By default, when you're viewing your list of Automations in the App Center, you can see at a glance whether each Automation has run successfully or unsuccessfully recently, and whether an Automation is disabled (which can happen if an Automation is repeatedly failing). You can choose to enable personal notifications for each Automation if you would like to be alerted if the Automation has a failed run or is automatically disabled, rather than needing to check the App Center. It's really quick and easy to turn these notifications on. The notifications can be viewed in the Planhat UI, and you can also receive them externally (e.g. via email) depending on your personal notification preferences in Planhat.

**📚 Further reading:** Check out our separate article on troubleshooting Automation failures, including details about Automation logs.

## Default: Automation failures without notifications

Even without turning on specific notifications to be alerted about Automation run failures, there are ways in Planhat that you can see that an Automation run has failed, and Planhat will automatically disable Automations that repeatedly fail.

By default, Planhat will:

### Show failed Automation runs (executions) in the Planhat UI for the specific Automation

In the App Center, you can get an overview of all your Automations, and in the "7D health" column you can see whether the Automation has run successfully (green) or unsuccessfully (red) in the past 7 days.

If you click on any Automation to open it up, click into the "Logs" tab, and click into the step details, you can view failed runs/steps in red, together with any error messages. Check out our separate article on troubleshooting with Automation logs.

### Disable an Automation after 10 failed runs (executions) in any 24-hour period

This is to avoid repeatedly running an Automation that isn't set up correctly.

## Custom: notifications about Automation failures

### How to enable the notifications

You can choose to receive notifications if an Automation run fails or an Automation is disabled. These notifications are personal to you (your User), and should be configured individually for each Automation - this means you can be notified about Automations you are responsible for, for example.

1. In App Center, click on the Automation that you would like to be notified about

2. Click on the third tab - if it's a Templated Automation, this is the "Data" tab; if it's a Custom Automation, it's called the "Fields" tab

Whether you're in a Templated or Custom Automation, you will see that notifications have their own separate section within this tab, with a tooltip if you mouse over the "i": "Notifications are user-specific. Changing it applies only to you." As the tooltip explains, adjusting these toggle switches only affects notifications for your own User only. Anyone with access to the Automation can toggle them on, and everyone who's done so will be notified simultaneously.

As you can see in the screenshots above, there are two notification toggle switches that you can choose to enable/disable (the default being disabled):

- **"Failed Notifications"**: be notified whenever the specific Automation fails. You'll be notified a maximum of 10 times in any 24-hour period, after which point the Automation will be disabled automatically (see the second type of Automation notification you can toggle on) and will require manual reactivation

- **"Automation Disabled"**: be notified whenever the specific Automation is automatically disabled after 10 failed runs in any 24-hour period

Although you can control these independently, if you would like to be notified about an Automation, we recommend that you enable both toggle switches.

### What the notifications look like

You can read all about notifications in upgraded Planhat (ws.planhat.com) in general. You can view notifications within Planhat in the "Notifications" Home feature, and you can configure how you receive additional external notifications in your User Profile.

Here's what the notifications can look like in the "Notifications" Home feature (with both "failed" and "disabled" notifications turned on for an Automation) - you can see repeated notifications about the Automation failing, letting you know that if it keeps failing it will be disabled, and then the final notification stating that the Automation is disabled.

Here's the same thing in notification emails:

## Re-enabling an Automation if it's been automatically disabled

If an Automation has automatically been disabled because it failed 10 times in a day, you should troubleshoot it (using the guidance in this separate article), and then once you have fixed your Automation and you're ready for it to start running again, simply enable it via the relevant toggle switch for that Automation in the App Center.