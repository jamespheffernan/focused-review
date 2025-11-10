const TEST_NAME = 'timeline-edit-interaction'

module.exports = {
  description: 'Timeline last-week hint messaging matches available interactions',
  async runTest({ createClient, logger }) {
    const client = await createClient().connect()

    try {
      const result = await client.evaluate(
        `(() => {
          const api = window.__APP_TEST_API__
          if (!api) {
            return { success: false, reason: 'Test API unavailable' }
          }

          return {
            success: true,
            yesNoHint: api.getLastWeekAnswerHint('pkg-timeline-subsequent', 'yes-no'),
            textHint: api.getLastWeekAnswerHint('pkg-timeline-initial', 'text-parsed'),
            sliderHint: api.getLastWeekAnswerHint('pkg-engagement-subsequent', 'slider')
          }
        })()`
      )

      if (!result || !result.success) {
        throw new Error(result?.reason || 'Unable to evaluate interaction hints')
      }

      const { yesNoHint, textHint, sliderHint } = result

      if (yesNoHint !== 'Answer above to confirm or adjust the timeline.') {
        throw new Error(`Timeline yes/no hint mismatch. Received: ${yesNoHint}`)
      }

      if (textHint !== 'Update the field below to revise this answer.') {
        throw new Error(`Timeline text hint mismatch. Received: ${textHint}`)
      }

      if (sliderHint !== null) {
        throw new Error(`Non-editable questions should not show a hint. Received: ${sliderHint}`)
      }

      logger.success('Timeline hint messaging matches expected interactions')
    } finally {
      await client.close()
    }
  }
}


