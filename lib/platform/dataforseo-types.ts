export type Citation = { url: string; title: string | null }
export type MentionEvidence = {
  source: 'dataforseo-llm-mentions'; domain: string; platform: 'google' | 'chat_gpt';
  locationCode: 2840; languageCode: 'en'; retrievedAt: string; providerTaskId: string;
  actualCostUsd: number; totalMatches: number; sampledRows: number;
  items: Array<{ question: string; model: string | null; observedAt: string | null; citations: Citation[] }>;
  limitations: string[];
}

export type DataForSeoJob = {
  jobId: string; domain: string; platform: 'google' | 'chat_gpt'; rowLimit: number;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'uncertain'; createdAt: string; updatedAt?: string; result?: MentionEvidence | null;
}

// Customer evidence excludes operational provider identifiers and billing details.
// The full types above remain the private persistence/accounting contract.
export type PublicMentionEvidence = Omit<MentionEvidence, 'source' | 'providerTaskId' | 'actualCostUsd'>
export type PublicDataForSeoJob = Omit<DataForSeoJob, 'result'> & { result?: PublicMentionEvidence | null }
