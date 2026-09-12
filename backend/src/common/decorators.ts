import { SetMetadata } from "@nestjs/common";

export const PUBLIC_ROUTE = "omnischool:public";
export const SKIP_CSRF = "omnischool:skip-csrf";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);
