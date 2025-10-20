import { Firestore, Timestamp } from '@google-cloud/firestore';
import type { AgentStore, AgentState } from './agentStore';
import { getProjectId } from '../gcp/auth';

type EnvLike = Record<string, unknown> | undefined;

interface FirestoreAgentDocument {
	payload: string;
	updatedAt: Timestamp;
	version: number;
}

const COLLECTION = 'agentSessions';
const MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = 50;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGcpAgentStore(env: EnvLike): AgentStore {
	const projectId = getProjectId(env);
	if (!projectId) {
		throw new Error('GCP_PROJECT_ID is not configured.');
	}

	const firestore = new Firestore({ projectId });
	const collection = firestore.collection(COLLECTION);

	async function getDocRef(sessionId: string) {
		return collection.doc(sessionId);
	}

	return {
		async fetch(_request: Request): Promise<Response> {
			return new Response('Agent fetch is not implemented for GCP agent store.', { status: 501 });
		},

		async getSessionState(sessionId: string): Promise<AgentState | null> {
			const docRef = await getDocRef(sessionId);
			const snapshot = await docRef.get();
			if (!snapshot.exists) {
				return null;
			}
			const data = snapshot.data() as FirestoreAgentDocument | undefined;
			if (!data) {
				return null;
			}
			try {
				const payload = JSON.parse(data.payload);
				return {
					sessionId,
					payload,
				};
			} catch (error) {
				console.error('Failed to parse agent session payload', { sessionId, error });
				return null;
			}
		},

		async putSessionState(sessionId: string, state: AgentState): Promise<void> {
			const docRef = await getDocRef(sessionId);
			const payload = JSON.stringify(state.payload ?? {});

			for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
				try {
					await firestore.runTransaction(async (tx) => {
						const snapshot = await tx.get(docRef);
						const data = snapshot.exists ? (snapshot.data() as FirestoreAgentDocument) : null;
						const version = (data?.version ?? 0) + 1;

						tx.set(docRef, {
							sessionId,
							payload,
							updatedAt: Timestamp.now(),
							version,
						} as FirestoreAgentDocument);
					});
					return;
				} catch (error: any) {
					if (attempt === MAX_RETRIES - 1) {
						throw error;
					}
					if (error?.code === 10 || error?.code === 409) {
						await sleep(RETRY_BACKOFF_MS * (attempt + 1));
						continue;
					}
					throw error;
				}
			}
		},
	};
}
