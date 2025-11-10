const TEST_NAME = 'timeline-calendar-sync'

module.exports = {
  description: 'Reaffirmed timelines create calendar commitments for the current week',
  async runTest({ createClient, logger }) {
    const client = await createClient().connect()

    try {
      logger.step('Resetting database and seeding historical commitment')

      const result = await client.evaluate(
        `(async () => {
          const api = window.__APP_TEST_API__
          if (!api) {
            return { success: false, reason: 'Test API unavailable' }
          }

          const startOfISOWeek = (offset = 0) => {
            const now = new Date()
            const day = now.getDay() || 7
            now.setHours(0, 0, 0, 0)
            now.setDate(now.getDate() - day + 1 + offset * 7)
            return now.toISOString().slice(0, 10)
          }

          await api.resetDatabase()

          const projectId = 'test-project-timeline'
          const currentWeek = startOfISOWeek(0)
          const historicalWeek = startOfISOWeek(-2) // Two weeks ago to simulate gap

          const commitmentDate = (() => {
            const base = new Date(currentWeek)
            base.setDate(base.getDate() + 10)
            return base.toISOString().slice(0, 10)
          })()

          const project = {
            id: projectId,
            name: 'Timeline Project',
            status: 'active',
            reviewIntervalDays: 7,
            tags: [],
            nextReviewDate: currentWeek
          }

          const initialAnswer = {
            id: 'ans-initial',
            projectID: projectId,
            questionID: 'pkg-timeline-initial',
            weekOf: historicalWeek,
            text: \`Finish by \${commitmentDate}\`,
            status: 'Updated',
            parsedDate: commitmentDate
          }

          await api.insertProject(project)
          await api.insertAnswer(initialAnswer)
          await api.syncTimeline(initialAnswer, project)

          const historicalCommitments = await api.getCommitmentsForWeek(historicalWeek)

          const reaffirmAnswer = {
            id: 'ans-yes',
            projectID: projectId,
            questionID: 'pkg-timeline-subsequent',
            weekOf: currentWeek,
            text: 'yes',
            status: 'Updated'
          }

          await api.insertAnswer(reaffirmAnswer)
          await api.syncTimeline(reaffirmAnswer, project)

          const currentCommitments = await api.getCommitmentsForWeek(currentWeek)

          return {
            success: true,
            historicalCount: historicalCommitments.length,
            currentCount: currentCommitments.length,
            commitmentDate,
            currentCommitment: currentCommitments[0] ?? null
          }
        })()`,
        { awaitPromise: true }
      )

      if (!result || !result.success) {
        throw new Error(result?.reason || 'Unknown evaluation failure')
      }

      const { historicalCount, currentCount, commitmentDate, currentCommitment } = result

      if (historicalCount !== 1) {
        throw new Error(`Expected 1 historical commitment, found ${historicalCount}`)
      }

      if (currentCount !== 1) {
        throw new Error(`Expected 1 current commitment after reaffirmation, found ${currentCount}`)
      }

      if (!currentCommitment) {
        throw new Error('Current commitment is missing')
      }

      if (currentCommitment.committedDate !== commitmentDate) {
        throw new Error(
          \`Expected reaffirmed commitment date \${commitmentDate}, received \${currentCommitment.committedDate}\`
        )
      }

      if (currentCommitment.answerId !== 'ans-yes') {
        throw new Error('Reaffirmed commitment should reference the current answer ID')
      }

      logger.success('Reaffirmed timeline produced correct calendar commitment')
    } finally {
      await client.close()
    }
  }
}


