import { eq, and, inArray, desc, sql, gte, lte, isNull } from 'drizzle-orm';

// Import agent tables directly from schema.gcp
import {
	agentSessions,
	agentPhases,
	templateAssets,
	agentExecutionLogs,
	websocketConnections
} from '../schema.gcp';

// Types derived from schema
export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;
export type AgentPhase = typeof agentPhases.$inferSelect;
export type NewAgentPhase = typeof agentPhases.$inferInsert;
export type TemplateAsset = typeof templateAssets.$inferSelect;
export type NewTemplateAsset = typeof templateAssets.$inferInsert;
export type AgentExecutionLog = typeof agentExecutionLogs.$inferSelect;
export type NewAgentExecutionLog = typeof agentExecutionLogs.$inferInsert;
export type WebSocketConnection = typeof websocketConnections.$inferSelect;
export type NewWebSocketConnection = typeof websocketConnections.$inferInsert;

// Session status enum
export enum AgentSessionStatus {
    INITIALIZED = 'initialized',
    BLUEPRINT_GENERATED = 'blueprint_generated',
    EXECUTING = 'executing',
    REVIEWING = 'reviewing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

// Phase status enum
export enum AgentPhaseStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    SKIPPED = 'skipped'
}

// Phase type enum
export enum AgentPhaseType {
    BLUEPRINT = 'blueprint',
    ANALYSIS = 'analysis',
    CODE_GENERATION = 'code_generation',
    INTEGRATION = 'integration',
    REVIEW = 'review',
    DEPLOYMENT = 'deployment',
    COMPLETION = 'completion'
}

import { BaseService } from './BaseService';

export class AgentStateService extends BaseService {

    // ===============================
    // AGENT SESSION MANAGEMENT
    // ===============================

    /**
     * Create a new agent session
     */
    async createSession(sessionData: NewAgentSession): Promise<AgentSession> {
        try {
            this.logger.info('Creating agent session', { userId: sessionData.userId });

            const [session] = await this.database
                .insert(agentSessions)
                .values(sessionData)
                .returning();

            this.logger.info('Agent session created', { sessionId: session.id, status: session.status });
            return session;
        } catch (error) {
            this.logger.error('Failed to create agent session', { error, sessionData });
            throw error;
        }
    }

    /**
     * Get agent session by ID
     */
    async getSession(sessionId: string): Promise<AgentSession | null> {
        try {
            const [session] = await this.database
                .select()
                .from(agentSessions)
                .where(eq(agentSessions.id, sessionId))
                .limit(1);

            return session || null;
        } catch (error) {
            this.logger.error('Failed to get agent session', { sessionId, error });
            throw error;
        }
    }

    /**
     * Update agent session
     */
    async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession | null> {
        try {
            this.logger.debug('Updating agent session', { sessionId, updates });

            const [updatedSession] = await this.database
                .update(agentSessions)
                .set({
                    ...updates,
                    updatedAt: new Date()
                })
                .where(eq(agentSessions.id, sessionId))
                .returning();

            if (updatedSession) {
                this.logger.debug('Agent session updated', {
                    sessionId,
                    oldStatus: updatedSession.status,
                    newStatus: updates.status
                });
            }

            return updatedSession || null;
        } catch (error) {
            this.logger.error('Failed to update agent session', { sessionId, updates, error });
            throw error;
        }
    }

    /**
     * Update session status with automatic timestamp management
     */
    async updateSessionStatus(sessionId: string, status: AgentSessionStatus, additionalData?: {
        errorMessage?: string;
        errorDetails?: any;
        completedAt?: Date;
    }): Promise<AgentSession | null> {
        const updates: any = {
            status,
            updatedAt: new Date()
        };

        // Set appropriate timestamps based on status
        if (status === AgentSessionStatus.EXECUTING && !additionalData?.completedAt) {
            updates.startedAt = new Date();
        } else if ([AgentSessionStatus.COMPLETED, AgentSessionStatus.FAILED].includes(status)) {
            updates.completedAt = additionalData?.completedAt || new Date();
        } else if (status === AgentSessionStatus.FAILED) {
            updates.abortedAt = new Date();
        }

        // Handle error information
        if (additionalData?.errorMessage) {
            updates.errorMessage = additionalData.errorMessage;
        }
        if (additionalData?.errorDetails) {
            updates.errorDetails = additionalData.errorDetails;
        }

        return this.updateSession(sessionId, updates);
    }

    /**
     * Get sessions with pagination and filtering
     */
    async getSessions(options: {
        userId?: string;
        appId?: string;
        status?: AgentSessionStatus;
        limit?: number;
        offset?: number;
        includePhases?: boolean;
    } = {}): Promise<{ sessions: AgentSession[]; total: number }> {
        try {
            let query = this.database.select().from(agentSessions);

            // Apply filters
            if (options.userId) {
                query = query.where(eq(agentSessions.userId, options.userId));
            }
            if (options.appId) {
                query = query.where(eq(agentSessions.appId, options.appId));
            }
            if (options.status) {
                query = query.where(eq(agentSessions.status, options.status));
            }

            // Get total count first
            const countQuery = await this.database
                .select({ count: sql<number>`count(*)` })
                .from(agentSessions)
                .where(options.userId ? eq(agentSessions.userId, options.userId) : undefined);

            const total = countQuery[0]?.count || 0;

            // Apply ordering and pagination
            query = query
                .orderBy(desc(agentSessions.createdAt))
                .limit(options.limit || 50)
                .offset(options.offset || 0);

            const sessions = await query;

            // Optionally load phases for each session
            if (options.includePhases && sessions.length > 0) {
                const sessionIds = sessions.map((s: AgentSession) => s.id);
                const allPhases = await this.database
                    .select()
                    .from(agentPhases)
                    .where(inArray(agentPhases.sessionId, sessionIds))
                    .orderBy(agentPhases.createdAt);

                // Group phases by session
                const phasesBySession = allPhases.reduce((acc: Record<string, AgentPhase[]>, phase: AgentPhase) => {
                    if (!acc[phase.sessionId]) acc[phase.sessionId] = [];
                    acc[phase.sessionId].push(phase);
                    return acc;
                }, {} as Record<string, AgentPhase[]>);

                // Attach phases to sessions
                sessions.forEach((session: AgentSession) => {
                    (session as any).phases = phasesBySession[session.id] || [];
                });
            }

            return { sessions, total };
        } catch (error) {
            this.logger.error('Failed to get agent sessions', { options, error });
            throw error;
        }
    }

    /**
     * Delete session (cascades to phases and logs)
     */
    async deleteSession(sessionId: string): Promise<boolean> {
        try {
            this.logger.info('Deleting agent session', { sessionId });

            const result = await this.database
                .delete(agentSessions)
                .where(eq(agentSessions.id, sessionId));

            return result.rowCount > 0;
        } catch (error) {
            this.logger.error('Failed to delete agent session', { sessionId, error });
            throw error;
        }
    }

    // ===============================
    // PHASE MANAGEMENT
    // ===============================

    /**
     * Create new phase
     */
    async createPhase(phaseData: NewAgentPhase): Promise<AgentPhase> {
        try {
            this.logger.info('Creating agent phase', {
                sessionId: phaseData.sessionId,
                phaseType: phaseData.phaseType,
                phaseName: phaseData.phaseName
            });

            const [phase] = await this.database
                .insert(agentPhases)
                .values(phaseData)
                .returning();

            this.logger.debug('Agent phase created', { phaseId: phase.id });
            return phase;
        } catch (error) {
            this.logger.error('Failed to create agent phase', { phaseData, error });
            throw error;
        }
    }

    /**
     * Get phase by ID
     */
    async getPhase(phaseId: string): Promise<AgentPhase | null> {
        try {
            const [phase] = await this.database
                .select()
                .from(agentPhases)
                .where(eq(agentPhases.id, phaseId))
                .limit(1);

            return phase || null;
        } catch (error) {
            this.logger.error('Failed to get agent phase', { phaseId, error });
            throw error;
        }
    }

    /**
     * Get all phases for a session
     */
    async getSessionPhases(sessionId: string): Promise<AgentPhase[]> {
        try {
            return await this.database
                .select()
                .from(agentPhases)
                .where(eq(agentPhases.sessionId, sessionId))
                .orderBy(agentPhases.createdAt);
        } catch (error) {
            this.logger.error('Failed to get session phases', { sessionId, error });
            throw error;
        }
    }

    /**
     * Update phase
     */
    async updatePhase(phaseId: string, updates: Partial<AgentPhase>): Promise<AgentPhase | null> {
        try {
            this.logger.debug('Updating agent phase', { phaseId, updates });

            const [updatedPhase] = await this.database
                .update(agentPhases)
                .set(updates)
                .where(eq(agentPhases.id, phaseId))
                .returning();

            return updatedPhase || null;
        } catch (error) {
            this.logger.error('Failed to update agent phase', { phaseId, updates, error });
            throw error;
        }
    }

    /**
     * Update phase status with timestamps
     */
    async updatePhaseStatus(phaseId: string, status: AgentPhaseStatus, additionalData?: {
        errorMessage?: string;
        errorDetails?: any;
        result?: any;
        outputFiles?: any[];
        completedAt?: Date;
        phaseTokensUsed?: number;
        phaseExecutionTimeSeconds?: number;
    }): Promise<AgentPhase | null> {
        const updates: any = { status };

        // Set timestamps based on status
        if (status === AgentPhaseStatus.RUNNING) {
            updates.startedAt = new Date();
        } else if ([AgentPhaseStatus.COMPLETED, AgentPhaseStatus.FAILED, AgentPhaseStatus.SKIPPED].includes(status)) {
            updates.completedAt = additionalData?.completedAt || new Date();
        }

        // Handle error information
        if (additionalData?.errorMessage) {
            updates.errorMessage = additionalData.errorMessage;
        }
        if (additionalData?.errorDetails) {
            updates.errorDetails = additionalData.errorDetails;
        }

        // Handle success data
        if (additionalData?.result) {
            updates.result = additionalData.result;
        }
        if (additionalData?.outputFiles) {
            updates.outputFiles = additionalData.outputFiles;
        }

        // Handle resource usage
        if (additionalData?.phaseTokensUsed !== undefined) {
            updates.phaseTokensUsed = additionalData.phaseTokensUsed;
        }
        if (additionalData?.phaseExecutionTimeSeconds !== undefined) {
            updates.phaseExecutionTimeSeconds = additionalData.phaseExecutionTimeSeconds;
        }

        return this.updatePhase(phaseId, updates);
    }

    /**
     * Get next pending phase to execute
     */
    async getNextPendingPhase(sessionId: string): Promise<AgentPhase | null> {
        try {
            // Get phases that are pending and have all dependencies satisfied
            const allPhases = await this.getSessionPhases(sessionId);
            const pendingPhases = allPhases.filter(p => p.status === AgentPhaseStatus.PENDING);

            // Simple dependency resolution: phases with higher priority first,
            // no complex dependency checking in this simple implementation
            const sortedPending = pendingPhases
                .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1)) // Higher priority first
                .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)); // Older first

            return sortedPending[0] || null;
        } catch (error) {
            this.logger.error('Failed to get next pending phase', { sessionId, error });
            throw error;
        }
    }

    // ===============================
    // TEMPLATE ASSETS MANAGEMENT
    // ===============================

    /**
     * Create or update template asset cache entry
     */
    async upsertTemplateAsset(assetData: NewTemplateAsset): Promise<TemplateAsset> {
        try {
            const [asset] = await this.database
                .insert(templateAssets)
                .values(assetData)
                .onConflictDoUpdate({
                    target: [templateAssets.templateName, templateAssets.assetPath],
                    set: {
                        cachedContent: assetData.cachedContent,
                        contentHash: assetData.contentHash,
                        fileSizeBytes: assetData.fileSizeBytes,
                        mimeType: assetData.mimeType,
                        updatedAt: new Date(),
                        accessCount: sql`${templateAssets.accessCount} + 1`,
                        lastAccess: new Date()
                    }
                })
                .returning();

            return asset;
        } catch (error) {
            this.logger.error('Failed to upsert template asset', { assetData, error });
            throw error;
        }
    }

    /**
     * Get template asset by template name and path
     */
    async getTemplateAsset(templateName: string, assetPath: string): Promise<TemplateAsset | null> {
        try {
            // Update access statistics
            await this.database
                .update(templateAssets)
                .set({
                    lastAccessed: new Date(),
                    accessCount: sql`${templateAssets.accessCount} + 1`
                })
                .where(and(
                    eq(templateAssets.templateName, templateName),
                    eq(templateAssets.assetPath, assetPath)
                ));

            const [asset] = await this.database
                .select()
                .from(templateAssets)
                .where(and(
                    eq(templateAssets.templateName, templateName),
                    eq(templateAssets.assetPath, assetPath)
                ))
                .limit(1);

            return asset || null;
        } catch (error) {
            this.logger.error('Failed to get template asset', { templateName, assetPath, error });
            throw error;
        }
    }

    /**
     * Get all assets for a template
     */
    async getTemplateAssets(templateName: string): Promise<TemplateAsset[]> {
        try {
            return await this.database
                .select()
                .from(templateAssets)
                .where(eq(templateAssets.templateName, templateName))
                .orderBy(templateAssets.assetPath);
        } catch (error) {
            this.logger.error('Failed to get template assets', { templateName, error });
            throw error;
        }
    }

    /**
     * Clean up old/least-used template assets to manage cache size
     */
    async cleanupTemplateAssets(options: { maxAgeDays?: number; maxAssets?: number } = {}): Promise<number> {
        try {
            const { maxAgeDays = 30, maxAssets = 1000 } = options;

            // Get count of assets to potentially delete (keep most recently accessed)
            const assetsToDelete = await this.database
                .select({ id: templateAssets.id })
                .from(templateAssets)
                .where(lte(templateAssets.lastAccessed,
                    new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)))
                .orderBy(desc(templateAssets.lastAccessed))
                .offset(maxAssets)
                .limit(100); // Delete in batches

            if (assetsToDelete.length === 0) {
                return 0;
            }

            const deletedCount = await this.database
                .delete(templateAssets)
                .where(inArray(templateAssets.id, assetsToDelete.map(a => a.id)))
                .then(result => result.rowCount);

            this.logger.info('Cleaned up template assets', { deletedCount });
            return deletedCount;
        } catch (error) {
            this.logger.error('Failed to cleanup template assets', { error });
            throw error;
        }
    }

    // ===============================
    // EXECUTION LOGGING
    // ===============================

    /**
     * Log agent execution event
     */
    async logExecution(logData: NewAgentExecutionLog): Promise<AgentExecutionLog> {
        try {
            const [log] = await this.database
                .insert(agentExecutionLogs)
                .values(logData)
                .returning();

            return log;
        } catch (error) {
            this.logger.error('Failed to log execution', { logData, error });
            throw error;
        }
    }

    /**
     * Get execution logs for session
     */
    async getSessionExecutionLogs(sessionId: string, options: {
        limit?: number;
        offset?: number;
        level?: string;
        component?: string;
    } = {}): Promise<AgentExecutionLog[]> {
        try {
            let query = this.database
                .select()
                .from(agentExecutionLogs)
                .where(eq(agentExecutionLogs.sessionId, sessionId));

            if (options.level) {
                query = query.where(eq(agentExecutionLogs.level, options.level as any));
            }
            if (options.component) {
                query = query.where(eq(agentExecutionLogs.component, options.component));
            }

            query = query
                .orderBy(desc(agentExecutionLogs.timestamp))
                .limit(options.limit || 100)
                .offset(options.offset || 0);

            return await query;
        } catch (error) {
            this.logger.error('Failed to get session execution logs', { sessionId, options, error });
            throw error;
        }
    }

    // ===============================
    // WEBSOCKET CONNECTION MANAGEMENT
    // ===============================

    /**
     * Register WebSocket connection
     */
    async registerWebSocketConnection(connectionData: NewWebSocketConnection): Promise<WebSocketConnection> {
        try {
            this.logger.debug('Registering WebSocket connection', {
                sessionId: connectionData.sessionId,
                connectionId: connectionData.connectionId
            });

            const [connection] = await this.database
                .insert(websocketConnections)
                .values(connectionData)
                .returning();

            return connection;
        } catch (error) {
            this.logger.error('Failed to register WebSocket connection', { connectionData, error });
            throw error;
        }
    }

    /**
     * Update WebSocket connection status
     */
    async updateWebSocketConnection(connectionId: string, updates: Partial<WebSocketConnection>): Promise<WebSocketConnection | null> {
        try {
            const [updatedConnection] = await this.database
                .update(websocketConnections)
                .set({
                    ...updates,
                    lastPing: updates.lastPing || new Date()
                })
                .where(eq(websocketConnections.connectionId, connectionId))
                .returning();

            return updatedConnection || null;
        } catch (error) {
            this.logger.error('Failed to update WebSocket connection', { connectionId, updates, error });
            throw error;
        }
    }

    /**
     * Remove WebSocket connection
     */
    async removeWebSocketConnection(connectionId: string): Promise<boolean> {
        try {
            const result = await this.database
                .delete(websocketConnections)
                .where(eq(websocketConnections.connectionId, connectionId));

            return result.rowCount > 0;
        } catch (error) {
            this.logger.error('Failed to remove WebSocket connection', { connectionId, error });
            throw error;
        }
    }

    /**
     * Get active connections for session
     */
    async getSessionWebSocketConnections(sessionId: string): Promise<WebSocketConnection[]> {
        try {
            return await this.database
                .select()
                .from(websocketConnections)
                .where(and(
                    eq(websocketConnections.sessionId, sessionId),
                    eq(websocketConnections.status, 'connected')
                ))
                .orderBy(websocketConnections.connectedAt);
        } catch (error) {
            this.logger.error('Failed to get session WebSocket connections', { sessionId, error });
            throw error;
        }
    }

    /**
     * Cleanup expired WebSocket connections (called periodically)
     */
    async cleanupExpiredWebSocketConnections(): Promise<number> {
        try {
            // Note: This would need a stored procedure in PostgreSQL
            // For now, we'll implement a manual cleanup
            const expiredConnections = await this.database
                .select({ id: websocketConnections.id })
                .from(websocketConnections)
                .where(lte(websocketConnections.lastPing, new Date(Date.now() - 5 * 60 * 1000))); // 5 minutes

            if (expiredConnections.length > 0) {
                await this.database
                    .delete(websocketConnections)
                    .where(inArray(websocketConnections.id, expiredConnections.map(c => c.id)));
            }

            this.logger.info('Cleaned up expired WebSocket connections', { deletedCount: expiredConnections.length });
            return expiredConnections.length;
        } catch (error) {
            this.logger.error('Failed to cleanup expired WebSocket connections', { error });
            throw error;
        }
    }

    // ===============================
    // SESSION STATISTICS AND ANALYTICS
    // ===============================

    /**
     * Save complete agent state (for persistence)
     */
    async saveAgentSession(sessionId: string, state: any): Promise<void> {
        try {
            this.logger.debug('Saving agent session state', { sessionId });

            // Store the complete state as JSON in the database
            const stateJson = JSON.stringify(state);

            // Update or insert the session state
            await this.database
                .insert(agentSessions)
                .values({
                    id: sessionId,
                    userId: state.inferenceContext?.userId || 'unknown',
                    appId: state.inferenceContext?.agentId || sessionId,
                    status: this.mapAgentStateToStatus(state),
                    state: stateJson,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: agentSessions.id,
                    set: {
                        status: this.mapAgentStateToStatus(state),
                        state: stateJson,
                        updatedAt: new Date()
                    }
                });

            this.logger.debug('Agent session state saved', { sessionId });
        } catch (error) {
            this.logger.error('Failed to save agent session state', { sessionId, error });
            throw error;
        }
    }

    /**
     * Map agent state to session status
     */
    private mapAgentStateToStatus(state: any): AgentSessionStatus {
        // Map current dev state to session status
        switch (state.currentDevState) {
            case 'PHASE_IMPLEMENTING':
            case 'PHASE_GENERATING':
                return AgentSessionStatus.EXECUTING;
            case 'REVIEWING':
                return AgentSessionStatus.REVIEWING;
            case 'IDLE':
                return state.mvpGenerated ? AgentSessionStatus.COMPLETED : AgentSessionStatus.INITIALIZED;
            default:
                return AgentSessionStatus.INITIALIZED;
        }
    }

}

// Export singleton instance with default logger
// Note: This will need to be initialized with env in the actual application
export let agentStateService: AgentStateService;

// Helper function to create service with custom logger
export function createAgentStateService(env: any): AgentStateService {
    return new AgentStateService(env);
}
