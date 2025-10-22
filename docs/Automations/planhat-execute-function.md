# "Execute Function" steps in Automations

## Summary

- "Execute Function" is a type of step you can use when configuring Custom Automations
- These steps enable you to run your choice of JavaScript functions, so you can transform data as required - in a fully customized way - in your Automations
- If you're considering building a Function Execution step, you should discuss this with your Planhat TAM/CSM

## Who is this article for?

Planhat Users who are building Custom Automations for their organization (e.g. Tech/Ops)

## Series

This article is part of a series on Automations:

- "Execute Function" steps in Automations ⬅️ You are here

## Article contents

**This is a technical deep-dive article**

Read on if you'd like to learn about Execute Function steps - a type of step you can use when configuring Custom Automations. Ensure you [read our article on Custom Automations](https://help.planhat.com/en/articles/9590728-custom-automations) before this one, so you are familiar with the context of where these Execute Function steps can be used.

If you would simply like a general introduction to Automations, check out our overview article [here](https://help.planhat.com/en/articles/9587240-automation-overview).

📌 **Important to note**

The use of these JavaScript Execute Function steps in Custom Automations is fairly complex and advanced, and not something you would expect to set up regularly. Please discuss with your Technical Account Manager (TAM) or Customer Success Manager (CSM) before considering implementing an Execute Function step.

## What are Execute Function steps?

An "Execute Function" step is a type of action step that you can include when configuring a [Custom Automation](https://help.planhat.com/en/articles/9590728-custom-automations).

Click the image to view it enlarged

This step type enables you to execute a JavaScript function, taking inputs from a suitable step/record and transforming them, returning an output that can be used in subsequent steps.

### Technical details

For Function Executions, we use:

- Environment: Node.JS 12.x
- Memory limit: 128 MB
- Time limit: 10 sec

For easy handling of async code, we have implemented support of async/await, while for HTTP requests we have fetch external module.

## Why use Execute Function steps?

Execute Function steps are used to take data and transform it, so it can be used in a later Automation step.

For example, if you create a Custom Automation involving AI, you could use an Execute Function step to format the text received from the LLM so that it can be cleanly fed into Planhat. For example:

Click the image to view it enlarged

Function Execution steps are used if something relatively complex and specific is required that isn't available using any of the standard Automation steps (e.g. Update, Create or Get etc.) - it allows you to design a step that's completely custom.

## How to set up Execute Function steps

When you are configuring (creating or editing) a Custom Automation (see [here](https://help.planhat.com/en/articles/9590728-custom-automations) for general information on how to do this), you can select "Execute Function" as a step type:

This will open up a gray box with an example function like so:

You can remove the example text and enter your JavaScript function of choice here.

[Replacement codes](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations) can be used within the function, the same as you will have seen in more "standard" steps. You can start typing `<<` to bring up the options, like usual.

For example, you can see `<<Step 1>>` and `<<object>>` referenced in the Execute Function example below.

Click the image to view it enlarged

📌 **Important to note**

Remember (as we discuss further in the replacement code article [here](https://help.planhat.com/en/articles/11144131-replacement-codes-dynamic-references-in-automations)), it's vital that you use the correct step name for your case. Steps are automatically given a random name such as "s-pLW", and you should ensure you reference that name, unless you rename the step (e.g. to "Step 1" etc.), in which case you use the new step name in replacement codes.

You should ensure that your function gives a suitable output to be referenced/used in subsequent steps as required - for example, the screenshot below shows the output of the Execute Function step referenced in a replacement code as `<<Step 2>>`.

Click the image to view it enlarged

In this article, we have given a very quick overview of Function Execution steps. Please reach out to your TAM or CSM if you would like to discuss this topic in further detail.