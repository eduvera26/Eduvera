import { Controller, Get, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Public } from "./common/decorators.js";
import { config } from "./config.js";

@Controller()
export class SpaController {
  @Public()
  @Get("favicon.svg")
  async favicon(@Res() reply: FastifyReply) {
    try {
      const icon = await readFile(join(config().spaDistDir, "favicon.svg"));
      return reply.type("image/svg+xml").send(icon);
    } catch {
      return reply.status(404).send();
    }
  }

  @Public()
  @Get(["/", "login", "signup", "launcher", "workspace", "parent", "parent/*", "student", "student/*", "teacher", "teacher/*", "principal", "principal/*", "onboarding/*"])
  async index(@Res() reply: FastifyReply) {
    try {
      const html = await readFile(join(config().spaDistDir, "index.html"));
      return reply.type("text/html; charset=utf-8").send(html);
    } catch {
      return reply.status(503).send({
        error: {
          status: 503,
          code: "frontend_not_built",
          detail: "Build the React application before serving the SPA.",
        },
      });
    }
  }
}
