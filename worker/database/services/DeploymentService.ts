import { desc, eq, and } from "drizzle-orm";

import { BaseService } from "./BaseService";
import {
    appDeployments,
    type AppDeployment,
    type NewAppDeployment,
    type AppDeploymentTarget,
    type AppDeploymentStatus,
} from "../schema";

export interface DeploymentRecordInput {
    appId: string;
    target: AppDeploymentTarget;
    version?: number;
    serviceUrl?: string;
    status?: AppDeploymentStatus;
    metadata?: Record<string, unknown>;
}

export class DeploymentService extends BaseService {
    async recordDeployment(input: DeploymentRecordInput): Promise<AppDeployment | undefined> {
        const now = new Date();
        const values: NewAppDeployment = {
            appId: input.appId,
            target: input.target,
            version: input.version ?? 1,
            serviceUrl: input.serviceUrl ?? null,
            status: input.status ?? "pending",
            metadata: input.metadata ?? {},
            createdAt: now,
            updatedAt: now,
        };

        try {
            await this.database
                .insert(appDeployments)
                .values(values)
                .onConflictDoUpdate({
                    target: [appDeployments.appId, appDeployments.target, appDeployments.version],
                    set: {
                        serviceUrl: input.serviceUrl ?? null,
                        status: values.status,
                        metadata: values.metadata,
                        updatedAt: now,
                    },
                });

            return this.getLatestDeployment(input.appId, input.target);
        } catch (error) {
            return this.handleDatabaseError(error, "recordDeployment", {
                appId: input.appId,
                target: input.target,
            });
        }
    }

    async getLatestDeployment(appId: string, target: AppDeploymentTarget): Promise<AppDeployment | undefined> {
        try {
            const [record] = await this.database
                .select()
                .from(appDeployments)
                .where(and(eq(appDeployments.appId, appId), eq(appDeployments.target, target)))
                .orderBy(desc(appDeployments.version), desc(appDeployments.createdAt))
                .limit(1);
            return record;
        } catch (error) {
            return this.handleDatabaseError(error, "getLatestDeployment", { appId, target });
        }
    }
}
