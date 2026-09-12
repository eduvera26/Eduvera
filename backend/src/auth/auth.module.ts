import { Module } from "@nestjs/common";
import { AuditService } from "../common/audit.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CsrfGuard, SessionGuard } from "./guards.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuditService, SessionGuard, CsrfGuard],
  exports: [AuthService, AuditService, SessionGuard, CsrfGuard],
})
export class AuthModule {}
