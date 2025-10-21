import type { Env } from './env';
import { GlobalConfigurableSettings } from "../config";
import { AuthRequirement } from "../middleware/auth/routeAuth";
import { AuthUser } from "./auth-types";
import { RuntimeProvider } from "shared/platform/runtimeProvider";


export type AppEnv = {
    Bindings: Env;
    Variables: {
        user: AuthUser | null;
        sessionId: string | null;
        config: GlobalConfigurableSettings;
        authLevel: AuthRequirement;
        runtimeProvider: RuntimeProvider;
    }
}
