import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators.js";
import { DatabaseService } from "./database/database.service.js";

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get("healthz")
  health() {
    return { status: "ok", service: "omnischool-api" };
  }

  @Public()
  @Get("readyz")
  async ready() {
    await this.db.ping();
    return { status: "ready", database: "ok" };
  }
}
