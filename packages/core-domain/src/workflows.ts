import type { GitHubTeachingTopic } from "./github-model"

export interface WorkflowScenario {
  id: string
  title: string
  realism: {
    largeRepoFaithful: boolean
    simplifiedTeachingNotes: string[]
  }
  githubBridgeTopics: GitHubTeachingTopic[]
}
